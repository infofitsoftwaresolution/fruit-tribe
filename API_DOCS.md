# The Fruit Tribe - API Documentation (v1)

## Base URL
`https://api.thefruittribe.com/v1`

## Authentication
Most endpoints require a Bearer Token in the `Authorization` header.
`Authorization: Bearer <jwt_token>`

---

## 1. Auth Module
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `/auth/signup` | Register a new user | Guest |
| POST | `/auth/login` | Login and get JWT + Refresh Token | Guest |
| POST | `/auth/refresh` | Rotate Refresh Token | Authenticated |
| POST | `/auth/verify-otp` | Verify mobile/email OTP | Guest |
| POST | `/auth/logout` | Revoke tokens | Authenticated |

## 2. Catalog Module
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/products` | List products with pagination/search/filters | Any |
| GET | `/products/:id` | Get detailed product info | Any |
| POST | `/products` | Create a new product | Seller, Admin |
| PATCH | `/products/:id` | Update product info | Seller (Owner), Admin |
| GET | `/categories`| Get all fruit categories | Any |

## 3. Order Module
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `/orders` | Place a new order (Idempotent) | Customer |
| GET | `/orders/me` | Get order history for current user | Customer |
| GET | `/orders/:id` | Get order details & status | Owner, Admin |
| PATCH | `/orders/:id/status`| Update order status | Seller, Delivery, Admin |

## 4. Payment Module
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `/payments/init` | Initialize payment (Stripe/Razorpay) | Customer |
| POST | `/payments/webhook` | Webhook for status updates | External |

## 5. Seller Module
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| POST | `/sellers/register` | Apply for seller account | User |
| GET | `/sellers/stats` | Sales analytics | Seller |
| PATCH | `/sellers/approve/:id` | Approve/Reject seller | Admin |

---

## Standard Response Format
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "total": 100
  }
}
```

## Error Response Format
```json
{
  "statusCode": 400,
  "timestamp": "2026-02-07T14:00:00Z",
  "path": "/v1/products",
  "message": "Validation failed",
  "errorCode": "BAD_REQUEST"
}
```
