# Implementation Plan - Secure Private Dashboard

## Security Threat Model

### Component Overview
The application is a private, security-hardened personal dashboard and server for storing and retrieving confidential records (credentials, notes, financial data, API keys). The public internet exposes only a secure login portal. All dashboard views, API endpoints, and database interactions require authenticated sessions with strict Supabase Row Level Security (RLS) and server-side session token verification.

### Entry Points and Untrusted Inputs
| Entry Point | Type | Trusted? | Validation |
|---|---|---|---|
| `POST /api/records` | REST API | No | Strict schema validation: title (1-200 chars), category enum, content (string), sanitized |
| `PUT /api/records/:id` | REST API | No | UUID format check, record ownership verification via session user_id |
| `DELETE /api/records/:id` | REST API | No | UUID format check, record ownership verification via session user_id |
| `GET /api/records` & `/api/records/search` | REST API | No | Query sanitization, limit/offset clamping, filtered strictly by authenticated `user_id` |
| Client Login Form | UI Input | No | Email RFC 5322 regex validation, password length bounds |

### Trust Boundaries and Auth Assumptions
- **Authentication**: Supabase Auth (Email + Password) providing verified JWT bearer access tokens.
- **Authorization**: Dual-layer defense:
  1. Server middleware validates JWT token directly via `supabase.auth.getUser(token)` and extracts immutable `user.id`.
  2. Database Row Level Security (RLS) ensures only `auth.uid() = user_id` can SELECT, INSERT, UPDATE, or DELETE records.
- **Implicit trust**: Never trust `user_id` passed from client payload; always derive strictly from verified token.

### Sensitive Data Paths
| Data Type | Source | Destination | Protection |
|---|---|---|---|
| Supabase Service Role Key | Server Env | Node Server Memory | Never bundled to client, no `VITE_` prefix, accessed solely in `server.ts` |
| User Session Token | Client Auth | Authorization Header | Transmitted over HTTPS Bearer header |
| Private Records Content | Supabase DB | Authenticated Client | Masked by default in UI, encrypted in transit, accessible only to authenticated owner |

### Privileged Actions
| Action | Location | Guard |
|---|---|---|
| Create/Update/Delete Records | `server.ts` routes | Valid JWT verification + RLS policy |
| Full-text Search | `server.ts` `/api/records/search` | Valid JWT verification + parameterized query |

### Priority Review Areas
1. Guarantee `SUPABASE_SERVICE_ROLE_KEY` is never referenced in client code or Vite bundle.
2. In-memory rate limiting on `/api/*` endpoints to defend against brute force attempts.
3. Strict HTTP security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy).
4. `robots.txt` disallowing private paths and noindex flags.

---

## Verification Plan

### Security Verification
- **Security Scan**: Inspect all newly created and modified files for common CWE vulnerabilities (XSS, injection, exposed secrets, missing auth boundaries). Resolve any detected issues immediately.
- **Security Audit**: Audit the implementation against the component's threat model (`## Security Threat Model`). Document all findings, dispositions, and remediations in `walkthrough.md` using the `generate-security-audit-report` skill.
- **PoC Verification**: Validate auth guards and protection against unauthenticated access using the `run-poc` skill.
