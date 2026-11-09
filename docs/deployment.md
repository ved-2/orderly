# Orderly - Deployment & Operation Guide

**Project Name:** Orderly (B2B FMCG Distribution & AI Order Capture Platform)  
**Target Client:** Company A, Jabalpur (4 Packaged Food & Home Care Brands, 1,800 Kiranas, ₹85–100 Cr Annual Turnover)  
**GitHub Repository:** [https://github.com/ved-2/orderly](https://github.com/ved-2/orderly)  
**Live Frontend:** [https://orderly-eight-silk.vercel.app](https://orderly-eight-silk.vercel.app)
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

## 2. Backend Local Setup & Execution

### Step 2.1: Navigate to Backend & Create a Virtual Environment

Open a terminal at the project root and navigate to the backend directory:

```bash
cd backend
python -m venv .venv
```

### Step 2.2: Activate the Virtual Environment

- **Windows (PowerShell):**

  ```powershell
  .\.venv\Scripts\Activate.ps1
  ```

  _(If execution policies block script activation in PowerShell, run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process` first)._

- **Windows (Command Prompt / cmd.exe):**

  ```cmd
  .venv\Scripts\activate.bat
  ```

- **Linux / macOS:**
  ```bash
  source .venv/bin/activate
  ```

### Step 2.3: Upgrade Package Installer & Install Dependencies

With the virtual environment active, install all required backend packages:

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 2.4: Configure Backend Environment Variables

Create a file named `.env` inside the `backend/` directory (`backend/.env`):

```env
# Database Connection (Neon Serverless PostgreSQL or Local PostgreSQL)
DATABASE_URL=postgresql://<username>:<password>@<host>:<port>/<database>?sslmode=require

# Internal Cryptographic Signing
SECRET_KEY=orderly-dev-secret-key-change-in-production-64char-hex
ALGORITHM=HS256

# Cross-Origin Resource Sharing (Allowed Frontend Origins)
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# AI Provider Configuration (Groq NLU & Gemini Vision OCR)
GROQ_API_KEY=<your-groq-api-key>
GROQ_MODEL=qwen/qwen3.8-27b
GEMINI_API_KEY=<your-gemini-api-key>
GEMINI_API_KEY1=<your-backup-gemini-api-key>
GEMINI_MODEL=gemini-2.5-flash

# Cloudinary Media Storage (Optional for local testing; needed for image uploads)
CLOUDINARY_CLOUD_NAME=<your-cloudinary-cloud-name>
CLOUDINARY_API_KEY=<your-cloudinary-api-key>
CLOUDINARY_API_SECRET=<your-cloudinary-api-secret>

# Firebase Admin Authentication
FIREBASE_PROJECT_ID=<your-firebase-project-id>
FIREBASE_CLIENT_EMAIL=<your-firebase-service-account-client-email>
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n<your-private-key>\n-----END PRIVATE KEY-----\n"
```

> **Note on AI Fallback:** If `GROQ_API_KEY` is omitted or unconfigured, the backend automatically and transparently engages `deterministic_nlu_fallback`, enabling complete local testing of all conversational order parsing with zero external API dependencies.

---

### Step 2.5: Run Database Migrations (Alembic)

Initialize the relational schema in your PostgreSQL database by running the Alembic migration chain from within the `backend/` directory:

```bash
alembic upgrade head
```

This generates all 12 core relational tables (`users`, `staff_invitations`, `retailers`, `retailer_users`, `retailer_assignments`, `retailer_settings`, `products`, `brands`, `distributor_product_prices`, `retailer_product_prices`, `schemes`, `scheme_rules`, `credit_accounts`, `orders`, `order_items`, `order_status_history`) along with all unique indexes, foreign key cascades, and check constraints.

### Step 2.6: Seed Realistic Sample FMCG Data

Populate the database with realistic Jabalpur FMCG distribution records (including master brands, SKUs, active trade schemes, retailer credit ledgers, salesman beats, and pre-existing beat orders):

```bash
python seed.py
```

**Expected Seed Output:**

```text
Catalogue: 0 new products (or N inserted)
Inventory: 0 new stock records
Created salesman: rajesh.sales@orderly.in
Created salesman: sunil.sales@orderly.in
Created salesman: amit.sales@orderly.in
Created Kirana: Shree Mahavir Kirana Stores (RET-JBP-01)
Created Kirana: Gupta Provision & General Mart (RET-JBP-02)
Created Kirana: Patel Brothers Daily Needs (RET-JBP-03)
Created Kirana: Jabalpur Wholesale Traders (RET-JBP-04)
Created Kirana: Sharma Ji Kirana Ghar (RET-JBP-05)
Created Kirana: Agrawal FMCG Super Store (RET-JBP-06)
Created beat orders: ORD-SALES-JBP-01 through 06
Successfully seeded real salesmen, retailers, beat assignments, and orders!
```

---

### Step 2.7: Start the FastAPI Backend Server

Launch the Uvicorn ASGI application server with hot-reload enabled:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Verify the backend is functioning by opening the following URLs in your web browser:

- **Interactive OpenAPI / Swagger Docs:** `http://localhost:8000/docs`
- **Alternative ReDoc UI:** `http://localhost:8000/redoc`
- **Health Check Endpoint:** `http://localhost:8000/health` (Returns `{"success": true, "message": "Orderly API is running", "status": "healthy"}`)
- **API Root Metadata:** `http://localhost:8000/`

---

### Step 2.8: Execute the Automated Test Suite

In a separate terminal (with the virtual environment activated in `backend/`), execute the full test suite:

```bash
pytest
```

**Expected Test Output:**

```text
============================= test session starts =============================
platform win32 -- Python 3.11.x, pytest-9.2.0, pluggy-1.7.0
rootdir: .../backend, configfile: pytest.ini
plugins: anyio-4.16.0, asyncio-1.4.1.post1
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

---

### Step 2.5: Run Database Migrations (Alembic)

Initialize the relational schema in your PostgreSQL database by running the Alembic migration chain from within the `backend/` directory:

```bash
alembic upgrade head
```

This generates all 12 core relational tables (`users`, `staff_invitations`, `retailers`, `retailer_users`, `retailer_assignments`, `retailer_settings`, `products`, `brands`, `distributor_product_prices`, `retailer_product_prices`, `schemes`, `scheme_rules`, `credit_accounts`, `orders`, `order_items`, `order_status_history`) along with all unique indexes, foreign key cascades, and check constraints.

### Step 2.6: Seed Realistic Sample FMCG Data

Populate the database with realistic Jabalpur FMCG distribution records (including master brands, SKUs, active trade schemes, retailer credit ledgers, salesman beats, and pre-existing beat orders):

```bash
python seed.py
```

**Expected Seed Output:**

```text
Catalogue: 0 new products (or N inserted)
Inventory: 0 new stock records
Created salesman: rajesh.sales@orderly.in
Created salesman: sunil.sales@orderly.in
Created salesman: amit.sales@orderly.in
Created Kirana: Shree Mahavir Kirana Stores (RET-JBP-01)
Created Kirana: Gupta Provision & General Mart (RET-JBP-02)
Created Kirana: Patel Brothers Daily Needs (RET-JBP-03)
Created Kirana: Jabalpur Wholesale Traders (RET-JBP-04)
Created Kirana: Sharma Ji Kirana Ghar (RET-JBP-05)
Created Kirana: Agrawal FMCG Super Store (RET-JBP-06)
Created beat orders: ORD-SALES-JBP-01 through 06
Successfully seeded real salesmen, retailers, beat assignments, and orders!
```

---

### Step 2.7: Start the FastAPI Backend Server

Launch the Uvicorn ASGI application server with hot-reload enabled:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Verify the backend is functioning by opening the following URLs in your web browser:

- **Interactive OpenAPI / Swagger Docs:** `http://localhost:8000/docs`
- **Alternative ReDoc UI:** `http://localhost:8000/redoc`
- **Health Check Endpoint:** `http://localhost:8000/health` (Returns `{"success": true, "message": "Orderly API is running", "status": "healthy"}`)
- **API Root Metadata:** `http://localhost:8000/`

---

### Step 2.8: Execute the Automated Test Suite

In a separate terminal (with the virtual environment activated in `backend/`), execute the full test suite:

```bash
pytest
```

**Expected Test Output:**

```text
============================= test session starts =============================
platform win32 -- Python 3.11.x, pytest-9.2.0, pluggy-1.7.0
rootdir: .../backend, configfile: pytest.ini
plugins: anyio-4.16.0, asyncio-1.4.1.post1
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

## 3. Production Cloud Deployment Architecture

Orderly is deployed on modern cloud infrastructure using isolated services for application hosting, database persistence, AI processing, and static media delivery.

### 3.1 Deployment Architecture

The production architecture consists of the following components:

```text
                  [ Vercel Edge Global CDN ]
                            |
                          HTTPS
                            |
                            v
                  [ Next.js 16 Frontend ]
                            |
                       REST API / JSON
                            |
                            v
                  [ Render Web Service ]
                            |
                  [ FastAPI Backend ]
                    (Uvicorn ASGI)
                            |
          +-----------------+------------------+
          |                 |                  |
          v                 v                  v
   [ Neon PostgreSQL ] [ Groq LPU API ] [ Gemini 2.5 Flash API ]
       (Database)         (NLU)               (OCR)

                            |
                            v
                  [ Cloudinary CDN ]
                    (Media Storage)
```

**Backend infrastructure:**

- Hosting platform: Render Web Service
- Framework: FastAPI
- ASGI server: Uvicorn
- Runtime: Python 3.11.9 (pinned)
- Port: Dynamically assigned through the `PORT` environment variable
- Health check endpoint: `/health`
- Deployment strategy: Continuous deployment through GitHub integration

**Frontend infrastructure:**

- Hosting platform: Vercel
- Framework: Next.js 16
- Content delivery: Vercel Edge Global CDN
- Communication: HTTPS-based REST API requests using JSON

**External services:**

- Neon Serverless PostgreSQL for relational data persistence.
- Groq LPU API for natural language understanding and AI-assisted order processing.
- Gemini 2.5 Flash API for image and OCR processing.
- Cloudinary CDN for media storage and delivery.

### 3.2 Backend Deployment on Render

The FastAPI backend is hosted as a Render Web Service.

**Step 1: Create a Web Service**

1. Sign in to the [Render Dashboard](https://dashboard.render.com).
2. Click **New +** and select **Web Service**.
3. Connect the GitHub repository:
   [https://github.com/ved-2/orderly](https://github.com/ved-2/orderly).

**Step 2: Configure Service Settings**

| Setting           | Configuration                                     |
| ----------------- | ------------------------------------------------- |
| Service Name      | `orderly-api`                                     |
| Region            | Singapore (or the region closest to target users) |
| Branch            | `main`                                            |
| Root Directory    | `backend`                                         |
| Runtime           | Python                                            |
| Python Version    | `3.11.9`                                          |
| Health Check Path | `/health`                                         |

The repository contains a `.python-version` file specifying Python 3.11.9 to maintain runtime consistency and compatibility with project dependencies.

**Build Command:**

```bash
pip install --upgrade pip && pip install -r requirements.txt
```

**Start Command:**

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**Step 3: Configure Environment Variables**

Navigate to the Render service's **Environment** section and configure all required backend environment variables.

The `DATABASE_URL` must use the Neon PostgreSQL connection string with SSL enabled using `sslmode=require`.

Refer to Section 5 for the complete list of required environment variable names.

**Step 4: Deploy and Verify**

1. Click **Create Web Service** to initiate deployment.
2. Wait for the build and deployment process to complete.
3. Verify the health endpoint:

```text
https://<your-service>.onrender.com/health
```

Expected result: HTTP `200 OK`.

4. Verify the API documentation:

```text
https://<your-service>.onrender.com/docs
```

The Swagger UI should load successfully if the API documentation endpoint is enabled.

### 3.3 Frontend Deployment on Vercel

The Next.js frontend is deployed on Vercel and delivered through its global edge network.

**Step 1: Import the Project**

1. Sign in to [Vercel](https://vercel.com).
2. Click **Add New** and select **Project**.
3. Import the GitHub repository:
   [https://github.com/ved-2/orderly](https://github.com/ved-2/orderly).

**Step 2: Configure Project Settings**

| Setting          | Configuration |
| ---------------- | ------------- |
| Framework Preset | Next.js       |
| Root Directory   | `frontend`    |
| Build Command    | `next build`  |
| Output Directory | `.next`       |
| Install Command  | `npm install` |

Setting the root directory to `frontend` ensures that Vercel detects the correct Next.js application and its dependencies.

**Step 3: Configure Environment Variables**

Under the Vercel project's **Settings → Environment Variables**, configure the following:

| Variable                                   | Description                          |
| ------------------------------------------ | ------------------------------------ |
| `NEXT_PUBLIC_API_BASE_URL`                 | Production backend API base URL      |
| `NEXT_PUBLIC_API_URL`                      | Backend API URL used by the frontend |
| `NEXT_PUBLIC_FIREBASE_API_KEY`             | Firebase Web API key                 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`         | Firebase authentication domain       |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`          | Firebase project identifier          |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`      | Firebase storage bucket              |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID         |
| `NEXT_PUBLIC_FIREBASE_APP_ID`              | Firebase application identifier      |

The API URL variables should point to the deployed Render backend, including the API version prefix:

```text
https://<your-render-service>.onrender.com/api/v1
```

Firebase configuration values must correspond to the project's registered Firebase Web App.

**Step 4: Deploy**

1. Click **Deploy**.
2. Vercel installs dependencies and builds the Next.js application.
3. Once deployment succeeds, Vercel assigns a production URL.

Production URL:

[https://orderly-eight-silk.vercel.app](https://orderly-eight-silk.vercel.app)

### 3.4 Database Deployment on Neon

Orderly uses Neon Serverless PostgreSQL as its managed relational database.

**Step 1: Create a Database**

1. Sign in to [Neon](https://neon.tech).
2. Create a new PostgreSQL project named `orderly-db`.
3. Select PostgreSQL 16.
4. Choose a suitable deployment region, such as Singapore.

**Step 2: Configure Database Connectivity**

1. Open the Neon project dashboard.
2. Navigate to the connection details.
3. Select the pooled connection option.
4. Copy the PostgreSQL connection string with SSL enabled.

The connection string should be configured through the backend's `DATABASE_URL` environment variable.

Example format:

```text
postgresql://<username>:<password>@<host>/<database>?sslmode=require
```

Never commit database credentials or connection strings to the Git repository.

**Step 3: Apply Database Migrations**

Database migrations are managed through Alembic.

From the project root, execute:

```bash
cd backend
```

Configure the Neon connection string in the local `backend/.env` file.

Apply all pending migrations:

```bash
alembic upgrade head
```

**Step 4: Seed Sample Data**

Populate the database with realistic demonstration data:

```bash
python seed.py
```

The seed process initializes the sample records required to demonstrate the application's core workflows, subject to the implementation in the repository.

**Step 5: Verify Database Setup**

Confirm that:

- The database connection is successful.
- All Alembic migrations have been applied.
- Required tables and relationships exist.
- Sample data has been inserted successfully.
- The backend can execute database queries without connection errors.

The Neon database is now ready to be used by the deployed FastAPI backend.


---

## 4. Environment Variables Dictionary (Names Only)

> **Submission Security Policy:** In strict compliance with internship and client evaluation rules, **only variable names and purposes are listed below**. No actual secret keys, private credentials, or live database passwords are included.

### 4.1 Backend Environment Variables (`backend/.env`)

| Variable Name | Purpose & Usage | Required | Default / Format |
| :--- | :--- | :---: | :--- |
| `DATABASE_URL` | PostgreSQL connection string for Neon or local database | **Yes** | `postgresql://user:pass@host:port/db?sslmode=require` |
| `SECRET_KEY` | Cryptographic secret for signing internal session tokens | **Yes** | Random 64-character hexadecimal string |
| `ALGORITHM` | Token hashing algorithm | **Yes** | `HS256` |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins | **Yes** | `http://localhost:3000,http://127.0.0.1:3000` |
| `GROQ_API_KEY` | Groq API key for Llama/Qwen NLU entity extraction | Optional* | String (Falls back to deterministic NLU if absent) |
| `GROQ_MODEL` | Groq LLM model identifier | Optional | Default: `qwen/qwen3.8-27b` |
| `GEMINI_API_KEY` | Google Gemini API key for handwritten parchi slip OCR | Optional | String |
| `GEMINI_API_KEY1` | Secondary backup Google Gemini API key for rotation | Optional | String |
| `GEMINI_MODEL` | Gemini vision model identifier | Optional | Default: `gemini-2.5-flash` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud identifier for media asset hosting | Optional | String |
| `CLOUDINARY_API_KEY` | Cloudinary API access key | Optional | Numeric string |
| `CLOUDINARY_API_SECRET` | Cloudinary secret key for asset signing | Optional | Alphanumeric string |
| `FIREBASE_PROJECT_ID` | Firebase project identifier for token verification | **Yes** | Project ID slug |
| `FIREBASE_CLIENT_EMAIL` | Firebase Admin service account client email | **Yes** | Service account email format |
| `FIREBASE_PRIVATE_KEY` | Firebase Admin service account RSA private key | **Yes** | Multi-line PEM private key format |

---

### 4.2 Frontend Environment Variables (`frontend/.env.local`)

| Variable Name | Purpose & Usage | Required | Example Format |
| :--- | :--- | :---: | :--- |
| `NEXT_PUBLIC_API_BASE_URL` | Base URL for Orderly Backend REST API v1 | **Yes** | `http://localhost:8000/api/v1` or `https://<render-url>/api/v1` |
| `NEXT_PUBLIC_API_URL` | Alternate fallback alias for backend API base URL | Optional | `http://localhost:8000/api/v1` or `https://<render-url>/api/v1` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web Client API Key | **Yes** | Web API key string |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Web Auth Domain | **Yes** | `<project-id>.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Project Identifier | **Yes** | Project ID slug |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`| Firebase Cloud Storage bucket identifier | **Yes** | `<project-id>.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Cloud Messaging sender ID | **Yes** | Numeric identifier |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Web Client Application ID | **Yes** | `1:<numeric-id>:web:<alphanumeric>` |


---

## 5. Demo Reviewer Accounts & Role Access

The database is pre-seeded with realistic evaluation accounts across all four system roles defined in the client brief. Reviewers can log in directly using these accounts or create a fresh account via the self-registration portal.

### 5.1 Pre-Seeded Evaluation Accounts

| System Role | Demo Email Address | Organization / Seed Context | Default Portal Route | Permitted Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Distributor Admin** | `vdntkolte@gmail.com` | Company A Headquarters (Jabalpur) | `/distributor` | Full system access: catalog, pricing, schemes, staff invites, sales metrics |
| **Order Desk Operator** | `orderdesk@orderly.in` | Jabalpur Central Dispatch Desk | `/order-desk` | Order verification, credit holds, Tally XML export, van loading sheets |
| **Field Salesman (Beat 1)**| `rajesh.sales@orderly.in` | Beat 1: Wright Town & Napier Town | `/salesman` | Store visits, counter order placement, beat performance summary |
| **Field Salesman (Beat 2)**| `sunil.sales@orderly.in` | Beat 2: Gorakhpur & Sadar Bazaar | `/salesman` | Store visits, counter order placement, beat performance summary |
| **Kirana Retailer** | `vedantkolte18@gmail.com` | Shree Mahavir Kirana Stores (`RET-JBP-01`) | `/retailer` | Catalog, cart with schemes, AI order capture, credit ledger balance |

---

### 5.2 Reviewer Self-Registration (Zero Pre-Configuration Needed)

If an evaluator prefers to test the registration and onboarding flow with their own credentials:

1. Navigate to [local registration](http://localhost:3000/register) or [live registration](https://orderly-eight-silk.vercel.app/register).
2. Toggle between **"Kirana Retailer"** and **"Distributor Admin"**.
3. Sign up using any standard email and password (or use Google Single Sign-On).
4. **Automatic Seeding on Registration:**
   - When a new **Retailer** signs up, the backend automatically assigns an active retailer code (`RET-JBP-XX`), initializes a credit account ledger with a default limit of ₹50,000, and unlocks wholesale catalogue pricing.
   - When a new **Distributor Admin** signs up, the backend initializes administrator privileges granting access to the `/distributor` console.

   
## 6. Operational Troubleshooting & Edge Cases

This section documents common operational issues that may occur during local development or cloud deployment, along with their symptoms, root causes, and recommended resolutions.

### 6.1 Render Backend Cold Starts (Free Tier)

**Symptom:**  
The first login or API request may take approximately 30–45 seconds to respond after several hours of inactivity.

**Root Cause:**  
Render automatically spins down free-tier web services after 15 minutes of inactivity. When a new request arrives, the service needs time to start again.

**Built-in Solution:**  
The Orderly frontend (`frontend/src/lib/api.ts`) implements:
- An extended 45-second `AbortController` request timeout.
- An automatic warm-up banner informing users that the cloud backend is starting.
- Extended request handling to accommodate backend initialization.

Once the backend is active, subsequent requests are expected to respond significantly faster, typically in under 300 ms under normal conditions.

### 6.2 CORS (Cross-Origin Resource Sharing) Errors

**Symptom:**  
The browser console displays an error similar to:

```text
Access to fetch at ... has been blocked by CORS policy.
```

**Resolution:**

1. Open `backend/.env`.
2. Ensure that `CORS_ORIGINS` includes the frontend origin.

   Example for local development:

   ```env
   CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
   ```

3. Verify the CORS configuration in `backend/app/main.py`.

The backend also includes a regular-expression allow-list:

```python
r"https://.*\.vercel\.app"
```

This permits matching Vercel-hosted preview and production deployment origins.

### 6.3 PostgreSQL SSL Mode Requirement

**Symptom:**  
The backend encounters database connection errors, such as:

```text
sslmode=require not recognized
```

or:

```text
no pg_hba.conf entry for host
```

**Resolution:**

When connecting to a cloud-hosted Neon PostgreSQL instance, ensure that the database connection string includes the required SSL mode.

Example:

```text
postgresql://<username>:<password>@<host>/<database>?sslmode=require
```

Configure this connection string through the backend's `DATABASE_URL` environment variable.

Do not commit database credentials or connection strings to the repository.

### 6.4 Local Port Conflicts

**Symptom:**  
The application fails to start because the required port is already occupied.

Example error:

```text
OSError: [Errno 98] Address already in use
```

**Resolution:**

Use Windows PowerShell to identify and terminate the process occupying the required port.

**Backend (Port 8000):**

```powershell
# Find and terminate the process using port 8000
Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process -Force
```

**Frontend (Port 3000):**

```powershell
# Find and terminate the process using port 3000
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
```

After terminating the conflicting process, restart the corresponding development server.

### 6.5 Python Runtime Pinning (`.python-version`)

**Symptom:**  
The cloud deployment fails during dependency installation with errors related to compiling `pydantic-core` using Cargo or Maturin.

**Root Cause:**  
Newer or pre-release Python versions may not have compatible pre-built CPython binary wheels available for every project dependency. This can force package installation to fall back to source compilation.

**Resolution:**  
The repository contains a `.python-version` file that pins the Python runtime to:

```text
3.11.9
```

This maintains runtime consistency between development and deployment environments and allows compatible pre-built Linux wheels to be installed without unnecessary source compilation.

---

## 7. Conclusion

Orderly is a full-stack distributor-retailer ordering platform designed to address the operational challenges outlined in the evaluation brief.

The system brings together retailer management, product cataloguing, order processing, pricing and scheme calculations, credit management, and AI-assisted order capture within a unified application.

The implementation combines a Next.js frontend, FastAPI backend, PostgreSQL database, and integrated cloud services to provide a modular and deployable architecture.

The project has been validated through **88 automated tests**, along with realistic sample data and deployment verification, as reported by the project test suite.

For technical inquiries, source-code review, or an evaluation walkthrough, refer to the following resources:

- **GitHub Repository:** [https://github.com/ved-2/orderly](https://github.com/ved-2/orderly)
- **Live API Documentation:** [https://orderly-w9x4.onrender.com/docs](https://orderly-w9x4.onrender.com/docs)
