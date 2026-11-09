# Orderly 📦✨
### Enterprise B2B FMCG Distribution & Multilingual AI Order Capture Platform

[![Next.js 16](https://img.shields.io/badge/Next.js-16.4.4-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.3.0-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Groq LPU](https://img.shields.io/badge/Groq_NLU-Sub--450ms-F55036?style=for-the-badge&logo=fastly)](https://groq.com/)
[![Gemini Vision](https://img.shields.io/badge/Gemini_Vision-2.5_Flash-4285F4?style=for-the-badge&logo=google)](https://ai.google.dev/)
[![Pytest](https://img.shields.io/badge/Pytest-88_Passed_100%25-brightgreen?style=for-the-badge&logo=pytest)](https://docs.pytest.org/)
[![License MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

---

## 🌐 Live Deployments & Verified Links

- **Backend API (Render Cloud):** [https://orderly-w9x4.onrender.com](https://orderly-w9x4.onrender.com)
- **Interactive API Documentation (Swagger UI):** [https://orderly-w9x4.onrender.com/docs](https://orderly-w9x4.onrender.com/docs)
- **Alternative ReDoc UI:** [https://orderly-w9x4.onrender.com/redoc](https://orderly-w9x4.onrender.com/redoc)
- **Backend Health Check:** [https://orderly-w9x4.onrender.com/health](https://orderly-w9x4.onrender.com/health)
- **GitHub Repository:** [https://github.com/ved-2/orderly](https://github.com/ved-2/orderly)

---

## 📌 Executive Summary & The Problem

In regional Indian FMCG distribution, millions of neighborhood grocery stores (*kiranas*) place replenishment orders daily. In the context of **Company A (Jabalpur, Madhya Pradesh)**—a regional distributor representing 4 packaged food and home care brands serving 1,800 kirana shops with ₹85–100 Cr annual revenue—ordering has historically relied on chaotic, informal channels:
- 18 field salesmen capture daily orders in physical paper notebooks.
- Kirana shopkeepers send erratic WhatsApp text messages, photos of handwritten slips (*parchis*), and Hindi voice notes at all hours.
- A back-office team of 6 operators manually deciphers handwriting and retypes orders line-by-line into Tally ERP every morning.
- Missing counter-level visibility into stock and active trade schemes causes frequent line cuts, wrong deliveries, and massive annual financial leakage.

### The Economic Cost of Inefficiency (Company A)
$$\text{Annual Turnover} = 600 \text{ orders/day} \times 300 \text{ days/yr} \times ₹5,000/\text{order} = ₹90.00 \text{ Cr/year}$$

- **5% Order Error & Redelivery Rate:** $1,80,000 \times 5\% = 9,000 \text{ returns} \times ₹350 = \mathbf{₹31.50 \text{ Lakh/yr}}$
- **Manual Data Entry Clerks:** $6 \text{ operators} \times ₹2.6 \text{ Lakh} = \mathbf{₹15.60 \text{ Lakh/yr}}$
- **Stock-Out Lost Sales Margin:** $1\% \text{ lost sales} @ 6\% \text{ margin} = \mathbf{₹5.40 \text{ Lakh/yr}}$
- **Total Annual Operational Leakage:** $\mathbf{₹52.50 \text{ Lakh / year}}$

**Orderly directly eliminates this leakage** through automated multimodal order capture, a deterministic wholesale scheme engine, credit hold enforcement, and 1-click Tally ERP XML export—delivering a **2.25-month ROI payback**.

---

## 🏛️ System Architecture

Orderly is architected as a decoupled, service-oriented web application:

```
[ Next.js 16 Client on Vercel Edge ]
  ├── Kirana Retailer Portal (/retailer) ── Bilingual, PWA, 48px+ touch targets
  ├── Order Desk Workspace (/order-desk) ── Credit holds, Tally XML, van loading
  ├── Field Salesman Portal (/salesman) ── Beat schedules, counter order entry
  └── Distributor Admin (/distributor) ── Catalog, 2-tier pricing, dynamic schemes
                │
         HTTPS / REST JSON (Firebase JWT Bearer Auth)
                │
                ▼
[ FastAPI Backend on Render (Python 3.11 ASGI) ]
    ├── API Gateway: CORS Regex, Firebase Admin SDK, require_roles RBAC Guard
    ├── Core Engines:
    │     ├── Pricing Engine (2-tier inheritance: Retailer override -> Base price)
    │     ├── Wholesale Scheme Engine (Buy 10 Get 1 free, 3% volume slabs)
    │     ├── Credit Risk Engine (Row-level lock, auto-hold on credit breach)
    │     ├── Order Lifecycle Service (Idempotent orders, 8-state machine)
    │     └── Distributor Ops (Tally ERP XML exporter, van picking sheets)
    ├── AI Orchestration Pipeline:
    │     ├── Groq LPU (Sub-450ms JSON NLU intent & entity extraction)
    │     ├── Google Gemini 2.5 Flash (Handwritten parchi OCR scanner)
    │     └── Deterministic Fallback (Zero-downtime regex & Hindi lexical tokens)
    └── Persistence:
          ├── Neon Serverless PostgreSQL (12 normalized tables, ACID, SSL)
          └── Cloudinary CDN (Secure signed slip imagery & catalog media)
```

---

## ⚡ Key Platform Capabilities by Persona

### 1. 🏪 Kirana Retailer Portal (`/retailer`)
- **Transparent Wholesale Pricing:** Real-time catalog with explicit GST breakdown (`₹8.10/pc incl. 18% GST`).
- **Tactile Packaging Toggle:** Switch seamlessly between **Dealer Cases (पेटी / 96 pcs)** and **Single Pieces (पीस)**.
- **Automated Scheme Engine:**
  - **Buy 10 Get 1 Free:** Adding 10 cases of Glucose Biscuit automatically appends **+1 Free Case** at ₹0.00.
  - **Volume Slabs:** Ordering 5+ cases of detergent automatically applies the **3% Slab Discount**.
- **Credit Limit Transparency:** Live progress gauge displaying current exposure, order total, and available credit limit.

### 2. 🤖 Multilingual AI Ordering Assistant (`/retailer/assistant`)
- **Vernacular Ingestion:** Accepts Hindi voice notes, Hinglish WhatsApp messages, and handwritten paper slips (*parchis*).
- **Acoustic Pre-filter:** Browser Web Audio API bandpass filter (300 Hz–3.4 kHz) cuts out street noise and background chatter before transcription.
- **Sub-450ms NLU Parsing:** Groq LPU parses complex colloquial sentences like:
  > *"bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti"*
  Into exact database SKUs (`SKU-BS-075`, `SKU-DT-1KG`, `SKU-TE-250`).
- **Interactive Disambiguation State Machine:** If confidence is $< 0.85$ or units are omitted (*"bhaiya 2 biscuit"*), the AI never guesses. It renders an amber card with top 2 alternative SKUs and prompts: *"Did you mean 2 Peti (Cases) or 2 Packets?"*.
- **Zero Autonomous Checkout:** All items reside in a server-side draft; checkout requires explicit human confirmation.

### 3. 📋 Order Desk Operations Console (`/order-desk`)
- **Credit Hold Triage:** Orders exceeding credit limits are automatically held with explicit reason codes (`"Credit limit exceeded: ₹64,250 / ₹50,000"`).
- **1-Click Tally ERP Export:** Downloads compliant Tally ERP9 / Tally Prime XML vouchers ready for instant desktop import.
- **Brand Van Loading Sheets:** Aggregates morning dispatches into consolidated brand and SKU picking totals for warehouse loaders.
- **14-Day Dormant Retailer Alerts:** Surfaces inactive accounts with one-click salesman reassignment.

### 4. 🛵 Field Salesman Beat Mode (`/salesman`)
- **Territory Beat Navigation:** View assigned stores across Jabalpur geographic markets (Wright Town, Napier Town, Sadar Bazaar).
- **Counter Order Entry:** Place orders on behalf of merchants while reviewing their ledger balance and credit headroom.
- **Offline Resilience:** In-memory catalog caching and offline order queue for store visits in network shadow zones.

### 5. 🏢 Distributor Admin Portal (`/distributor`)
- **Master Catalog Governance:** SKU management, packaging ratios (`units_per_case`), HSN tax codes, and Cloudinary image uploads.
- **Dynamic Scheme Builder:** Author multi-tier trade promotions (`BUY_X_GET_Y` and `SLAB_DISCOUNT`) with validity date ranges.
- **Cryptographic Staff Invitations:** Onboard team members via single-use 32-byte SHA-256 hashed invitation tokens.

---

## 🛠️ Technology Stack Matrix

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | **Next.js (App Router)** | `16.4.4` | Server-rendered edge routing, sub-3s first load on 3G |
| **Frontend UI** | **React & Turbopack** | `19.3.0` | Reactive component rendering with high-speed compilation |
| **Styling** | **Tailwind CSS & Base UI** | `v4` | Touch ergonomics (48px+ targets), minimalist `#FBF9F1` palette |
| **Backend API** | **FastAPI** | `0.115+` | Asynchronous ASGI REST gateway with OpenAPI Swagger docs |
| **Language** | **Python** | `3.11.9` | Pinned runtime avoiding C-extension wheel build delays |
| **ORM** | **SQLAlchemy** | `2.0.38` | Transactional persistence with row-level locking (`with_for_update`) |
| **Migrations** | **Alembic** | `1.15.1` | Declarative schema version control |
| **Database** | **PostgreSQL (Neon)** | `16` | ACID compliance, double-entry credit ledger, paisa precision |
| **Authentication** | **Firebase Admin & Web SDK**| `13.2+` | Bearer JWT verification and role-based access control (RBAC) |
| **Conversational NLU** | **Groq LPU API** | `Llama 3.3 / Qwen` | Sub-450ms structured JSON intent and entity extraction |
| **Vision OCR** | **Google Gemini 2.5 Flash** | `v1beta` | Multimodal handwritten kirana parchi slip recognition |
| **Asset Storage** | **Cloudinary CDN** | Cloud API | Signed product imagery and uploaded order chit storage |
| **Test Suite** | **Pytest & pytest-asyncio** | `9.2.0` | 88 automated tests covering 100% of critical business logic |

---

## 🚀 Quickstart: Running Locally

### Prerequisites
- **Node.js:** `v18.18.0+` (v20+ recommended)
- **Python:** `3.11.x`
- **PostgreSQL:** Local instance or cloud Neon connection string
- **Git**

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/ved-2/orderly.git
cd orderly
```

---

### Step 2: Backend Setup

1. **Create and activate a virtual environment:**
   ```bash
   cd backend
   python -m venv .venv

   # Windows (PowerShell):
   .\.venv\Scripts\Activate.ps1

   # Linux / macOS:
   source .venv/bin/activate
   ```

2. **Install dependencies:**
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

3. **Configure `backend/.env`:**
   ```env
   DATABASE_URL=postgresql://<user>:<pass>@<host>:<port>/<db>?sslmode=require
   SECRET_KEY=orderly-dev-secret-key-change-in-production-64char-hex
   ALGORITHM=HS256
   CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

   GROQ_API_KEY=<your-groq-api-key>
   GROQ_MODEL=qwen/qwen3.8-27b
   GEMINI_API_KEY=<your-gemini-api-key>
   GEMINI_MODEL=gemini-2.5-flash

   FIREBASE_PROJECT_ID=<your-firebase-project-id>
   FIREBASE_CLIENT_EMAIL=<your-firebase-service-account-email>
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

4. **Run database migrations & seed sample FMCG data:**
   ```bash
   alembic upgrade head
   python seed.py
   ```

5. **Start the FastAPI backend server:**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   - OpenAPI Docs: `http://localhost:8000/docs`
   - Health Check: `http://localhost:8000/health`

---

### Step 3: Frontend Setup

1. **Open a new terminal, navigate to `frontend/`, and install packages:**
   ```bash
   cd frontend
   npm install
   ```

2. **Configure `frontend/.env.local`:**
   ```env
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
   NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

   NEXT_PUBLIC_FIREBASE_API_KEY=<your-firebase-web-api-key>
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<your-project>.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=<your-project-id>
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<your-project>.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<your-sender-id>
   NEXT_PUBLIC_FIREBASE_APP_ID=<your-web-app-id>
   ```

3. **Start the Next.js development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

---

## 🧪 Testing Suite: 88 Tests Passing (100% Pass Rate)

Orderly enforces test-driven verification across all core calculations, scheme rules, price fallbacks, and AI fallbacks.

Run the test suite from `backend/`:
```bash
pytest
```

```text
collected 88 items

tests/test_ai_assistant_clarification.py ......                          [  6%]
tests/test_ai_assistant_draft_and_confirmation.py ...                    [ 10%]
tests/test_ai_assistant_groq.py ..                                       [ 12%]
tests/test_ai_assistant_matcher.py ......                                [ 19%]
tests/test_ai_assistant_service.py ...                                   [ 22%]
tests/test_ai_assistant_session.py ..                                    [ 25%]
tests/test_database_connection.py .                                      [ 26%]
tests/test_devanagari.py ......                                          [ 32%]
tests/test_distributor_price_fallback.py ..........                      [ 44%]
tests/test_distributor_sales_and_salesmen.py .....                       [ 50%]
tests/test_full_system_e2e.py .......                                    [ 57%]
tests/test_gemini_parchi_scan.py ...                                     [ 61%]
tests/test_order_calculation.py ......                                   [ 68%]
tests/test_order_model.py .                                              [ 69%]
tests/test_order_schemas.py ....                                         [ 73%]
tests/test_pricing_service.py ......                                     [ 80%]
tests/test_product_catalogue_service.py ...                              [ 84%]
tests/test_retailer_registration.py ...                                  [ 87%]
tests/test_scheme_service.py ........                                    [ 96%]
tests/test_van_loading_and_dormant.py ...                                [100%]

======================= 88 passed, 1 warning in 12.41s ========================
```

Verify frontend production build:
```bash
cd frontend && npm run build
# Generates all 27 static and dynamic App Router routes with zero TypeScript errors
```

---

## 🔒 Security & Route Protection Architecture

Orderly implements a **3-tier zero-trust security perimeter**:

1. **Next.js Edge Middleware (`middleware.ts`):** Intercepts all requests matching `/retailer/:path*`, `/distributor/:path*`, `/order-desk/:path*`, and `/salesman/:path*`. Redirects unauthenticated requests to `/register` at the edge before HTML is rendered.
2. **Client-Side Layout Route Guards:** In-browser React layouts verify active Firebase authentication state and role authorization, displaying access restriction cards if permissions are insufficient.
3. **Backend API Token Verification (`FastAPI deps.py`):** Every API endpoint cryptographically validates Firebase ID tokens using the Firebase Admin SDK and enforces `require_roles(...)`. Unauthenticated requests receive `401 Unauthorized`; role violations receive `403 Forbidden`.

---

## 👥 Demo Reviewer Accounts

Pre-seeded evaluation credentials representing each persona from the client brief:

| Role | Demo Email Address | Seeded Context & Market | Portal Route |
| :--- | :--- | :--- | :--- |
| **Distributor Admin** | `vdntkolte@gmail.com` | Company A Headquarters (Jabalpur) | `/distributor` |
| **Order Desk Operator** | `orderdesk@orderly.in` | Jabalpur Central Dispatch Desk | `/order-desk` |
| **Field Salesman** | `rajesh.sales@orderly.in` | Beat 1: Wright Town Markets | `/salesman` |
| **Field Salesman (Alt)** | `sunil.sales@orderly.in` | Beat 2: Gorakhpur Markets | `/salesman` |
| **Kirana Retailer** | `vedantkolte18@gmail.com` | Shree Mahavir Kirana Stores (`RET-JBP-01`) | `/retailer` |

*Reviewers can also create a new account in under 30 seconds at `/register`.*

---

## 📁 Repository Directory Structure

```text
orderly/
├── ORDERLY_TDD.md                 # Complete 21-section Technical Design Document
├── Technical_Design_Document.pdf  # Compiled PDF submission document
├── deployment.md                  # Comprehensive deployment & operations guide
├── orderly_submission.zip         # Final evaluation ZIP archive (PDF + deployment.md)
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI entry point, CORS, root healthcheck
│   │   ├── api/                   # Versioned API router (/api/v1) & auth dependencies
│   │   ├── core/                  # Configuration, Firebase Admin, and settings
│   │   ├── db/                    # SQLAlchemy engine, session generator, base model
│   │   ├── modules/
│   │   │   ├── users/             # User identity, staff invitations, RBAC
│   │   │   ├── retailers/         # Kirana profiles, beat assignments, settings
│   │   │   ├── products/          # Master SKUs, brands, packaging hierarchy
│   │   │   ├── pricing/           # 2-tier price inheritance, GST calculations
│   │   │   ├── schemes/           # Buy 10 Get 1 free, 3% volume slab discount engine
│   │   │   ├── credit/            # Atomic credit ledgers, limit holds, transactions
│   │   │   ├── orders/            # Order lifecycle, Tally XML export, van loading
│   │   │   └── ai_assistant/      # Groq NLU, Gemini OCR, HybridProductMatcher
│   │   └── scripts/               # Realistic FMCG seed data for Jabalpur market
│   ├── migrations/                # Alembic relational schema migration scripts
│   ├── tests/                     # 88 automated pytest test suites
│   ├── requirements.txt           # Pinned backend dependencies
│   └── seed.py                    # Database seed execution entry point
└── frontend/
    ├── src/
    │   ├── app/                   # 27 Next.js 16 App Router pages
    │   │   ├── page.tsx           # Startup landing page with AI demo simulator
    │   │   ├── register/          # Unified sign-in and retailer registration
    │   │   ├── retailer/          # Catalogue, cart, checkout, AI assistant, credit
    │   │   ├── order-desk/        # Hold queue, Tally XML export, van loading
    │   │   ├── distributor/       # Admin console, schemes, pricing, staff invites
    │   │   └── salesman/          # Mobile field beat visits & offline ordering
    │   ├── components/            # Reusable Base UI and Tailwind components
    │   ├── contexts/              # Auth, Cart, and AI Assistant React contexts
    │   ├── lib/                   # API client, Firebase SDK, audio filters
    │   └── middleware.ts          # Edge middleware enforcing authentication
    ├── package.json               # Next.js 16, React 19, Tailwind v4 dependencies
    └── next.config.ts             # Turbopack & Next.js production configuration
```

---

## 📄 License & Attribution

Developed by **Vedant Kolte** as part of an advanced solo software engineering evaluation.  
Codebase released under the [MIT License](LICENSE).
