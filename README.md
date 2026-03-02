# The Fruit Tribe - Multi-Vendor E-Commerce Platform

This repository contains a production-grade, scalable, and secure e-commerce platform for selling fruits, modeled after the architecture and quality of global leaders like Flipkart and Amazon.

## 🚀 Key Features
- **Clean Architecture & DDD**: Designed for high maintainability and scalability.
- **Multi-Vendor System**: Support for multiple sellers with moderation and approval workflows.
- **Production-Ready Backend**: NestJS with Prisma, PostgreSQL, and Redis.
- **Premium Frontend**: React (Vite) with a bespoke design system, Framer Motion, and Tailwind CSS.
- **Containerized**: Full stack orchestration via Docker Compose.
- **High Performance**: Optimized DB queries, caching layers, and stateless services.

## 📁 Project Structure
- `/backend`: NestJS application (Business logic, API, Database).
- `/src`: Frontend application (Premium React interface).
- `/docs`: Architecture, API, and Schema documentation.
- `schema.sql`: Raw PostgreSQL 3NF schema.
- `docker-compose.yml`: Infrastructure orchestration.

## 🛠️ Technology Stack
- **Backend**: Node.js, NestJS, TypeScript, Prisma.
- **Frontend**: React, Tailwind CSS, Framer Motion, Lucide.
- **Database**: PostgreSQL (Persistence), Redis (Caching).
- **Security**: JWT, Refresh Token Rotation, RBAC, Helmet.
- **Infrastructure**: Docker, Docker Compose.

## 📖 Documentation
- [Architecture & Design Decisions](./ARCHITECTURE.md)
- [Database Schema](./schema.sql)
- [API Reference](./API_DOCS.md)

## 🚦 Getting Started
1. Clone the repository.
2. Run `docker-compose up --build`.
3. Access the API at `http://localhost:3000/v1`.
4. Access the Swagger docs at `http://localhost:3000/api/docs`.

---
*Built with ❤️ by Antigravity (Senior Staff AI Engineer)*
