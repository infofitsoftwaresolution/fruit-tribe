#!/usr/bin/env bash
set -euo pipefail

: "${APP_DIR:?APP_DIR is required}"
: "${SERVER_NAME:?SERVER_NAME is required}"
: "${BACKEND_PORT:?BACKEND_PORT is required}"

PM2_APP_NAME="${PM2_APP_NAME:-fruittribe-backend}"
NGINX_CONF_NAME="${NGINX_CONF_NAME:-fruittribe}"

echo "==> Deploying from $APP_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is not installed on server"
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "==> Installing PM2"
  sudo npm i -g pm2
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "==> Installing Nginx"
  sudo apt-get update -y
  sudo apt-get install -y nginx
fi

echo "==> Build frontend"
cd "$APP_DIR"
npm ci
npm run build

echo "==> Build backend"
cd "$APP_DIR/backend"
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build

echo "==> Restart backend with PM2"
pm2 delete "$PM2_APP_NAME" >/dev/null 2>&1 || true
pm2 start dist/main.js --name "$PM2_APP_NAME"
pm2 save

echo "==> Write Nginx config"
sudo tee "/etc/nginx/sites-available/${NGINX_CONF_NAME}" >/dev/null <<EOF
server {
    listen 80;
    server_name ${SERVER_NAME};

    root ${APP_DIR}/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /v1/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/v1/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
}
EOF

sudo ln -sf "/etc/nginx/sites-available/${NGINX_CONF_NAME}" "/etc/nginx/sites-enabled/${NGINX_CONF_NAME}"
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

echo "==> Deployment complete"
echo "URL: http://${SERVER_NAME}"
