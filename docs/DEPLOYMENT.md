# Production deployment (GitHub Actions + EC2)

## Domain and SSL: thefruittribe.com

The app is set up to serve **https://thefruittribe.com** and **https://www.thefruittribe.com** with automatic SSL via Let's Encrypt (Certbot).

**Use the full domain:** always open **https://thefruittribe.com** or **https://www.thefruittribe.com** (with `.com`). Using `https://thefruittribe` (no `.com`) will cause `ERR_SSL_UNRECOGNIZED_NAME_ALERT` because that is not a valid hostname for the certificate.

### GitHub Secrets (required for domain + SSL)

In **GitHub → repo → Settings → Secrets and variables → Actions**, set:

| Secret | Description |
|--------|-------------|
| `SERVER_DOMAIN` | **`thefruittribe.com`** (apex only, no `www`) so the workflow uses HTTPS and Nginx serves both `thefruittribe.com` and `www.thefruittribe.com`. |
| `EC2_HOST` | Your server hostname or IP (e.g. EC2 public IP or thefruittribe.com if DNS points to this server). |
| `EC2_USERNAME` | SSH user (e.g. `ubuntu`). |
| `EC2_SSH_PRIVATE_KEY` | Full private key for SSH. |
| `DATABASE_URL` | PostgreSQL connection string. |
| `JWT_SECRET` | Secret for JWT signing. |
| `LETSENCRYPT_EMAIL` | (Optional) Email for Let's Encrypt (e.g. `admin@thefruittribe.com`). Defaults to `admin@thefruittribe.com` if not set. |

### DNS

Point both to your EC2/server IP:

- **A** `thefruittribe.com` → your server IP  
- **A** `www.thefruittribe.com` → your server IP  

(or CNAME `www` → `thefruittribe.com`)

### What the workflow does

1. Builds frontend with relative API base `/api/v1` (no mixed content on HTTPS).
2. Deploys to the server and sets **ALLOWED_ORIGINS** to `https://thefruittribe.com,https://www.thefruittribe.com`.
3. When `SERVER_DOMAIN` is set and no SSL cert exists yet:
   - Writes Nginx HTTP config for `thefruittribe.com` and `www.thefruittribe.com`.
   - Runs **Certbot** (Let's Encrypt) to obtain a certificate for both names.
   - Writes Nginx HTTPS config and redirects HTTP → HTTPS.
4. If the cert already exists (e.g. after first run), it only writes the HTTPS config.

**Certificate paths:** The workflow uses **only Let's Encrypt** paths (`/etc/letsencrypt/live/$DOMAIN/fullchain.pem` and `privkey.pem`). It does not use self-signed certs from `/etc/pki/nginx/`.

### First-time SSL

On the first deploy with `SERVER_DOMAIN=thefruittribe.com` and DNS already pointing to the server, the workflow will:

1. Install Certbot if needed.
2. Use the webroot at `frontend-dist` and the `/.well-known/acme-challenge/` location to complete the HTTP-01 challenge.
3. Write the SSL paths into Nginx and reload.

After that, renewals are usually handled by a cron job (e.g. `certbot renew`). You can add on the server:

```bash
# Optional: renew certs (run weekly via cron)
sudo certbot renew --quiet
sudo systemctl reload nginx
```

### Razorpay / mixed content

With the domain and SSL in place:

- Site is served over **HTTPS**.
- API and assets use the same origin (`/api/v1`, relative URLs), so payment verification and Razorpay work without mixed-content issues.

In the **Razorpay Dashboard**, set:

- Webhook URL: `https://thefruittribe.com/api/...` (or your actual webhook path).
- No `localhost` or `http://` URLs in production.

---

## Troubleshooting: "Refused to connect" (ERR_CONNECTION_REFUSED)

If **https://thefruittribe.com** shows "refused to connect", the browser cannot reach your server. Check these in order:

### 1. Open ports 80 and 443 (most common cause)

**EC2 Security Group** must allow inbound traffic:

1. AWS Console → **EC2** → **Security Groups** → select the group attached to your instance.
2. **Edit inbound rules** → **Add rule**:
   - **Type:** HTTP → **Port:** 80 → **Source:** 0.0.0.0/0 (or "Anywhere IPv4").
   - **Type:** HTTPS → **Port:** 443 → **Source:** 0.0.0.0/0.
3. Save. Wait a few seconds and try **https://thefruittribe.com** again.

Without these rules, all traffic on 80/443 is blocked and you get "connection refused".

### 2. EC2 instance is running

- EC2 → **Instances** → your instance → **State** should be **Running**.
- If it was stopped, start it and note the **Public IPv4 address** (it may change unless you use an Elastic IP).

### 3. DNS points to the correct IP

- Your **A** records for `thefruittribe.com` and `www.thefruittribe.com` must point to the **Public IPv4** of your EC2 instance.
- Check: run `ping thefruittribe.com` or `nslookup thefruittribe.com` and confirm the IP matches your EC2 public IP.

### 4. Deploy has run successfully

- GitHub → **Actions** → latest "Deploy to Production" run → should be **green**.
- If it failed, fix the errors (e.g. secrets, SSH key) and re-run.

### 5. Check the server (if you can SSH)

```bash
# Nginx listening on 80 (and 443 if SSL is set up)
sudo systemctl status nginx
sudo ss -tlnp | grep -E ':80|:443'

# Backend API
pm2 status
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/v1
```

- If Nginx is not running: `sudo systemctl start nginx && sudo systemctl enable nginx`.
- If the API is down: `cd ~/fruit-tribe-deploy/backend && pm2 restart fruit-tribe-api`.
