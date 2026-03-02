# The Fruit Tribe - Architecture & Design

## 1. High-Level Architecture
We follow **Clean Architecture** and **Domain-Driven Design (DDD)** principles to ensure the system is scalable, maintainable, and testable.

### Layers:
1.  **Domain Layer (Core)**: 
    - Contains Entities, Value Objects, and Domain Events.
    - Independent of any external libraries or frameworks (except for maybe some internal types).
    - Example: `Order` entity, `Price` value object.
2.  **Application Layer**:
    - Use cases (e.g., `PlaceOrder`, `RegisterSeller`).
    - Interfaces for repositories and external services (Ports).
    - Orchestrates domain logic.
3.  **Infrastructure Layer**:
    - Implementations of application ports (Adapters).
    - Database repositories (Prisma/TypeORM).
    - External integrations (Stripe, Twilio, AWS S3).
4.  **Interface Layer (API/Presentation)**:
    - Controllers, DTOs, and API documentation.
    - Expresses the system's capabilities to the outside world.

### System Components:
- **API Gateway**: Handles routing, rate limiting, and authentication.
- **Service Modules**: Auth, Catalog, Order, Payment, Inventory, Delivery, Notification.
- **Message Broker (Kafka/RabbitMQ)**: For async communication between modules (e.g., sending notification after order confirmation).
- **Cache (Redis)**: For product catalog and session management.

## 2. Technology Stack
- **Backend**: NestJS (Node.js)
- **Frontend**: Next.js (React) + TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Auth**: JWT with Refresh Token Rotation
- **Caching**: Redis
- **Containerization**: Docker & Docker Compose

## 3. Security Strategy
- **OWASP Top 10 Compliance**: SQLi protection (Prisma), XSS (React), CSRF protection.
- **RBAC**: Fine-grained permissions for Admin, Seller, and Customer.
- **Rate Limiting**: Throttling requests to prevent Brute Force and DoS.
- **Idempotency**: Ensuring payment and order creation are idempotent via `X-Idempotency-Key`.
- **Stateless Auth**: JWT-based session management.

## 4. Scalability Approach
- **Horizontal Scaling**: Backend services are stateless.
- **Read/Write Splitting**: DB replication (design-level).
- **Blob Storage**: Product images served via CDN/S3.
- **Modular Monolith**: Modules are logically separated and can be extracted into microservices when traffic grows.

## 5. Engineering Best Practices (Amazon/Flipkart Standards)
1.  **Idempotency**: All mutations (Order, Payment) support `X-Idempotency-Key` to prevent duplicate processing during retries.
2.  **Circuit Breaker & Retries**: External calls (Payment Gateway, SMS) are wrapped in retry logic with exponential backoff and circuit breakers to prevent cascading failures.
3.  **Soft Deletes**: Data is never hard-deleted; `deleted_at` is used to maintain audit trails and referential integrity.
4.  **Database Indexing**: Critical paths (Product search, Order history) are optimized with composite indexes.
5.  **Environment Parity**: Using Docker ensures the dev environment perfectly matches production.
6.  **Observability**: Structured JSON logging and performance tracing (via Interceptors) for easier debugging using ELK/CloudWatch.
7.  **Domain Invariants**: Business rules are enforced inside the Domain Entities, not just the DB schema.
8.  **Graceful Degradation**: If the search service (Elasticsearch/Redis) is down, the system falls back to basic SQL search to keep the site functional.
