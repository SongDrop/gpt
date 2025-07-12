import os
import json
from typing import List, Dict
from pathlib import Path
from datetime import datetime
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    SearchIndex, SimpleField, SearchFieldDataType,
    SearchableField, VectorSearchProfile,
    HnswAlgorithmConfiguration, VectorSearch,
    SearchField, SemanticConfiguration,
    SemanticPrioritizedFields, SemanticField
)
from azure.identity import DefaultAzureCredential
from openai import AzureOpenAI

class YouTubeRAGProcessor:
    def __init__(self, config: Dict):
        """Initialize with Azure AI Search and OpenAI configurations"""
        self.config = config
        self.credential = DefaultAzureCredential()
        
        # Initialize Azure OpenAI client
        self.openai_client = AzureOpenAI(
            api_version="2023-05-15",
            azure_endpoint=config["azure_openai_endpoint"],
            credential=self.credential
        )
        
        # Initialize Azure AI Search clients
        self.search_client = SearchClient(
            endpoint=config["azure_search_endpoint"],
            index_name=config["index_name"],
            credential=self.credential
        )
        self.index_client = SearchIndexClient(
            endpoint=config["azure_search_endpoint"],
            credential=self.credential
        )

    def create_youtube_index(self):
        """Create optimized index for YouTube video content"""
        fields = [
            SimpleField(name="id", type=SearchFieldDataType.String, key=True),
            SearchableField(name="video_id", type=SearchFieldDataType.String, filterable=True),
            SearchableField(name="title", type=SearchFieldDataType.String),
            SearchableField(name="description", type=SearchFieldDataType.String),
            SearchableField(name="transcript", type=SearchFieldDataType.String),
            SearchableField(name="summary", type=SearchFieldDataType.String),
            SearchableField(name="tags", type=SearchFieldDataType.Collection(SearchFieldDataType.String), filterable=True, facetable=True),
            SearchableField(name="upload_date", type=SearchFieldDataType.DateTimeOffset, filterable=True, sortable=True),
            SearchableField(name="duration", type=SearchFieldDataType.Int32, filterable=True),
            SearchableField(name="channel", type=SearchFieldDataType.String, filterable=True),
            SearchField(
                name="content_vector",
                type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
                searchable=True,
                vector_search_dimensions=1536,
                vector_search_profile_name="youtube-vector-profile"
            ),
            SearchField(
                name="title_vector",
                type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
                searchable=True,
                vector_search_dimensions=1536,
                vector_search_profile_name="youtube-vector-profile"
            )
        ]

        vector_search = VectorSearch(
            profiles=[VectorSearchProfile(
                name="youtube-vector-profile",
                algorithm_configuration_name="youtube-algo-config"
            )],
            algorithms=[HnswAlgorithmConfiguration(
                name="youtube-algo-config",
                parameters={
                    "m": 4,
                    "efConstruction": 400,
                    "efSearch": 500,
                    "metric": "cosine"
                }
            )]
        )

        semantic_config = SemanticConfiguration(
            name="youtube-semantic-config",
            prioritized_fields=SemanticPrioritizedFields(
                title_field=SemanticField(field_name="title"),
                content_fields=[SemanticField(field_name="transcript")],
                keywords_fields=[SemanticField(field_name="tags")]
            )
        )

        index = SearchIndex(
            name=self.config["index_name"],
            fields=fields,
            vector_search=vector_search,
            semantic_settings={"configurations": [semantic_config]}
        )

        try:
            self.index_client.create_or_update_index(index)
            print(f"Index {self.config['index_name']} created/updated successfully")
        except Exception as e:
            print(f"Error creating index: {e}")
            raise

    def process_video_metadata(self, metadata_file: str) -> Dict:
        """Process a single video metadata JSON file"""
        with open(metadata_file, 'r', encoding='utf-8') as f:
            meta_data = json.load(f)
        
        # Generate embeddings for both content and title
        transcript = self._get_transcript_text(meta_data)
        embeddings = self._generate_embeddings_batch(
            texts=[transcript, meta_data.get("title", "")],
            model="text-embedding-ada-002"
        )
        
        # Convert tags from string to list if needed
        tags = meta_data.get("tags", [])
        if isinstance(tags, str):
            tags = [tag.strip() for tag in tags.split(",") if tag.strip()]
        
        # Prepare the document for Azure AI Search
        document = {
            "id": meta_data["video_id"],
            "video_id": meta_data["video_id"],
            "title": meta_data.get("title", ""),
            "description": meta_data.get("description", ""),
            "transcript": transcript,
            "summary": meta_data.get("summary", ""),
            "tags": tags,
            "upload_date": datetime.now().isoformat() + "Z",  # Current time if not available
            "duration": meta_data.get("duration", 0),
            "channel": meta_data.get("channel", "unknown"),
            "content_vector": embeddings[0],  # Transcript embedding
            "title_vector": embeddings[1]     # Title embedding
        }
        
        return document

    def _get_transcript_text(self, meta_data: Dict) -> str:
        """Extract transcript text from metadata"""
        if "transcript_string" in meta_data:
            transcript_file = os.path.join(
                os.path.dirname(meta_data["transcript_string"]),
                meta_data["transcript_string"]
            )
            if os.path.exists(transcript_file):
                with open(transcript_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        
        # Fallback to concatenating timestamped transcript
        if "transcript_timestamp" in meta_data:
            transcript_file = os.path.join(
                os.path.dirname(meta_data["transcript_timestamp"]),
                meta_data["transcript_timestamp"]
            )
            if os.path.exists(transcript_file):
                with open(transcript_file, 'r', encoding='utf-8') as f:
                    transcript_json = json.load(f)
                    return " ".join([item["text"] for item in transcript_json])
        
        return ""

    def _generate_embeddings_batch(self, texts: List[str], model: str) -> List[List[float]]:
        """Generate embeddings for a batch of texts"""
        try:
            response = self.openai_client.embeddings.create(
                input=texts,
                model=model
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            print(f"Error generating embeddings: {e}")
            raise

    def upload_video_batch(self, metadata_files: List[str], batch_size: int = 10):
        """Process and upload a batch of video metadata files"""
        documents = []
        
        for i, meta_file in enumerate(metadata_files):
            try:
                print(f"Processing {i+1}/{len(metadata_files)}: {meta_file}")
                document = self.process_video_metadata(meta_file)
                documents.append(document)
                
                # Upload in batches
                if len(documents) >= batch_size:
                    self._upload_documents(documents)
                    documents = []
            
            except Exception as e:
                print(f"Error processing {meta_file}: {e}")
                continue
        
        # Upload any remaining documents
        if documents:
            self._upload_documents(documents)

    def _upload_documents(self, documents: List[Dict]):
        """Upload documents to Azure AI Search"""
        try:
            result = self.search_client.upload_documents(documents=documents)
            print(f"Uploaded {len(documents)} documents successfully")
            return result
        except Exception as e:
            print(f"Error uploading documents: {e}")
            raise

    def find_metadata_files(self, root_dir: str) -> List[str]:
        """Recursively find all _meta_data.json files in directory"""
        metadata_files = []
        
        for root, _, files in os.walk(root_dir):
            for file in files:
                if file.endswith('_meta_data.json'):
                    metadata_files.append(os.path.join(root, file))
        
        return metadata_files

    def process_directory(self, directory: str):
        """Process all videos in a directory"""
        metadata_files = self.find_metadata_files(directory)
        print(f"Found {len(metadata_files)} metadata files to process")
        
        if not metadata_files:
            print("No metadata files found. Nothing to process.")
            return
        
        # Create or update the index
        self.create_youtube_index()
        
        # Process and upload all videos
        self.upload_video_batch(metadata_files)
        
        print("Processing completed successfully")

# Example usage
if __name__ == "__main__":
    config = {
        "azure_openai_endpoint": "your-azure-openai-endpoint",
        "azure_search_endpoint": "your-azure-search-endpoint",
        "index_name": "youtube-videos-index"
    }
    
    processor = YouTubeRAGProcessor(config)
    
    # Point to your directory containing the downloaded videos and metadata
    videos_directory = "path/to/your/downloaded/videos"
    processor.process_directory(videos_directory)