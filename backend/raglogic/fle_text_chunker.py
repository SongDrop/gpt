import os
from typing import List, Dict, Optional
import fitz  # PyMuPDF
import chardet
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    SearchIndex,
    SimpleField,
    SearchFieldDataType,
    SearchableField,
    VectorSearchProfile,
    HnswAlgorithmConfiguration,
    VectorSearch,
    SearchField
)
from azure.identity import DefaultAzureCredential
from openai import AzureOpenAI

class DocumentProcessor:
    def __init__(self, azure_openai_endpoint: str, azure_search_endpoint: str, index_name: str):
        self.credential = DefaultAzureCredential()
        self.openai_client = AzureOpenAI(
            api_version="2023-05-15",
            azure_endpoint=azure_openai_endpoint,
            credential=self.credential
        )
        self.search_client = SearchClient(
            endpoint=azure_search_endpoint,
            index_name=index_name,
            credential=self.credential
        )
        self.index_client = SearchIndexClient(
            endpoint=azure_search_endpoint,
            credential=self.credential
        )
        self.index_name = index_name

    def chunk_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """Split text into chunks with overlap for context preservation."""
        chunks = []
        start = 0
        length = len(text)
        
        while start < length:
            end = start + chunk_size
            chunk = text[start:end]
            chunks.append(chunk)
            start = end - overlap if end - overlap > start else end
        return chunks

    def read_pdf(self, file_path: str) -> str:
        """Extract text from PDF using PyMuPDF."""
        text = []
        with fitz.open(file_path) as doc:
            for page in doc:
                text.append(page.get_text())
        return "\n".join(text)

    def read_text_file(self, file_path: str) -> str:
        """Read text file with encoding detection."""
        with open(file_path, 'rb') as f:
            raw = f.read()
            result = chardet.detect(raw)
            encoding = result['encoding'] or 'utf-8'
            return raw.decode(encoding, errors='ignore')

    def generate_embeddings(self, text: str) -> List[float]:
        """Generate vector embeddings using Azure OpenAI."""
        response = self.openai_client.embeddings.create(
            input=text,
            model="text-embedding-ada-002"
        )
        return response.data[0].embedding

    def process_file(self, file_path: str) -> List[Dict]:
        """
        Process file into chunks with embeddings.
        Returns list of documents ready for Azure AI Search.
        """
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.pdf':
            text = self.read_pdf(file_path)
        elif ext in ['.txt', '.md', '.csv', '.json']:
            text = self.read_text_file(file_path)
        else:
            raise ValueError(f"Unsupported file extension: {ext}")

        chunks = self.chunk_text(text)
        documents = []
        
        for i, chunk in enumerate(chunks):
            doc = {
                "id": f"{os.path.basename(file_path)}_{i}",
                "title": os.path.basename(file_path),
                "content": chunk,
                "content_vector": self.generate_embeddings(chunk)
            }
            documents.append(doc)
        
        return documents

    def create_index(self, vector_dimensions: int = 1536):
        """Create Azure AI Search index with vector support and binary quantization."""
        fields = [
            SimpleField(name="id", type=SearchFieldDataType.String, key=True),
            SearchableField(name="title", type=SearchFieldDataType.String),
            SearchableField(name="content", type=SearchFieldDataType.String),
            SearchField(
                name="content_vector",
                type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
                searchable=True,
                vector_search_dimensions=vector_dimensions,
                vector_search_profile_name="my-vector-profile"
            )
        ]

        vector_search = VectorSearch(
            profiles=[VectorSearchProfile(
                name="my-vector-profile",
                algorithm_configuration_name="my-algorithms-config"
            )],
            algorithms=[HnswAlgorithmConfiguration(
                name="my-algorithms-config",
                parameters={
                    "m": 4,
                    "efConstruction": 400,
                    "efSearch": 500,
                    "metric": "cosine"
                }
            )]
        )

        index = SearchIndex(
            name=self.index_name,
            fields=fields,
            vector_search=vector_search
        )

        try:
            self.index_client.create_index(index)
            print(f"Index {self.index_name} created successfully")
        except Exception as e:
            print(f"Error creating index: {e}")

    def upload_documents(self, documents: List[Dict]):
        """Upload processed documents to Azure AI Search."""
        try:
            result = self.search_client.upload_documents(documents=documents)
            print(f"Uploaded {len(documents)} documents")
            return result
        except Exception as e:
            print(f"Error uploading documents: {e}")
            return None

    def search(self, query: str, n: int = 3, oversampling: int = 10) -> str:
        """
        Perform hybrid search with semantic ranking and oversampling.
        Returns formatted results for RAG.
        """
        # Generate embedding for the query
        query_vector = self.generate_embeddings(query)
        
        results = self.search_client.search(
            search_text=query,
            query_type="semantic",
            semantic_configuration_name="my-semantic-config",
            select="title,content",
            top=n * oversampling,  # Oversample
            vector_queries=[{
                "text": query,
                "k_nearest_neighbors": n * oversampling,
                "fields": "content_vector",
                "exhaustive": True
            }]
        )
        
        # Process and rerank results
        response = ""
        print("\tGrounding on:")
        for r in results:
            score = r.get('@search.reranker_score', -1)
            response += f"[{r['title']}]: {r['content']}\n----\n"
            print(f"\t\t{r['title']} ({score}): {len(r['content'])} chars")
        
        return response