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

---

## Next.js Frontend Integration Guide

This guide details how to integrate your existing Next.js frontend with the DeveloperJoy backend.

### 1. Environment Variables Configuration (Next.js)

In your Next.js application root, add the backend URL to your `.env.local`:

```ini
# Points to the DeveloperJoy Express backend (http://localhost:5000 locally)
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

### 2. Better Auth Client Setup for Next.js

Install Better Auth in your Next.js frontend if not already installed:

```bash
npm install better-auth
```

Create an authentication client file (e.g. `lib/auth-client.ts` or `src/lib/auth-client.ts`):

```typescript
// lib/auth-client.ts
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  // Point this directly to the Express backend base URL
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  fetchOptions: {
    // CRUCIAL: Ensures session cookies are included in cross-origin requests
    credentials: 'include',
  },
});

export const { signIn, signOut, useSession, getSession } = authClient;
```

---

### 3. Login and Logout Examples

#### Login Component (`components/AdminLoginForm.tsx`)
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from '@/lib/auth-client';

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await signIn.email({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message || 'Login failed. Invalid credentials.');
      return;
    }

    // Redirect to admin dashboard upon successful login
    router.push('/admin/projects');
    router.refresh();
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4 max-w-sm mx-auto">
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <input
        type="email"
        placeholder="Admin Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full border p-2 rounded"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        className="w-full border p-2 rounded"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white p-2 rounded disabled:opacity-50"
      >
        {loading ? 'Logging in...' : 'Sign In as Admin'}
      </button>
    </form>
  );
}
```

#### Logout Button (`components/LogoutButton.tsx`)
```tsx
'use client';

import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth-client';

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
    >
      Sign Out
    </button>
  );
}
```

---

### 4. Admin Session Verification Example

#### Client Component (Reactive Hook)
```tsx
'use client';

import { useSession } from '@/lib/auth-client';

export function AdminHeader() {
  const { data: session, isPending, error } = useSession();

  if (isPending) return <div>Loading session...</div>;
  if (!session || session.user.role !== 'admin') {
    return <div>Access Denied. Admin session required.</div>;
  }

  return (
    <div>
      <p>Logged in as: {session.user.name} ({session.user.email})</p>
      <span className="badge">Role: {session.user.role}</span>
    </div>
  );
}
```

#### Server Component / Route Handler (SSR)
```tsx
import { cookies } from 'next/headers';

export async function getAdminSessionServer() {
  const cookieStore = await cookies();
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/get-session`, {
    headers: {
      Cookie: cookieStore.toString(),
    },
    cache: 'no-store',
  });

  if (!res.ok) return null;
  return await res.json();
}
```

---

### 5. Fetching Published Projects (Public)

Public projects require no authentication cookies. Only published projects (`status: "published"`) are returned.

```typescript
// services/projectService.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export interface Project {
  _id: string;
  title: string;
  slug: string;
  shortDescription?: string;
  description: string;
  thumbnail: string;
  liveUrl?: string;
  githubUrl?: string;
  technologies: string[];
  category: string;
  featured: boolean;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

// 1. Fetch published projects with optional category, featured, and pagination
export async function getPublishedProjects(params?: {
  category?: string;
  featured?: boolean;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.category) query.set('category', params.category);
  if (params?.featured !== undefined) query.set('featured', String(params.featured));
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/api/projects?${query.toString()}`, {
    next: { revalidate: 60 }, // Revalidate every minute in Next.js
  });

  if (!res.ok) throw new Error('Failed to fetch projects');
  return res.json();
}

// 2. Fetch single published project by ID or Slug (Drafts return 404)
export async function getProjectBySlug(slugOrId: string): Promise<{ success: boolean; data: Project }> {
  const res = await fetch(`${API_BASE}/api/projects/${slugOrId}`, {
    next: { revalidate: 60 },
  });

  if (!res.ok) throw new Error('Project not found or is in draft');
  return res.json();
}
```

---

### 6. Admin Project Management (CRUD with Credentials)

When sending requests to `/api/admin/projects`, **always pass `{ credentials: 'include' }`** so the browser transmits the `better-auth.session_token` cookie.

```typescript
// services/adminProjectService.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// 1. List all projects including drafts
export async function getAdminProjects() {
  const res = await fetch(`${API_BASE}/api/admin/projects`, {
    method: 'GET',
    credentials: 'include', // Includes Better Auth session cookie
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 401) throw new Error('Unauthorized: Please log in as admin');
  if (res.status === 403) throw new Error('Forbidden: Admin access required');
  if (!res.ok) throw new Error('Failed to fetch admin projects');

  return res.json();
}

// 2. Create a new project
export async function createProject(projectData: {
  title: string;
  shortDescription?: string;
  description: string;
  thumbnail: string;
  liveUrl?: string;
  githubUrl?: string;
  technologies?: string[];
  category: string;
  featured?: boolean;
  status?: 'draft' | 'published';
}) {
  const res = await fetch(`${API_BASE}/api/admin/projects`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(projectData),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.message || 'Failed to create project');
  }

  return res.json();
}

// 3. Update an existing project
export async function updateProject(id: string, updateData: Partial<Project>) {
  const res = await fetch(`${API_BASE}/api/admin/projects/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updateData),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.message || 'Failed to update project');
  }

  return res.json();
}

// 4. Delete a project
export async function deleteProject(id: string) {
  const res = await fetch(`${API_BASE}/api/admin/projects/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.message || 'Failed to delete project');
  }

  return res.json();
}
```

---

### 7. Cookie and Credentials Configuration Summary

| Environment | Cookie SameSite | Cookie Secure | HTTP-Only | Behavior |
|---|---|---|---|---|
| **Local Development** (`localhost:3000` $\rightarrow$ `localhost:5000`) | `Lax` | `false` | `true` | Browser accepts cookies over plain HTTP across localhost ports. |
| **Production Deployment** (e.g. `vercel.app` $\rightarrow$ `railway.app`) | `None` | `true` | `true` | Requires HTTPS; allows cross-origin credential transmission. |

**Important Rules for Client-Side Requests:**
- All client-side `fetch` calls to protected admin endpoints must specify:
  ```javascript
  credentials: 'include'
  ```
- All client-side `axios` requests (if using Axios) must specify:
  ```javascript
  withCredentials: true
  ```

---

### 8. Production Deployment Requirements

When deploying your decoupled setup (e.g. Next.js on Vercel and Express Backend on Railway, Render, or VPS):

1. **Backend Environment Variables (`.env` in production):**
   ```ini
   NODE_ENV=production
   PORT=5000
   DB_NAME=developerjoy
   FRONTEND_URL=https://developerjoy.vercel.app
   BETTER_AUTH_URL=https://api.developerjoy.dev
   BETTER_AUTH_SECRET=your_production_random_secret
   MONGODB_URI=mongodb+srv://...
   ADMIN_EMAIL=admin@developerjoy.dev
   ADMIN_PASSWORD=your_production_admin_password
   ```

2. **Frontend Environment Variables (`.env.production` on Vercel):**
   ```ini
   NEXT_PUBLIC_API_URL=https://api.developerjoy.dev
   ```

3. **HTTPS Everywhere**: In production, cross-origin cookies with `SameSite=None` **strictly require HTTPS**. Ensure both the frontend domain and backend domain have active SSL certificates.
4. **CORS Origins**: If you have multiple preview domains (such as Vercel preview URLs), provide them comma-separated in `FRONTEND_URL` on the backend:
   ```ini
   FRONTEND_URL=https://developerjoy.vercel.app,https://developerjoy-preview.vercel.app
   ```

