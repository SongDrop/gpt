from dotenv import load_dotenv
from pathlib import Path
import os
# Load early before anything else
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

from typing import Optional, List, Union, Dict, Any
from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator, ValidationInfo
from pydantic_settings import BaseSettings, SettingsConfigDict
from urllib.parse import urlparse as URL
from functools import lru_cache
import logging

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
logger.info("Starting configutation initialization...")

# Make sure logging is configured
env_path = Path(__file__).parent / ".env"  # .env in same folder as config.py
env_file = str(env_path.resolve())
if env_path.is_file():
    logger.info(f".env file found at: {env_path.resolve()}")
else:
    logger.warning(f".env file NOT found at expected location: {env_path.resolve()}")
logger.info(f"Working directory: {os.getcwd()}")
logger.info(f".env path resolved: {env_file}")
logger.info(f".env exists: {Path(env_file).is_file()}")

def parse_cors_origins(v: Union[str, List[str]]) -> List[str]:
    """Parse CORS origins from string or list"""
    if isinstance(v, str):
        # Split by comma and clean up each URL
        origins = [origin.strip() for origin in v.split(",")]
        # Filter out empty strings
        origins = [origin for origin in origins if origin]
        # Add secure variants if needed
        expanded_origins = []
        for origin in origins:
            expanded_origins.append(origin)
            # Add https variant if http is specified
            if origin.startswith("http://"):
                expanded_origins.append(origin.replace("http://", "https://"))
            # Add azurestaticapps.net variants
            if "azurestaticapps.net" in origin:
                base_domain = origin.split("://")[1].split(".azurestaticapps.net")[0]
                expanded_origins.append(f"https://{base_domain}.azurestaticapps.net")
                expanded_origins.append(f"http://{base_domain}.azurestaticapps.net")
        return list(set(expanded_origins))
    elif isinstance(v, list):
        return v
    raise ValueError("CORS_ORIGINS must be a string or list")

class Settings(BaseSettings):
    """Main application settings"""
    model_config = SettingsConfigDict(
        env_file=env_file,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        env_prefix="",  # no prefix
    )

    # Basic configuration
    app_name: str = Field(default="AI Chat Assistant")
    environment: str = Field(default="production")
    debug: bool = Field(default=False)
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)

    # CORS configuration
    cors_origins: Union[str, List[str]] = Field(
        default=["http://localhost:3000","http://localhost:8000", "https://*.azurestaticapps.net"],
        description="Allowed CORS origins as comma-separated string or list"
    )

    # OpenAI configuration
    openai_api_key: str = Field(...)
    openai_api_base: HttpUrl = Field(...)
    openai_api_version: str = Field(default="2024-05-01-preview")
    openai_deployment_name: str = Field(...)
    openai_temperature: float = Field(default=0.7)
    openai_max_tokens: int = Field(default=4000)
    openai_top_p: float = Field(default=0.95)
    openai_frequency_penalty: float = Field(default=0)
    openai_presence_penalty: float = Field(default=0)
    
    # Vector Search configuration
    vector_search_enabled: bool = Field(default=False)
    vector_search_endpoint: Optional[HttpUrl] = None
    vector_search_key: Optional[str] = None
    vector_search_index: Optional[str] = None
    vector_search_semantic_config: str = Field(default="azureml-default")
    vector_search_embedding_deployment: str = Field(default="text-embedding-ada-002")
    vector_search_embedding_key: Optional[str] = None

    # System configuration
    system_prompt: str = Field(
        default=os.environ.get('SYSTEM_PROMPT')
    )

    @field_validator('cors_origins')
    def validate_cors_origins(cls, v):
        return parse_cors_origins(v)

    @model_validator(mode='after')
    def validate_vector_search_config(self) -> 'Settings':
        """Validate vector search configuration after all fields are loaded"""
        # Convert string to boolean if needed
        if isinstance(self.vector_search_enabled, str):
            self.vector_search_enabled = self.vector_search_enabled.lower() == 'true'
        
        if not self.vector_search_enabled:
            return self

        logger.info("Final vector search configuration check:")
        logger.info(f"Vector Search Enabled: {self.vector_search_enabled}")
        logger.info(f"Vector Search Endpoint: {self.vector_search_endpoint}")
        logger.info(f"Vector Search Key: {'***' + self.vector_search_key[-4:] if self.vector_search_key else 'None'}")
        logger.info(f"Vector Search Index: {self.vector_search_index}")
        
        # Check required fields
        required_fields = {
            'vector_search_endpoint': self.vector_search_endpoint,
            'vector_search_key': self.vector_search_key,
            'vector_search_index': self.vector_search_index
        }
        
        missing = [field for field, value in required_fields.items() 
                  if value is None or str(value).strip() == '']
        
        if missing:
            logger.warning(
                f"Vector search is enabled but missing required fields: {', '.join(missing)}. "
                "Disabling vector search functionality."
            )
            self.vector_search_enabled = False

        return self

    def model_post_init(self, _context):
        """Log loaded configuration for debugging"""
        logger.info("Loaded configuration:")
        logger.info(f"App Name: {self.app_name}")
        logger.info(f"Environment: {self.environment}")
        logger.info(f"CORS Origins: {self.cors_origins}")
        logger.info(f"Vector Search Enabled: {self.vector_search_enabled}")
        logger.info(f"Vector Search Endpoint: {self.vector_search_endpoint}")
        logger.info(f"Vector Search Key: {'***' + self.vector_search_key[-4:] if self.vector_search_key else 'None'}")
        logger.info(f"Vector Search Index: {self.vector_search_index}")
        logger.info(f"Vector Search Embedding Deployment: {self.vector_search_embedding_deployment}")
        logger.info(f"Vector Search Embedding Key: {'***' + self.vector_search_embedding_key[-4:] if self.vector_search_embedding_key else 'None'}")

        if self.vector_search_enabled:
            logger.info("Vector search is enabled")
        else:
            logger.info("Vector search is disabled")

# Create settings instance
@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    logger.info("Loading settings...")
    try:
        return Settings()
    except Exception as e:
        logger.error(f"Error loading settings: {str(e)}")
        raise

# Initialize settings once at module level
settings = get_settings()