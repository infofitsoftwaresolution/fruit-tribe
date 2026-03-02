# Production deployment (GitHub Actions + EC2)

## Domain and SSL: thefruittribe.com

The app is set up to serve **https://thefruittribe.com** and **https://www.thefruittribe.com** with automatic SSL via Let's Encrypt (Certbot).

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
