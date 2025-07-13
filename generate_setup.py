def generate_setup(
    DOMAIN_NAME,
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    PORT,
):
    # ========== CONFIGURABLE URLs ==========
    gpt_repo = "https://github.com/SongDrop/gpt.git"
    letsencrypt_options_url = "https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf"
    ssl_dhparams_url = "https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem"
    # =======================================
    MAX_UPLOAD_FILE_SIZE_IN_MB = 1024
    INSTALL_DIR = "/opt/gpt"
    LOG_DIR = f"{INSTALL_DIR}/logs"

    script_template = f"""#!/bin/bash

set -e

# Validate domain
if ! [[ "{DOMAIN_NAME}" =~ ^[a-zA-Z0-9.-]+\\.[a-zA-Z]{{2,}}$ ]]; then
    echo "ERROR: Invalid domain format"
    exit 1
fi

# Configuration
DOMAIN_NAME="{DOMAIN_NAME}"
PORT="{PORT}"
INSTALL_DIR="{INSTALL_DIR}"
LOG_DIR="{LOG_DIR}"
GPT_REPO="{gpt_repo}"

# ========== SYSTEM SETUP ==========
echo "[1/9] System updates and dependencies..."
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \\
    curl git nginx certbot \\
    python3-pip python3-venv jq make net-tools \\
    python3-certbot-nginx \\
    nodejs npm

# Install Node.js 16 if not available
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1)" != "v16" ]; then
    echo "Installing Node.js 16..."
    curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
    apt-get install -y nodejs
fi

# ========== REPOSITORY SETUP ==========
echo "[2/9] Setting up GPT repository..."
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

if [ -d ".git" ]; then
    echo "Existing repository found, pulling latest changes..."
    git pull
elif [ -z "$(ls -A .)" ]; then
    echo "Cloning fresh repository..."
    git clone "$GPT_REPO" .
else
    echo "Directory not empty and not a git repo. Moving contents to backup..."
    mkdir -p ../gpt_backup
    mv * ../gpt_backup/ || true
    git clone "$GPT_REPO" .
fi

# Install git-lfs if needed
if ! command -v git-lfs &> /dev/null; then
    echo "Installing git-lfs..."
    apt-get install -y git-lfs
    git lfs install
fi

# ========== FRONTEND SETUP ==========
echo "[3/9] Setting up frontend..."
cd "$INSTALL_DIR/frontend" || {{ echo "❌ Frontend directory not found"; exit 1; }}

# Cleanup previous installations
rm -rf node_modules package-lock.json .cache .parcel-cache dist

# Install dependencies
echo "Installing frontend dependencies..."
npm cache clean --force
npm install --force
npm dedupe

# Fix html-webpack-plugin compatibility
echo "Fixing html-webpack-plugin..."
npm uninstall html-webpack-plugin
npm install html-webpack-plugin@5.6.3 --save-dev --legacy-peer-deps

# Create loader.js if missing
if [ ! -f "node_modules/html-webpack-plugin/lib/loader.js" ]; then
    echo "Creating missing loader.js file..."
    mkdir -p node_modules/html-webpack-plugin/lib
    echo "module.exports = require('./lib');" > node_modules/html-webpack-plugin/lib/loader.js
fi

# ========== BACKEND SETUP ==========
echo "[4/9] Setting up backend..."
cd "$INSTALL_DIR/backend" || {{ echo "❌ Backend directory not found"; exit 1; }}

# Cleanup previous installations
rm -rf venv

# Create fresh virtual environment
echo "Creating virtual environment..."
python3 -m venv --upgrade-deps venv
source venv/bin/activate

echo "Upgrading pip and installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Ensure uvicorn is installed
if ! command -v uvicorn &> /dev/null; then
    echo "Installing uvicorn..."
    pip install "uvicorn[standard]"
fi

# ========== LOGS DIRECTORY ==========
echo "[5/9] Creating logs directory..."
mkdir -p "$LOG_DIR"

# ========== NETWORK SECURITY ==========
echo "[6/9] Configuring firewall..."
ufw allow 22,80,443,{PORT}/tcp
ufw --force enable

# ========== SSL CERTIFICATE ==========
echo "[7/9] Setting up SSL certificate..."

# Download Let's Encrypt configuration files
mkdir -p /etc/letsencrypt
curl -s "{letsencrypt_options_url}" > /etc/letsencrypt/options-ssl-nginx.conf
curl -s "{ssl_dhparams_url}" > /etc/letsencrypt/ssl-dhparams.pem

certbot --nginx -d "{DOMAIN_NAME}" --non-interactive --agree-tos --email "{ADMIN_EMAIL}" --redirect

# ========== NGINX CONFIG ==========
echo "[8/9] Configuring Nginx..."

# Remove default Nginx config
rm -f /etc/nginx/sites-enabled/default

# Create GPT config
cat > /etc/nginx/sites-available/gpt <<EOF
map \$http_upgrade \$connection_upgrade {{
    default upgrade;
    '' close;
}}

server {{
    listen 80;
    server_name {DOMAIN_NAME};
    return 301 https://\$host\$request_uri;
}}

server {{
    listen 443 ssl http2;
    server_name {DOMAIN_NAME};

    ssl_certificate /etc/letsencrypt/live/{DOMAIN_NAME}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{DOMAIN_NAME}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size {MAX_UPLOAD_FILE_SIZE_IN_MB}M;
        
    location / {{
        proxy_pass http://localhost:{PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_request_buffering off;
    }}
}}
EOF

ln -sf /etc/nginx/sites-available/gpt /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# ========== SERVICE MANAGEMENT ==========
echo "[9/9] Setting up system services..."

# Create systemd service for backend
cat > /etc/systemd/system/gpt-backend.service <<EOF
[Unit]
Description=GPT Backend Service
After=network.target

[Service]
User=root
WorkingDirectory={INSTALL_DIR}/backend
Environment="PATH={INSTALL_DIR}/backend/venv/bin"
ExecStart={INSTALL_DIR}/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port {PORT}
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Create systemd service for frontend
cat > /etc/systemd/system/gpt-frontend.service <<EOF
[Unit]
Description=GPT Frontend Service
After=network.target

[Service]
User=root
WorkingDirectory={INSTALL_DIR}/frontend
Environment="PATH=/usr/bin:/usr/local/bin"
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Enable and start services
systemctl daemon-reload
systemctl enable gpt-backend gpt-frontend
systemctl start gpt-backend gpt-frontend

# ========== VERIFICATION ==========
echo "Verifying setup..."

# Verify services are running
if ! systemctl is-active --quiet gpt-backend; then
    echo "ERROR: Backend service is not running!"
    journalctl -u gpt-backend -b --no-pager
    exit 1
fi

if ! systemctl is-active --quiet gpt-frontend; then
    echo "ERROR: Frontend service is not running!"
    journalctl -u gpt-frontend -b --no-pager
    exit 1
fi

# Verify Nginx config
if ! nginx -t; then
    echo "ERROR: Nginx configuration test failed"
    exit 1
fi

# Verify SSL certificate
if [ ! -f "/etc/letsencrypt/live/{DOMAIN_NAME}/fullchain.pem" ]; then
    echo "ERROR: SSL certificate not found!"
    exit 1
fi

echo "============================================"
echo "✅ GPT Setup Complete!"
echo ""
echo "🔗 Access: https://{DOMAIN_NAME}"
echo ""
echo "⚙️ Service Status:"
echo "   - Backend: systemctl status gpt-backend"
echo "   - Frontend: systemctl status gpt-frontend"
echo "   - Nginx: systemctl status nginx"
echo ""
echo "📜 Logs:"
echo "   - Backend: journalctl -u gpt-backend -f"
echo "   - Frontend: journalctl -u gpt-frontend -f"
echo "   - Nginx: journalctl -u nginx -f"
echo ""
echo "⚠️ Important:"
echo "1. First-time setup may require visiting https://{DOMAIN_NAME} to complete installation"
echo "2. To update: cd {INSTALL_DIR} && git pull && systemctl restart gpt-backend gpt-frontend"
echo "============================================"
"""
    return script_template