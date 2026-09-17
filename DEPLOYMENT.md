# Production Deployment & Security Architecture Guide

## 1. Overview
The **Secure Private Dashboard** is a hardened, minimalist web application and private server for managing sensitive personal records (passwords, private keys, financial notes, documents). It presents only an indexable, clean login portal to the public web; all data access, dashboard interfaces, and search operations are strictly gated behind verified Supabase authentication and database Row Level Security (RLS).

---

## 2. Supabase Setup Instructions

### Step 1: Create a Supabase Project
1. Go to [https://database.new](https://database.new) and create a new project.
2. Note your project database password and select the region closest to you.

### Step 2: Apply the Database Schema & RLS
1. Navigate to the **SQL Editor** in your Supabase Dashboard.
2. Open the `/schema.sql` file from this project and paste its entire contents into the SQL Editor.
3. Click **Run**. This establishes:
   - `private_records` table with constraints and indexes.
   - Row Level Security (RLS) policies guaranteeing strict user-level data isolation.
   - Automatic `updated_at` trigger.

### Step 3: Configure Authentication Settings
1. In the Supabase Dashboard, navigate to **Authentication** -> **Providers** -> **Email**.
2. For an exclusive, private-use server:
   - Disable **Enable Signup** if you want to be the sole administrator (you can invite or manually create your user account via the Supabase Auth dashboard).
   - Alternatively, sign up your primary account first, then toggle off public signups in the dashboard.

---

## 3. Environment Variables Configuration

Copy `.env.local` or set these in your hosting environment (Cloud Run, Vercel, Railway, Render, etc.):

```env
# Required Supabase Credentials
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Host & Port Configuration (Defaults to port 3000)
PORT=3000
NODE_ENV=production
```

> **Security Rule**: The `SUPABASE_SERVICE_ROLE_KEY` is strictly used by the server backend to perform trusted operations and never sent to or bundled into browser client code.

---

## 4. Production Security Hardening

- **Database-Level Isolation (RLS)**: Even if an attacker somehow bypassed client code, Supabase PostgreSQL RLS unconditionally denies access to records where `auth.uid() != user_id`.
- **Server Token Validation**: Server endpoints verify the `Authorization: Bearer <token>` header with Supabase Auth before processing any record requests. User ID is extracted from the cryptographically verified session token, never trusted from client payloads.
- **In-Memory Rate Limiting**: Built-in sliding window rate limiting mitigates automated credential stuffing and API abuse.
- **Security Headers**:
  - `Content-Security-Policy`: Restricts script and resource loading.
  - `X-Frame-Options: DENY`: Prevents clickjacking in iframes.
  - `X-Content-Type-Options: nosniff`: Prevents MIME-sniffing.
  - `Referrer-Policy: strict-origin-when-cross-origin`: Blocks leaking private URLs in referrers.
- **Search Engine Isolation**:
  - `public/robots.txt` explicitly disallows crawling of `/api/`, `/dashboard/`, `/records/`, and query parameters.
  - Public login portal is discoverable by search engines without exposing any private data or database contents.

---

## 5. Deployment Options

### Option A: Cloud Run / Docker (Recommended)
This repository includes an Express + Vite full-stack build script:
```bash
npm run build
npm start
```
The application serves port 3000 behind reverse proxy with optimal performance.

### Option B: Next.js Adaptation
If deploying specifically to Vercel with Next.js App Router:
- The server endpoints in `server.ts` translate directly to Next.js route handlers (`app/api/records/route.ts`).
- Server actions can call `@supabase/ssr` with `cookies()`.
- Client dashboard and login components correspond 1-to-1 with the components in `/src/components/`.
