import os
import json
from azure.identity import DefaultAzureCredential
from azure.search.documents import SearchClient
from openai import AzureOpenAI

class YoutubeRAGIngestor:
    def __init__(self, azure_openai_endpoint, azure_search_endpoint, index_name):
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
    
    def load_json_files(self, directory):
        json_files = [os.path.join(directory, f) for f in os.listdir(directory) if f.endswith('_meta_data.json')]
        documents = []
        for file_path in json_files:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                documents.append(data)
        return documents
    
    def create_documents_for_search(self, docs):
        search_docs = []
        for doc in docs:
            # Choose text to embed - transcript string or summary preferred
            text_to_embed = doc.get("transcript_string") or doc.get("summary") or doc.get("title") or ""
            if not text_to_embed.strip():
                continue
            
            # Generate embedding vector
            response = self.openai_client.embeddings.create(
                input=text_to_embed,
                model="text-embedding-ada-002"
            )
            embedding = response.data[0].embedding
            
            # Compose search document
            search_doc = {
                "id": doc.get("video_id"),
                "title": doc.get("title"),
                "transcript": doc.get("transcript_string", ""),
                "summary": doc.get("summary", ""),
                "tags": doc.get("tags", []),
                "content_vector": embedding
            }
            search_docs.append(search_doc)
        return search_docs
    
    def upload_documents(self, documents):
        try:
            result = self.search_client.upload_documents(documents=documents)
            print(f"Uploaded {len(documents)} documents.")
            return result
        except Exception as e:
            print(f"Error uploading documents: {e}")
    
    def ingest_folder(self, folder_path):
        docs = self.load_json_files(folder_path)
        print(f"Loaded {len(docs)} documents from {folder_path}")
        search_docs = self.create_documents_for_search(docs)
        self.upload_documents(search_docs)