# Dire Dawa Administration Government Communication Affairs Bureau (DGC)
## Official Public Opinion, Citizen Inquiries & Civic Survey Portal

This repository contains the official production portal for the Dire Dawa Administration Government Communication Affairs Bureau.

## Run Locally

**Prerequisites:** Node.js (v18+)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables in `.env`:
   - `DATABASE_URL`: PostgreSQL connection string (Mandatory in production)
   - `GEMINI_API_KEY`: Google Generative AI API key
   - `DEV_PASSWORD`, `ADMIN_PASSWORD`: Secure initial administrative credentials
   - `JWT_SECRET`: 256-bit cryptographic secret key
3. Run in development mode:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   npm start
   ```
