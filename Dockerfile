# Base image
FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    libffi-dev \
    libssl-dev \
    libjpeg-dev \
    libxml2-dev \
    libxslt1-dev \
    libpq-dev \
    libmagic-dev \
    poppler-utils \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Copy all files into container
COPY . .

# Create backend/.env
RUN echo "\
# Application Configuration\n\
APP_NAME=AI Chat Assistant\n\
ENVIRONMENT=production\n\
# OpenAI API Configuration\n\
OPENAI_API_BASE=https://gabz-mb97c15u-swedencentral.cognitiveservices.azure.com/openai/deployments/gpt-4.1-mini/chat/completions?api-version=2025-01-01-preview\n\
OPENAI_API_KEY=2uuCuqEe3xwrsCsuOWHrsnrznxN2bZKSHMABGevRmN6KtIZgYfaVJQQJ99BEACfhMk5XJ3w3AAAAACOGHc9F\n\
OPENAI_DEPLOYMENT_NAME=gpt-4.1-mini\n\
OPENAI_API_VERSION=2023-05-15\n\
CORS_ORIGINS=http://localhost:3000\n\
OPENAI_TEMPERATURE=0.7\n\
OPENAI_MAX_TOKENS=4000\n\
OPENAI_TOP_P=0.95\n\
OPENAI_FREQUENCY_PENALTY=0\n\
OPENAI_PRESENCE_PENALTY=0\n\
# Vector Search Configuration\n\
VECTOR_SEARCH_ENABLED=false\n\
VECTOR_SEARCH_ENDPOINT=https://ragaisearchrtx.search.windows.net\n\
VECTOR_SEARCH_KEY=96gVOBvNd67ykoDtaNhQEMeoQzYZ1sXtN31muEIyb0AzSeCPLRZH\n\
VECTOR_SEARCH_INDEX=your-search-index-name\n\
VECTOR_SEARCH_SEMANTIC_CONFIG=azureml-default\n\
VECTOR_SEARCH_EMBEDDING_DEPLOYMENT=text-embedding-ada-002\n\
# Vector Search Storage\n\
VECTOR_SEARCH_STORAGE_ENDPOINT=\n\
# Server Configuration\n\
HOST=0.0.0.0\n\
PORT=8000\n\
CORS_ORIGINS=http://localhost:3000,http://localhost:8000\n\
\n\
SYSTEM_PROMPT=\"You are an AI assistant. You aim to be helpful, honest, and direct in your interactions.\"\n\
" > backend/.env

# Create frontend/.env
RUN echo "\
REACT_APP_API_URL=http://localhost:8000\n\
REACT_APP_WS_URL=ws://localhost:8000/ws\n\
NODE_ENV=production\n\
REACT_APP_GPT_IMAGE_URL=https://gabz-mbtgx2um-westus3.cognitiveservices.azure.com/openai/deployments/gpt-image-1/images\n\
REACT_APP_GPT_IMAGE_KEY=6UR6v5uTDie85YAr8IM4CZ3FyxYB0RrFcsRVYgehEFmwOmPh41LaJQQJ99BFACMsfrFXJ3w3AAAAACOG7n60\n\
REACT_APP_GPT_IMAGE_VERSION=2025-04-01-preview\n\
" > frontend/.env

# Ensure install.sh is executable
RUN chmod +x ./install.sh

# Run install-only mode for dependency install
RUN ./install.sh install-only

# Expose backend port
EXPOSE 3000

# Default run command
CMD ["./install.sh"]
