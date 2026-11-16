# DeveloperJoy Backend

Production-ready backend API for the DeveloperJoy Portfolio, powered by Express 5, native MongoDB Node.js driver, and Better Auth.

---

## Features

- **Express 5**: Utilizing modern path matching (`*splat`) and optimized middleware pipelines.
- **Native MongoDB Driver (v7)**: Direct collection queries and atomic index creation without Mongoose.
- **Better Auth (v1.7)**: Secure session and user management with official MongoDB adapter.
- **Strict Public Registration Lockdown**: Self-registration endpoints (`/api/auth/sign-up/email`) are completely disabled (`disableSignUp: true`).
- **Secure Admin Initialization**: Concurrency-safe, server-side initialization of the first admin account without exposing public endpoints.
- **Role-Based Access Control (RBAC)**: Admin routes are guarded by `requireAdmin` which verifies valid sessions and rejects non-admin users with `403 Forbidden`.
- **Project Management REST API**: Public catalog endpoints with category/featured filtering & pagination, and protected admin CRUD endpoints with collision-free slug generation.

---

## Architecture & Project Structure

```
c:\projects\developer-joy-server\
├── src/
│   ├── config/
│   │   └── db.js                 # Reusable MongoDB driver client, ping verification & index setup
│   ├── controllers/
│   │   └── project.controller.js # Public & Admin CRUD controllers
│   ├── lib/
│   │   ├── admin.js              # Idempotent server-side admin initialization
│   │   └── auth.js               # Better Auth setup, MongoDB adapter & session options
│   ├── middleware/
│   │   └── auth.middleware.js    # requireAdmin, requireAuth, and optionalAuth middleware
│   ├── routes/
│   │   └── project.routes.js     # Public (/api/projects) & Admin (/api/admin/projects) routes
│   ├── scripts/
│   │   └── seed-admin.js         # Dedicated CLI command to initialize or verify admin
│   ├── utils/
│   │   └── project.validation.js # Server-side payload & URL validators, unique slug generator
│   ├── app.js                    # Express 5 application setup, CORS, body parsers, route mounting
│   └── server.js                 # Server lifecycle manager, graceful shutdown & startup checks
├── .env                          # Local environment variables (do not commit)
├── .env.example                  # Template for environment variables
├── package.json
└── README.md
```

---

## Getting Started

### 1. Prerequisites
- **Node.js**: v20 or higher (ESM support enabled)
- **MongoDB Atlas** or local replica set MongoDB instance

### 2. Environment Configuration
Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Configure your environment variables:

```ini
PORT=5000
DB_NAME=developerjoy
FRONTEND_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:5000
BETTER_AUTH_SECRET=your_32_character_random_secret_here
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority

# Initial Admin Credentials (used for secure server-side setup)
ADMIN_EMAIL=admin@developerjoy.dev
ADMIN_PASSWORD=YourSuperSecurePassword123!
ADMIN_NAME=DeveloperJoy Admin
```

---

## How to Create the First Admin Account Securely

Because public user self-registration is strictly disabled (`disableSignUp: true`), **no user or attacker can register through public HTTP requests**.

You can create or verify the authorized administrator account using either of the following two secure methods:

### Method 1: Automatic Initialization on Server Boot (Recommended)
When you start the server via `npm start` or `npm run dev`:
1. The server connects to MongoDB.
2. It detects `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your `.env`.
3. It checks if an admin user with `ADMIN_EMAIL` already exists in MongoDB.
4. If not present, it securely creates the user with `role: "admin"` and hashes the password using Better Auth's official `scrypt` hasher.
5. If already present, it verifies the account and ensures `role: "admin"` without altering the existing password.

### Method 2: Manual CLI Seed Script
You can seed or verify the admin account on-demand from the command line:

```bash
npm run seed:admin
```

Output:
```
============================================
 DeveloperJoy - Secure Admin Initialization
============================================

[Seed] Connecting to MongoDB database...
[Admin Setup] Initializing first admin account (admin@developerjoy.dev)...
[Admin Setup] Successfully created authorized admin account: admin@developerjoy.dev

[Seed] ✓ Initial admin account successfully created!
[Seed] Email: admin@developerjoy.dev
[Seed] Role:  admin

[Seed] Database connection closed.
```

---

## Running the Application

### Development Mode (with hot-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

---

## Authentication Endpoints

Better Auth routes are mounted at `/api/auth/*`:

### 1. Admin Sign In
- **Method**: `POST`
- **URL**: `/api/auth/sign-in/email`
- **Body**:
  ```json
  {
    "email": "admin@developerjoy.dev",
    "password": "YourSuperSecurePassword123!"
  }
  ```
- **Response**: Sets the `better-auth.session_token` HTTP-only cookie and returns user details:
  ```json
  {
    "user": {
      "id": "6afaccea773703a407adffa7",
      "email": "admin@developerjoy.dev",
      "name": "DeveloperJoy Admin",
      "role": "admin"
    }
  }
  ```

### 2. Verify Session
- **Method**: `GET`
- **URL**: `/api/auth/get-session`
- **Headers**: Include `Cookie: better-auth.session_token=...`
- **Response**: Returns current `{ user, session }` or `null` if unauthenticated.

### 3. Sign Out
- **Method**: `POST`
- **URL**: `/api/auth/sign-out`
- **Headers**: Include `Cookie: better-auth.session_token=...`
- **Response**: Revokes the active session and clears the cookie.

---

## Project Management REST API

### Public Endpoints (Published Projects Only)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/projects` | List published projects (supports `?category=...`, `?featured=true`, `?page=1&limit=10`) |
| `GET` | `/api/projects/:id` | Get published project by ObjectId or unique `slug` (drafts return 404) |

### Admin Endpoints (Requires Authorized Admin Session)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/projects` | List all projects, including drafts |
| `POST` | `/api/admin/projects` | Create a new project (auto-generates collision-free slug) |
| `PUT` | `/api/admin/projects/:id` | Update project fields and regenerate slug if title changes |
| `DELETE` | `/api/admin/projects/:id` | Delete a project by ObjectId |

---

## Security Highlights

1. **No Public Admin Registration**: Public sign-up is completely disabled. Admin accounts cannot be created via public HTTP requests.
2. **Access Control**: Ordinary authenticated users (if any exist) are denied access with `403 Forbidden: Insufficient permissions. Admin access required`.
3. **Unauthenticated Rejection**: Unauthenticated requests to admin endpoints are denied with `401 Unauthorized: Valid admin session required`.
4. **Scrypt Password Hashing**: Passwords are never stored in plain text and are hashed via Better Auth's official cryptography layer.
5. **CORS & Cookies**: Credentials support enabled with restricted trusted origins matching `FRONTEND_URL` and `localhost:3000`.
