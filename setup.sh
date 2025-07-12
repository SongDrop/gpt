#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}Setting up AI Chat Assistant with SSL support and auto-renewal...${NC}"

# Function to prompt and read env variables safely
prompt_env_var() {
  local var_name=$1
  local prompt_text=$2
  local default_value=$3
  local user_input

  if [ -z "$default_value" ]; then
    read -rp "$prompt_text: " user_input
  else
    read -rp "$prompt_text [$default_value]: " user_input
    user_input=${user_input:-$default_value}
  fi

  echo "$user_input"
}

# --- Setup backend/.env ---
echo -e "${GREEN}Configuring backend environment variables...${NC}"

OPENAI_API_BASE=$(prompt_env_var "OPENAI_API_BASE" "Enter OpenAI API Base URL (e.g. https://your-resource.openai.azure.com)")
OPENAI_API_KEY=$(prompt_env_var "OPENAI_API_KEY" "Enter OpenAI API Key")
OPENAI_DEPLOYMENT_NAME=$(prompt_env_var "OPENAI_DEPLOYMENT_NAME" "Enter OpenAI Deployment Name (e.g. gpt-4o)")
OPENAI_API_VERSION=$(prompt_env_var "OPENAI_API_VERSION" "Enter OpenAI API Version (e.g. 2023-05-15)" "2023-05-15")
APP_NAME=$(prompt_env_var "APP_NAME" "Enter your App name" "AI Chat Assistant")
ENVIRONMENT=$(prompt_env_var "ENVIRONMENT" "Enter environment (production/development)" "production")
CORS_ORIGINS=$(prompt_env_var "CORS_ORIGINS" "Enter CORS Origins (frontend URLs, comma separated)" "http://localhost:3000")

cat > ./backend/.env <<EOF
OPENAI_API_BASE=$OPENAI_API_BASE
OPENAI_API_KEY=$OPENAI_API_KEY
OPENAI_DEPLOYMENT_NAME=$OPENAI_DEPLOYMENT_NAME
OPENAI_API_VERSION=$OPENAI_API_VERSION
APP_NAME=$APP_NAME
ENVIRONMENT=$ENVIRONMENT
CORS_ORIGINS=$CORS_ORIGINS
EOF

echo -e "${GREEN}backend/.env created.${NC}"

# --- Setup frontend/.env.development ---
echo -e "${GREEN}Configuring frontend development environment variables...${NC}"

REACT_APP_API_URL=$(prompt_env_var "REACT_APP_API_URL" "Enter Backend API URL for development" "http://localhost:8000")
REACT_APP_WS_URL=$(prompt_env_var "REACT_APP_WS_URL" "Enter Backend WebSocket URL for development" "ws://localhost:8000/ws")
REACT_APP_LOGO=$(prompt_env_var "APP_LOGO" "Enter your Logo URL" "https://i.postimg.cc/C53CqTfx/chatgpt.png")

cat > ./frontend/.env.development <<EOF
REACT_APP_API_URL=$REACT_APP_API_URL
REACT_APP_WS_URL=$REACT_APP_WS_URL
REACT_APP_LOGO=$REACT_APP_LOGO

EOF

echo -e "${GREEN}frontend/.env.development created.${NC}"

# --- Setup frontend/.env.production ---
echo -e "${GREEN}Configuring frontend production environment variables...${NC}"

# Prompt for your domain name for SSL and hosting
DOMAIN=$(prompt_env_var "DOMAIN" "Enter your domain name for SSL (e.g. chat.example.com)")

REACT_APP_API_URL_PROD="https://$DOMAIN"
REACT_APP_WS_URL_PROD="wss://$DOMAIN/ws"

cat > ./frontend/.env.production <<EOF
REACT_APP_API_URL=$REACT_APP_API_URL_PROD
REACT_APP_WS_URL=$REACT_APP_WS_URL_PROD
REACT_APP_LOGO=$REACT_APP_LOGO
EOF

echo -e "${GREEN}frontend/.env.production created.${NC}"

# --- Install system dependencies for SSL, Nginx, and cron ---
echo -e "${GREEN}Installing system dependencies (certbot, nginx, python3-certbot-nginx, cron)...${NC}"
sudo apt-get update
sudo apt-get install -y certbot nginx python3-certbot-nginx cron

# --- Obtain SSL certificate using Certbot ---
echo -e "${GREEN}Obtaining SSL certificate for $DOMAIN...${NC}"

# Stop Nginx if running to free port 80 for certbot standalone
sudo systemctl stop nginx

# Obtain cert with standalone mode
sudo certbot certonly --standalone --non-interactive --agree-tos --email your-email@example.com -d "$DOMAIN"
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to obtain SSL certificate for $DOMAIN. Please check domain DNS and ports.${NC}"
  exit 1
fi

echo -e "${GREEN}SSL certificate obtained successfully.${NC}"

# --- Configure Nginx for reverse proxy with SSL ---
echo -e "${GREEN}Configuring Nginx for SSL reverse proxy...${NC}"

NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"

sudo tee $NGINX_CONF > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/$DOMAIN/chain.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:8000;  # your backend running on 8000
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site & disable default
sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx config and restart
sudo nginx -t && sudo systemctl restart nginx

echo -e "${GREEN}Nginx configured and restarted.${NC}"

# --- Setup Python virtual environment and install requirements ---
echo -e "${GREEN}Setting up Python virtual environment and installing backend dependencies...${NC}"
python3 -m venv backend/venv
source backend/venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
deactivate

# --- Install frontend dependencies ---
echo -e "${GREEN}Installing frontend dependencies...${NC}"
cd frontend || exit
npm install
cd ..

# --- Setup automatic Certbot renewal ---
echo -e "${GREEN}Setting up automatic Certbot renewal...${NC}"

sudo bash -c 'echo "0 3,15 * * * root certbot renew --quiet --renew-hook \"systemctl reload nginx\"" > /etc/cron.d/certbot-renew'

# Enable and start cron service
sudo systemctl enable cron
sudo systemctl start cron

echo -e "${GREEN}Certbot automatic renewal cron job installed.${NC}"

echo -e "${BLUE}Setup complete!${NC}"
echo -e "${GREEN}To start development:${NC}"
echo "1. Start backend: cd backend && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000"
echo "2. Start frontend: cd frontend && npm start"
echo ""
echo -e "${GREEN}To run backend in production behind Nginx SSL proxy:${NC}"
echo "1. Start backend: cd backend && source venv/bin/activate && uvicorn main:app --host 127.0.0.1 --port 8000"
echo "2. Ensure ports 80 and 443 are open in Azure NSG and Ubuntu firewall"
echo ""
echo -e "${GREEN}You can test certificate renewal manually with:${NC}"
echo "sudo certbot renew --dry-run"