# The Fruit Tribe — Complete Workflow Guide

Step-by-step workflows for every major process in the platform. Use this with [API_DOCS.md](../API_DOCS.md), [ARCHITECTURE.md](../ARCHITECTURE.md), [PAYMENTS.md](./PAYMENTS.md), and [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Table of contents

1. [Roles and surfaces](#1-roles-and-surfaces)
2. [Local development setup](#2-local-development-setup)
3. [Customer: sign up and login](#3-customer-sign-up-and-login)
4. [Customer: browse, cart, and product detail](#4-customer-browse-cart-and-product-detail)
5. [Customer: checkout and place order](#5-customer-checkout-and-place-order)
6. [Customer: online payment (Razorpay)](#6-customer-online-payment-razorpay)
7. [Customer: cash on delivery (COD)](#7-customer-cash-on-delivery-cod)
8. [Customer: orders and profile](#8-customer-orders-and-profile)
9. [Admin: products and variants](#9-admin-products-and-variants)
10. [Admin: delivery fees and free delivery rules](#10-admin-delivery-fees-and-free-delivery-rules)
11. [Admin: coupons and discounts](#11-admin-coupons-and-discounts)
12. [Admin: orders and payments](#12-admin-orders-and-payments)
13. [Admin: store, theme, and service areas](#13-admin-store-theme-and-service-areas)
14. [Admin: WhatsApp order alerts](#14-admin-whatsapp-order-alerts)
15. [Delivery partner workflow](#15-delivery-partner-workflow)
16. [Seller workflow](#16-seller-workflow)
17. [Subscription workflow](#17-subscription-workflow)
18. [Production deployment](#18-production-deployment)
19. [Troubleshooting quick reference](#19-troubleshooting-quick-reference)

---

## 1. Roles and surfaces

| Role | Frontend routes | Backend access |
|------|-----------------|----------------|
| **Guest** | `/`, `/products`, `/product/:id`, `/login`, `/signup` | Public catalog, auth signup/login |
| **Customer** | `/cart`, `/checkout`, `/profile` | JWT — own orders, addresses |
| **Admin** | `/admin/*` (full settings) | JWT + `ADMIN` role |
| **Seller** | `/admin` (limited) | JWT + `SELLER` — own products/orders |
| **Delivery partner** | `/delivery/*` | JWT + `DELIVERY_PARTNER` |

**API base (local):** `http://localhost:3000/v1`  
**API base (production):** `https://thefruittribe.com/api/v1` (via Nginx proxy)  
**Frontend (local):** `http://localhost:5173` (Vite)

---

## 2. Local development setup

### Step 1 — Prerequisites

1. Install **Node.js** (LTS), **Docker Desktop**, and **Git**.
2. Clone the repo and open the project folder.

### Step 2 — Environment

1. Copy `backend/.env.example` to `backend/.env` (if present) or create `backend/.env` with at least:
   - `DATABASE_URL` — PostgreSQL connection string
   - `JWT_SECRET` — long random string
   - `PORT=3000`
2. Optional for full features:
   - Razorpay keys (payments)
   - `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` (OTP + order alerts)
   - `WHATSAPP_ORDER_NOTIFY_PHONE` (store number for new orders)

### Step 3 — Start infrastructure

```bash
docker-compose up -d
```

1. Starts **PostgreSQL** and **Redis** (if defined in compose).
2. Wait until the database container is healthy.

### Step 4 — Backend

```bash
cd backend
npm install
npx prisma migrate deploy
npm run start:dev
```

1. Migrations apply the schema.
2. API listens on port **3000**.
3. Swagger (if enabled): `http://localhost:3000/api/docs`.

### Step 5 — Frontend

```bash
# from repo root
npm install
npm run dev
```

1. Vite serves the app at **5173**.
2. Vite proxy should forward `/api` to the backend (check `vite.config`).

### Step 6 — Verify

1. Open `http://localhost:5173`.
2. Open `http://localhost:3000/v1/products` — should return JSON.
3. Log in as admin (seed user if you have seeds) or create a customer via `/signup`.

---

## 3. Customer: sign up and login

### 3A. Email sign up

| Step | Where | Action |
|------|--------|--------|
| 1 | Browser `/signup` | User enters name, email, phone, password. |
| 2 | Frontend | `POST /v1/auth/register` with body `{ name, email, phone, password }`. |
| 3 | Backend | Creates user (typically `CUSTOMER`), may send verification email depending on config. |
| 4 | Browser `/verify-email` | User enters OTP/code if email verification is enabled. |
| 5 | Frontend | `POST /v1/auth/verify-email` with code. |
| 6 | Browser `/login` | User logs in with email + password. |
| 7 | Frontend | `POST /v1/auth/login` — receives JWT (cookies and/or token in response). |
| 8 | App | `GET /v1/auth/me` loads profile; cart and checkout become available. |

### 3B. WhatsApp OTP login

| Step | Where | Action |
|------|--------|--------|
| 1 | Browser `/login` | User chooses WhatsApp login, enters phone. |
| 2 | Frontend | `GET /v1/auth/whatsapp/status` — checks if WhatsApp API is configured. |
| 3 | Frontend | `POST /v1/auth/whatsapp/send-otp` with phone number. |
| 4 | Backend | Sends OTP template via Meta WhatsApp Cloud API. |
| 5 | User | Enters OTP on screen. |
| 6 | Frontend | `POST /v1/auth/whatsapp/verify-otp` with phone + OTP. |
| 7 | Backend | Validates OTP, issues JWT, sets auth cookies. |
| 8 | App | Redirect to home or previous page (`from` state). |

### 3C. Forgot password

| Step | Action |
|------|--------|
| 1 | `/forgot-password` → `POST /v1/auth/forgot-password` |
| 2 | User receives reset link/code |
| 3 | `/change-password` → `POST /v1/auth/reset-password` or `POST /v1/auth/change-password` (when logged in) |

### 3D. Logout

| Step | Action |
|------|--------|
| 1 | User clicks Log out |
| 2 | `POST /v1/auth/logout` — revokes refresh token / clears cookies |

---

## 4. Customer: browse, cart, and product detail

### 4A. Homepage and product listing

| Step | Where | What happens |
|------|--------|----------------|
| 1 | `/` | Featured products, seasonal blocks load from API. |
| 2 | API | `GET /v1/products` — active products with variants, stock, images. |
| 3 | `/products` | Full catalog with search, category filter, sort. |
| 4 | User | Clicks a product card → `/product/:id`. |

**Stock display:** Products can show as in stock or out of stock based on variant `availableQuantity` / `availableStock`.

### 4B. Product detail page (PDP)

| Step | Where | What happens |
|------|--------|----------------|
| 1 | `/product/:id` | `GET /v1/products/:id` loads product, variants, tier pricing. |
| 2 | User | Selects pack size (e.g. 1 kg, 3 kg, 5 kg) from variant dropdown. |
| 3 | User | Sets quantity, clicks **Add to cart**. |
| 4 | Frontend | Cart line stores `productId`, `selectedVariantId`, price, name, image. |
| 5 | Store | Cart persisted in context + `localStorage` (guest) until checkout requires login. |

**Variant rules:** Each pack is a separate variant row. Cart must include `selectedVariantId` (UUID) — old carts without it must be cleared and re-added.

### 4C. Cart

| Step | Where | What happens |
|------|--------|----------------|
| 1 | `/cart` | Lists all lines with quantity controls. |
| 2 | Frontend | Recalculates subtotal using tier discounts (`estimateCartLineTotalsWithTierDiscount`). |
| 3 | User | Sees hint for free delivery if admin configured threshold/km. |
| 4 | User | Clicks **Proceed to checkout** → `/checkout` (login required). |

---

## 5. Customer: checkout and place order

**Route:** `/checkout`  
**Requires:** Logged-in customer, non-empty cart.

### Step 1 — Load checkout page

1. Frontend loads cart items and `GET /v1/products` (for variant validation).
2. Loads store settings: `GET /v1/store-settings` — delivery rules, tax, platform fee, slots.
3. Loads saved addresses: `GET /v1/addresses` (if logged in).
4. Loads coupons: `GET /v1/...` available offers endpoint.

### Step 2 — Delivery address

1. User fills **Full name**, **Phone**, **Flat/House**, **Area/Street**, **PIN**, **City** (Bengaluru fixed for service area).
2. Frontend debounces address and geocodes (Nominatim + pin fallback):
   - Sets map coordinates (`mapCenter`).
   - Calls driving distance: `POST /v1/geocode/driving-distance` (warehouses → customer).
3. Header shows **live Distance (km)** and **ETA**.
4. If street mentions another city (e.g. Kolkata) but PIN is Bengaluru, PIN-based distance is used and a warning is shown.

### Step 3 — Coupons (optional)

1. User opens coupon dropdown on mobile (left column) or desktop sidebar.
2. Selects offer → `validateCoupon` API → applies discount to bill.
3. Locked offers show “Shop for ₹X more” if below `minOrderValue`.

### Step 4 — Payment method

1. **Pay online** or **Cash on delivery** (if allowed for all cart products).
2. If any product has `allowCashOnDelivery: false`, COD is disabled.

### Step 5 — Bill preview (client-side)

1. **Subtotal** — tier-adjusted line totals.
2. **Delivery charges** — `computeDeliveryFeeByDistanceKm` with admin rules + free delivery (order value + km).
3. **Tax** — category rates from settings.
4. **Platform fee** — if admin set > 0.
5. **Discount** — applied coupon.
6. **Total** — payable amount.

### Step 6 — Place order (API)

1. User clicks **Pay ₹…** (or swipe on mobile).
2. Frontend validates form + delivery distance ready.
3. **`POST /v1/orders/pricing/simulate`** (optional) — confirms server-side total.
4. **`POST /v1/orders`** with body:

```json
{
  "items": [{ "productId": "uuid", "variantId": "uuid", "quantity": 1 }],
  "shippingAddress": { "firstName", "lastName", "email", "phone", "address", "city", "zipCode", "state", "latitude", "longitude", ... },
  "couponCode": "OPTIONAL",
  "distanceKm": 8.4,
  "paymentMethod": "online" | "cod",
  "idempotencyKey": "unique-client-key",
  "deliverySlot": "Today · 6pm – 8pm",
  "savedAddressId": "optional-uuid"
}
```

### Step 7 — Backend order creation (every step)

| # | Backend action |
|---|----------------|
| 1 | Check idempotency key — return existing order if duplicate. |
| 2 | Lock variants (`FOR UPDATE`), verify stock in **kg units** (quantity × pack weight). |
| 3 | Apply tier pricing and coupon. |
| 4 | Calculate shipping via `calculateDeliveryFeeByDistance` (free rules: min ₹ + max km). |
| 5 | Validate serviceable PIN/city and address consistency. |
| 6 | Create order + order items in transaction. |
| 7 | **COD:** status `CONFIRMED`, stock committed immediately. |
| 8 | **Online:** status `ON_HOLD`, stock **reserved** (pending payment, ~30 min). |
| 9 | Fire-and-forget **WhatsApp order alert** to store number. |
| 10 | Return order id, order number, `payableAmount`. |

### Step 8 — After create (online)

1. Frontend shows success overlay / continues to payment step (see §6).
2. Cart cleared only after successful payment or confirmed COD flow.

---

## 6. Customer: online payment (Razorpay)

**Prerequisite:** Order created with `paymentMethod: online`, status `ON_HOLD`.

| Step | Actor | Action |
|------|--------|--------|
| 1 | Frontend | `POST /v1/orders/:id/create-razorpay-order` |
| 2 | Backend | Creates Razorpay order for `payableAmount` (paise), stores `razorpayOrderId` in order metadata |
| 3 | Frontend | Loads Razorpay checkout script, opens modal with `keyId` + `razorpayOrderId` |
| 4 | Customer | Completes UPI/card/netbanking on Razorpay |
| 5 | Razorpay | Calls success handler with `razorpay_payment_id`, `razorpay_order_id`, `signature` |
| 6 | Frontend | `POST /v1/orders/:id/verify-payment` with those fields |
| 7 | Backend | Verifies HMAC signature, marks order `PAID` + `CONFIRMED`, commits stock reservations |
| 8 | Frontend | Clears cart, redirects to `/order-confirmation` |

### If Razorpay modal closes without handler

1. `ondismiss` waits ~2.5s, polls `GET /v1/orders` for `paymentStatus === 'PAID'`.
2. If paid, same success UX as normal.

See [PAYMENTS.md](./PAYMENTS.md) for console errors and webhook recommendations.

---

## 7. Customer: cash on delivery (COD)

| Step | What happens |
|------|----------------|
| 1 | User selects **Cash on delivery** at checkout |
| 2 | `POST /v1/orders` with `paymentMethod: "cod"` |
| 3 | Order created as **CONFIRMED** immediately |
| 4 | Stock decremented (not just reserved) |
| 5 | `paymentStatus` remains **PENDING** until admin marks paid |
| 6 | WhatsApp alert says “Cash on Delivery” |
| 7 | User sees order confirmation; cart cleared |

---

## 8. Customer: orders and profile

### Profile `/profile`

| Tab / area | APIs / behavior |
|------------|-----------------|
| Orders | `GET /v1/orders` — list own orders |
| Order detail | `GET /v1/orders/:id` |
| Addresses | `GET/POST/PATCH/DELETE /v1/addresses` |
| Save address at checkout | Optional checkbox → creates saved address |

### Order confirmation `/order-confirmation`

1. Shows order number and total after successful checkout.
2. State passed via router (`orderId`, `orderNumber`).

---

## 9. Admin: products and variants

**Route:** `/admin/products`  
**Roles:** `ADMIN`, `SELLER` (seller sees own products only)

### Step 1 — Create product

| Step | Action |
|------|--------|
| 1 | Click **Add product** |
| 2 | Fill name, category, base price, description, images (upload → `/v1/uploads`) |
| 3 | Add variants: pack label (e.g. `1kg`, `3kg`, `5kg`), stock, price override, SKU auto-generated |
| 4 | Set bulk tier pricing if needed (qty thresholds → discount %) |
| 5 | Save → `POST /v1/products` |
| 6 | Backend creates product + variants + tier rows; `availableQuantity = stockQuantity` |

### Step 2 — Edit product and sync variants

| Step | Action |
|------|--------|
| 1 | Open product → `PATCH /v1/products/:id` |
| 2 | Change packs (3 kg / 5 kg / 10 kg) |
| 3 | Backend **matches** variants by id or pack weight (`attributeValue`) |
| 4 | Unmatched old variants: **deleted** if never used, else **archived** |
| 5 | SKUs generated from product slug + pack (avoids index collisions) |
| 6 | Response includes `variantSync: { created, updated, deleted, archived }` |

### Step 3 — Fix “missing” pack on storefront

| Check | Fix |
|-------|-----|
| Variant archived | Restore or create new row with that pack label |
| Stock 0 | Set stock > 0 on variant; OOS variants still **show** but are disabled |
| Product inactive | Set status Active |
| Stale cart | Customer clears cart and re-adds with new `selectedVariantId` |

### Step 4 — Adjust stock manually

1. `PATCH /v1/products/variants/:variantId/stock` with delta or absolute quantity.
2. Writes `inventoryLog` for audit.

---

## 10. Admin: delivery fees and free delivery rules

**Route:** `/admin/settings` → **Delivery fee by distance** section

### Step 1 — Choose fee mode

| Mode | Behavior |
|------|----------|
| **Slab** | Distance tiers: up to 3 km → ₹20, up to 8 km → ₹40, etc. |
| **Per km** | Fee = distance × rate per km (capped on frontend for display safety) |

### Step 2 — Flat fallback fee

1. **Flat fallback delivery fee** — used only when distance cannot be calculated.

### Step 3 — Free delivery rules (green box)

| Field | Meaning |
|-------|---------|
| **Min order value (₹)** | e.g. 500 — minimum subtotal for free delivery |
| **Within distance (km)** | e.g. 8 — max delivery distance for free delivery |

**Logic:**

- **Both set** → Free only if subtotal ≥ ₹ threshold **AND** distance ≤ km limit.
- **Only ₹** → Free above threshold (any distance).
- **Only km** → Free within distance (any order size).
- **Both 0** → No free-delivery rule.

### Step 4 — Platform fee (optional)

- Separate per-order handling charge (not delivery). Use **0** to disable.

### Step 5 — Save

1. Click **Save delivery settings**.
2. `PUT /v1/settings/store` persists all values.
3. Checkout and `POST /v1/orders` use same rules on next order.

### Step 6 — Service areas (same settings page / preferences)

1. Configure **serviceable cities** and **PIN codes** (e.g. Bengaluru PINs).
2. Checkout rejects non-serviceable PINs.

---

## 11. Admin: coupons and discounts

**Route:** `/admin/discounts`

| Step | Action |
|------|--------|
| 1 | Create coupon: code, % or flat off, min order, max discount cap, expiry, usage limit |
| 2 | Optional: restrict to product/category |
| 3 | Save → stored in settings/coupon tables |
| 4 | Customer applies at checkout → validated server-side on order create |
| 5 | `usedCount` incremented when order succeeds |

---

## 12. Admin: orders and payments

**Route:** `/admin/orders`

### View and filter

1. List all orders with status, payment status, customer, totals.
2. Open order detail for line items, address, logs.

### Update status

| Step | API |
|------|-----|
| 1 | Select new status (e.g. Packed, Out for delivery, Delivered) |
| 2 | `PATCH /v1/orders/:id/status` |
| 3 | `orderStatusLog` records change |

### Mark COD paid

1. `PATCH /v1/orders/:id/payment-status` → `PAID` when cash collected.

### Payment link (manual)

1. `POST /v1/orders/:id/payment-link` — Razorpay payment link emailed to customer.
2. Customer pays → webhook or `confirm-payment-link` confirms order.

### Delivery overdue

1. `GET /v1/orders/admin/delivery-overdue` — orders past expected delivery window.

---

## 13. Admin: store, theme, and service areas

| Route | Purpose |
|-------|---------|
| `/admin/store` | Store preferences hub |
| `/admin/themes` | Logo, colors, hero, contact phone/email, announcement bar |
| `/admin/preferences` | Homepage copy, feature toggles |
| `/admin/pages` | CMS pages (about, terms) |
| `/admin/taxes` | GST/tax % per category |
| `/admin/logistics` | Warehouses (lat/lng for distance), delivery staff |

**Warehouses:** Driving distance from warehouse coordinates to customer pin determines km for fees.

---

## 14. Admin: WhatsApp order alerts

When any customer places an order, the store can receive a WhatsApp message.

### Configuration (backend `.env`)

| Variable | Purpose |
|----------|---------|
| `WHATSAPP_ACCESS_TOKEN` | Meta Cloud API token |
| `WHATSAPP_PHONE_NUMBER_ID` | Sender phone number ID |
| `WHATSAPP_ORDER_NOTIFY_PHONE` | Store mobile (e.g. `919XXXXXXXXX`) — highest priority |
| `WHATSAPP_ORDER_TEMPLATE_NAME` | Optional approved template name |

**Fallback:** Theme **Contact phone** in `/admin/themes` if env not set.

### Message contents

- Order number, payable amount, payment type (online pending vs COD)
- Customer name, phone, email
- Item lines and delivery address
- Delivery slot if selected

### Flow

1. Order created successfully → async `sendOrderAlert`.
2. Failure does **not** cancel the order (logged only).

**Note:** WhatsApp OTP for login uses the same Meta credentials but a different template (`otp_verification`).

---

## 15. Delivery partner workflow

**Routes:** `/delivery`, `/delivery/assignments`, `/delivery/assignments/:id`  
**Role:** `DELIVERY_PARTNER`

| Step | Action |
|------|--------|
| 1 | Login with delivery partner account |
| 2 | Dashboard shows assigned deliveries |
| 3 | Open assignment → see address, phone, items |
| 4 | Update delivery status via delivery app APIs (`/v1/delivery-app/...`) |
| 5 | Admin may assign orders from `/admin/logistics` |

---

## 16. Seller workflow

**Routes:** `/admin` (seller view)

| Step | Action |
|------|--------|
| 1 | Seller registers or is approved by admin (`/admin/sellers`) |
| 2 | Seller creates/edits **own** products only |
| 3 | Views orders containing their products |
| 4 | `/admin/seller-dashboard` — seller-specific stats |

---

## 17. Subscription workflow

**Route:** `/subscription` (customer), `/admin/subscription` (admin config)

| Step | Action |
|------|--------|
| 1 | Admin configures plans, fruits, benefits on subscription page settings |
| 2 | Customer fills address + plan on `/subscription` |
| 3 | `POST /v1/orders/subscription` creates subscription order (recurring logic per implementation) |
| 4 | Payment similar to one-time order if online |

---

## 18. Production deployment

High-level only — details in [DEPLOYMENT.md](./DEPLOYMENT.md).

| Step | Action |
|------|--------|
| 1 | Push to `main` on GitHub |
| 2 | GitHub Actions builds frontend + backend |
| 3 | SSH deploy to EC2, run migrations, restart PM2/systemd |
| 4 | Nginx serves HTTPS `thefruittribe.com`, proxies `/api` → backend |
| 5 | Set secrets: `DATABASE_URL`, `JWT_SECRET`, `SERVER_DOMAIN`, Razorpay, WhatsApp |
| 6 | Certbot SSL on first deploy when DNS + port 80 ready |

---

## 19. Troubleshooting quick reference

| Problem | What to check |
|---------|----------------|
| Pay button disabled on checkout | Address complete? Distance calculated? PIN serviceable? Out of range (>120 km)? |
| Wrong delivery fee (₹ hundreds) | Street city vs PIN mismatch; fix address or PIN |
| Variant missing on site | Admin variants, stock > 0, product Active; refresh cart |
| Payment succeeded, order pending | Razorpay verify failed — check signature, HTTPS; poll orders; set up webhook |
| No WhatsApp order alert | `.env` WhatsApp vars + `WHATSAPP_ORDER_NOTIFY_PHONE` or theme contact |
| Homepage 0 products | Products Active; API running; DB connection |
| `ECONNREFUSED` on checkout | Backend not running locally; start `npm run start:dev` in `backend/` |
| Mixed fruit placeholder image | Upload real product image in admin; placeholder is fallback only |

---

## Related documentation

| Document | Contents |
|----------|----------|
| [API_DOCS.md](../API_DOCS.md) | Endpoint tables |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Layers, security, scaling |
| [PAYMENTS.md](./PAYMENTS.md) | Razorpay quirks and fixes |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | EC2, SSL, GitHub Actions |
| [schema.sql](../schema.sql) | Database tables |

---

*Last updated for workflows including free delivery (₹ + km), checkout layout, variant sync, and WhatsApp order alerts.*
