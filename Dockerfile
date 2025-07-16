# Base image
FROM python:3.10-slim

# Install system dependencies,  procps for pkill/pgrep, curl & Node.js for npm
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
    procps \
    curl \
    gnupg \
    python3-venv \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Copy all files into container
COPY . .

# Create backend/.env file
# Ensure backend and frontend folders exist
RUN mkdir -p /app/backend /app/frontend

# Create backend/.env
RUN printf "#Backend Configuration\n\
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
VECTOR_SEARCH_ENABLED=true\n\
VECTOR_SEARCH_ENDPOINT=https://ragaisearchrtx.search.windows.net\n\
VECTOR_SEARCH_KEY=96gVOBvNd67ykoDtaNhQEMeoQzYZ1sXtN31muEIyb0AzSeCPLRZH\n\
VECTOR_SEARCH_INDEX=your-search-index-name\n\
VECTOR_SEARCH_SEMANTIC_CONFIG=azureml-default\n\
VECTOR_SEARCH_EMBEDDING_DEPLOYMENT=text-embedding-ada-002\n\
VECTOR_SEARCH_EMBEDDING_ENDPOINT=https://openairtx.openai.azure.com/openai/deployments/text-embedding-ada-002/embeddings?api-version=2023-05-15\n\
VECTOR_SEARCH_EMBEDDING_KEY=7SJ0LLURzUFAfuWTHHTlehvpLtvfPZg3Piv4qgsaysIn9oPv7vA8JQQJ99BEACmepeSXJ3w3AAABACOGAEea\n\
# Storage for file upload\n\
VECTOR_SEARCH_STORAGE_ENDPOINT=\n\
VECTOR_SEARCH_STORAGE_ACCESS_KEY=\n\
VECTOR_SEARCH_STORAGE_CONNECTION_STRING=\n\
# Server Configuration\n\
HOST=0.0.0.0\n\
PORT=8000\n\
CORS_ORIGINS=http://localhost:3000,http://localhost:8000\n\
\n\
SYSTEM_PROMPT=\"You are an AI assistant. You aim to be helpful, honest, and direct in your interactions.\"\n" > /app/backend/.env

# Create frontend/.env
RUN printf "#Frontend Configuration\n\
REACT_APP_API_URL=http://localhost:8000\n\
REACT_APP_WS_URL=ws://localhost:8000/ws\n\
REACT_APP_LOGO=https://i.postimg.cc/WbZm1BK7/gitgpt.png\n\
REACT_APP_APP_NAME=AI Chat Assistant\n\
NODE_ENV=production\n\
REACT_APP_GPT_IMAGE_URL=https://gabz-mbtgx2um-westus3.cognitiveservices.azure.com/openai/deployments/gpt-image-1/images\n\
REACT_APP_GPT_IMAGE_KEY=6UR6v5uTDie85YAr8IM4CZ3FyxYB0RrFcsRVYgehEFmwOmPh41LaJQQJ99BFACMsfrFXJ3w3AAAAACOG7n60\n\
REACT_APP_GPT_IMAGE_VERSION=2025-04-01-preview\n" > /app/frontend/.env


# Ensure install.sh is executable
RUN chmod +x ./docker_install.sh

# Run install-only mode for dependency install
RUN ./docker_install.sh install-only

# Expose backend port
EXPOSE 8000 3000

RUN chmod +x ./docker_restart_services.sh
RUN chmod +x ./docker_refresh_github.sh

# Default run command
# Use restart_services.sh as the container's default command
CMD ["./docker_restart_services.sh"]
