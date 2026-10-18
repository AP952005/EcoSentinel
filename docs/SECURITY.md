# EcoSentinel — Security & Access Control Policy

## 1. Credential Security
- **Server-Side API Key Storage:** Gemini API keys (`GEMINI_API_KEY`) and Google Cloud service account credentials must reside strictly on the server or in Google Cloud Secret Manager.
- **Client Isolation:** Frontend Next.js client bundles never receive, log, or expose raw model API keys.
- **Environment Exclusions:** `.env` and service account `.json` files are excluded via `.gitignore`.

## 2. Authentication & Session Management
- **Password Protection:** Cryptographic password hashing using `argon2-cffi`.
- **JWT Authorization:** Stateless Bearer tokens with HS256 signatures and strict expiration cadences.
- **Brute-Force Rate Limiting:** Consecutive failed login attempts trigger temporary account locking via memory rate limiters.
- **Role-Based Access Control (RBAC):**
  - **Admin:** System oversight, deployment architecture inspection, audit logs.
  - **Officer:** Investigation review, ProofLoop challenges, Watchtower monitoring plans.
  - **Applicant:** Project intake, document uploads, initial FER submission.
