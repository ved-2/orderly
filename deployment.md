# Orderly - Deployment & Operation Guide

**Project Name:** Orderly (B2B FMCG Distribution & AI Order Capture Platform)  
**Target Client:** Company A, Jabalpur (4 Packaged Food & Home Care Brands, 1,800 Kiranas, ₹85–100 Cr Annual Turnover)  
**GitHub Repository:** [https://github.com/ved-2/orderly](https://github.com/ved-2/orderly)  
**Live Backend API:** [https://orderly-w9x4.onrender.com](https://orderly-w9x4.onrender.com)  
**API Documentation (Swagger UI):** [https://orderly-w9x4.onrender.com/docs](https://orderly-w9x4.onrender.com/docs)  
**API Health Check:** [https://orderly-w9x4.onrender.com/health](https://orderly-w9x4.onrender.com/health)  

---

## 1. How to Run Locally, Step by Step

Orderly is architected as a modern decoupled full-stack platform:
- **Backend:** Python 3.11+ / FastAPI / SQLAlchemy 2.0 / PostgreSQL / Alembic / Groq Llama 3.3 / Gemini 2.5 Flash
- **Frontend:** Next.js 16.4 (App Router, Turbopack, React 19, Tailwind CSS, Lucide Icons)

### Prerequisites
- **Node.js:** v18.18.0 or higher (v20+ recommended)
- **Python:** v3.11.x (v3.11 or v3.12 recommended)
- **PostgreSQL:** Local PostgreSQL server or a cloud database instance (e.g., Neon serverless)
- **Git**

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/ved-2/orderly.git
cd orderly
```

---

### Step 2: Backend Setup & Execution

1. **Navigate to the backend directory and create a virtual environment:**
   ```bash
   cd backend
   python -m venv .venv
   ```

2. **Activate the virtual environment:**
   - **Windows (PowerShell):**
     ```powershell
     .\.venv\Scripts\Activate.ps1
     ```
   - **Linux / macOS:**
     ```bash
     source .venv/bin/activate
     ```

3. **Install dependencies:**
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   Create a `.env` file inside the `backend/` folder based on `.env.example`:
   ```bash
   # backend/.env
   DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<dbname>?sslmode=require
   SECRET_KEY=<random-hex-string>
   ALGORITHM=HS256
   CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
   GROQ_API_KEY=<your-groq-api-key>
   GEMINI_API_KEY=<your-gemini-api-key>
   CLOUDINARY_CLOUD_NAME=<your-cloudinary-cloud-name>
   CLOUDINARY_API_KEY=<your-cloudinary-api-key>
   CLOUDINARY_API_SECRET=<your-cloudinary-api-secret>
   FIREBASE_PROJECT_ID=<your-firebase-project-id>
   FIREBASE_CLIENT_EMAIL=<your-firebase-service-account-email>
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

5. **Run database migrations and seed realistic sample data:**
   ```bash
   # Run Alembic migrations to build 12 relational tables
   alembic upgrade head

   # Seed FMCG catalogue, inventory, Jabalpur beats, kiranas, and orders
   python seed.py
   ```

6. **Start the FastAPI backend server:**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   - API will be accessible at: `http://localhost:8000`
   - Interactive OpenAPI Docs: `http://localhost:8000/docs`
   - Health status: `http://localhost:8000/health`

7. **Run backend test suite:**
   ```bash
   pytest
   # 88 automated tests covering NLU parser, scheme engine, credit holds, and OCR
   ```

---

### Step 3: Frontend Setup & Execution

1. **Open a new terminal and navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Configure frontend environment variables:**
   Create `.env.local` inside the `frontend/` directory:
   ```bash
   # frontend/.env.local
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
   NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

   NEXT_PUBLIC_FIREBASE_API_KEY=<your-firebase-api-key>
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<your-firebase-auth-domain>
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=<your-firebase-project-id>
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<your-firebase-storage-bucket>
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<your-firebase-sender-id>
   NEXT_PUBLIC_FIREBASE_APP_ID=<your-firebase-app-id>
   ```

4. **Start the Next.js development server:**
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:3000`.

5. **Verify production frontend build:**
   ```bash
   npm run build
   # Generates all 27 static and dynamic App Router routes with zero TypeScript errors
   ```

---

## 2. Cloud Deployment Architecture

Orderly is deployed on production-grade cloud infrastructure:

```
[ Next.js 16 Client on Vercel Edge ]
                │
         HTTPS / JSON REST
                │
                ▼
[ FastAPI Backend on Render (Python 3.11 Web Service) ]
    ├── Authentication: Firebase Admin SDK (JWT Bearer Token verification)
    ├── Primary DB: Neon Serverless PostgreSQL (Pooled connection, SSL, Alembic)
    ├── AI Pipeline:
    │     ├── Groq Llama 3.3 70B Versatile (Structured NLU JSON extraction <450ms)
    │     └── Google Gemini 2.5 Flash Vision (Handwritten Parchi OCR scanner)
    └── Media Storage: Cloudinary (Secure signed voice audio & parchi photo uploads)
```

### 1. Backend Deployment (Render)
- **Platform:** Render Web Service
- **Runtime:** Python 3.11.9 (pinned via `.python-version`)
- **Build Command:** `pip install --upgrade pip && pip install -r requirements.txt`
- **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Health Check Endpoint:** `/health`
- **Automatic Deployments:** Triggered on every git push to `main`.
- **CORS Configuration:** Allows local dev (`http://localhost:3000`) and Vercel domains (`https://*.vercel.app`).

### 2. Frontend Deployment (Vercel)
- **Platform:** Vercel
- **Framework Preset:** Next.js (Turbopack enabled)
- **Root Directory:** `frontend`
- **Build Command:** `next build`
- **Output Directory:** `.next`
- **Dual Base URL Support:** Fully supports either `NEXT_PUBLIC_API_BASE_URL` or `NEXT_PUBLIC_API_URL` with a 45-second fallback timeout for cold starts.

### 3. Database (Neon Serverless PostgreSQL)
- **Engine:** PostgreSQL 16
- **Connection Mode:** Pooled connection string with SSL enforcement (`sslmode=require`).
- **Migrations:** Managed via Alembic (`alembic upgrade head`).

---

## 3. Environment Variables Reference (Names Only)

> [!IMPORTANT]
> In accordance with submission security rules, **only variable names** are listed below. No secret keys or database credentials are included.

### Backend Environment Variables (`backend/.env`)
| Variable Name | Purpose | Required |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL database connection string (Neon / RDS) | Yes |
| `SECRET_KEY` | Cryptographic secret for signing internal session tokens | Yes |
| `ALGORITHM` | Algorithm used for JWT encoding (e.g. `HS256`) | Yes |
| `CORS_ORIGINS` | Comma-separated list of allowed web origins | Yes |
| `GROQ_API_KEY` | Groq API key for Llama 3.3 70B NLU order extraction | Yes |
| `GEMINI_API_KEY` | Google Gemini API key for handwritten parchi OCR | Yes |
| `CLOUDINARY_CLOUD_NAME`| Cloudinary cloud identifier for voice & image media | Yes |
| `CLOUDINARY_API_KEY` | Cloudinary API key for uploaded assets | Yes |
| `CLOUDINARY_API_SECRET`| Cloudinary API secret for secure signing | Yes |
| `FIREBASE_PROJECT_ID` | Firebase project identifier for auth validation | Yes |
| `FIREBASE_CLIENT_EMAIL`| Firebase service account client email | Yes |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private RSA key | Yes |

### Frontend Environment Variables (`frontend/.env.local`)
| Variable Name | Purpose | Required |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_BASE_URL` | Full URL to the Orderly backend API v1 route | Yes |
| `NEXT_PUBLIC_API_URL` | Alternative alias for the backend API v1 route | Optional |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web Client API Key | Yes |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Authentication Domain | Yes |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Project ID | Yes |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`| Firebase Storage Bucket | Yes |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Cloud Messaging Sender ID | Yes |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Web Application ID | Yes |

---

## 4. Demo Login Details for the Reviewer

The system contains pre-seeded accounts corresponding to all roles specified in the brief. Reviewers can sign in directly or test the self-registration flow.

### Pre-Seeded Evaluation Accounts
| Role | Demo Email | Seeded Context / Organization | Access Portal |
| :--- | :--- | :--- | :--- |
| **Distributor Admin** | `vdntkolte@gmail.com` | Company A Jabalpur Headquarters (Admin) | `/distributor` |
| **Order Desk Operator** | `orderdesk@orderly.in` | Central Jabalpur Dispatch & Credit Desk | `/order-desk` |
| **Field Salesman** | `rajesh.sales@orderly.in` | Beat 1: Wright Town & Napier Town Markets | `/salesman` |
| **Field Salesman (Alt)** | `sunil.sales@orderly.in` | Beat 2: Gorakhpur & Sadar Bazaar Markets | `/salesman` |
| **Kirana Retailer** | `vedantkolte18@gmail.com` | Shree Mahavir Kirana Stores (`RET-JBP-01`) | `/retailer` |

### Reviewer Self-Registration & Quick Exploration
If you wish to test fresh account creation without existing credentials:
1. Open the web application and navigate to `/register`.
2. Toggle between **"Kirana Retailer"** or **"Distributor Admin"**.
3. Sign up with any valid email and password (or use Google Single Sign-On).
4. New kirana registrations instantly seed a credit ledger, wholesale catalogue pricing, and sample Jabalpur delivery address.

---

## 5. Reviewer Verification Guide: Key Core Flows

### Flow 1: Interactive AI Ordering Simulator (Zero Login Required)
- **Location:** Home page (`/`) scroll to `#ai-demo` or click **"Try AI Ordering Demo"**.
- **What to test:**
  - Type or paste the brief's sample raw order message:
    `bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti`
  - Click **"Parse Order with AI"**.
  - **Verification:** Notice the sub-second parsing into exact SKU codes (`SKU-BS-075`, `SKU-DT-1KG`, `SKU-TE-250`), auto-applied wholesale scheme savings (1 free biscuit case and 3% powder discount), acoustic feedback warning flag, and alternative SKU match cards.

### Flow 2: Retailer Catalogue & Wholesale Scheme Engine
- **Location:** `/retailer/catalogue` & `/retailer/cart`
- **What to test:**
  - View GST breakdown tags (`Price incl. 18% GST`).
  - Unit toggle: Switch between **Peti (Case of 96)** and **Single Pieces**.
  - Add 10 cases of Glucose Biscuit (`SKU-BS-075`) to cart: Cart automatically awards **+1 Free Case** under the *Buy 10 Get 1* scheme with zero math required by the shopkeeper.
  - Add 5 cases of Detergent Powder 1kg (`SKU-DT-1KG`): Cart automatically triggers the **3% Slab Discount**.
  - Out of stock indicator: Tea Leaf 250g displays clear zero stock state and prevents invalid checkout.

### Flow 3: AI Order Capture & Disambiguation Card
- **Location:** `/retailer/ai-order`
- **What to test:**
  - Send an ambiguous voice note or text: `bhaiya 2 peti biscuit chhota`.
  - Notice the **Disambiguation State**: AI displays the original Hindi phrase, confidence score (e.g. 78%), and offers two alternative SKUs (Glucose 75g vs Marie 120g).
  - Unclear units trigger an explicit prompt: *"Did you mean 2 Peti (Cases) or 2 Packets?"* — preventing warehouse picking errors.

### Flow 4: Order Desk, Credit Limit Hold & Tally Export
- **Location:** `/order-desk`
- **What to test:**
  - Review orders submitted from Kiranas or field salesmen.
  - Review orders placed on **Credit Hold** when outstanding balance exceeds the retailer's limit (`₹50,000`).
  - Click **"Export to Tally XML"** to download compliant Tally ERP9 / Tally Prime XML ready for instant import.
  - Click **"Van Loading Sheet"** to generate grouped picking lists sorted by FMCG brand and delivery vehicle.
  - Inspect the **Dormant Retailer Alert** widget flagging kirana shops with zero orders in the last 14 days.
