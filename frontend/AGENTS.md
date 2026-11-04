
# Orderly - AI Agent Instructions

## 1. Project Overview

Orderly is a B2B ordering and order-intelligence platform designed for FMCG distributors.

The platform helps distributors manage retailers, products, pricing, inventory, schemes, credit, orders, salesmen, and order processing through a centralized system.

The primary objective is to replace error-prone manual order collection and processing with a reliable, structured, auditable digital workflow.

### Business Context

- Approximately 1,800 retailer shops.
- 4 FMCG brands.
- Approximately 70 staff members.
- 18 salesmen.
- Approximately ₹85-100 crore annual revenue.
- Approximately 600 orders per day.

Orders currently arrive through:
- Text messages.
- Handwritten order photographs.
- Hindi voice notes.
- Salesman notebooks.

Office staff manually interpret these orders and enter them into Tally.

Orderly aims to reduce manual work, ordering errors, and processing delays.

---

# 2. MOST IMPORTANT: DESIGN PHILOSOPHY

## Do NOT create a vibe-coded website.

The website must NOT look like a generic AI-generated SaaS template.

Every design decision must be intentional, restrained, professional, and justified by actual product requirements.

I do not want a website that looks like someone entered "make a modern SaaS dashboard" into an AI tool.

Build a real business product, not a Dribbble concept.

### Strict Design Restrictions

NEVER use:

- Purple gradients.
- Blue-purple or pink-purple gradient backgrounds.
- Random colorful gradient blobs.
- Excessive glassmorphism.
- Excessive blur effects.
- Glowing borders.
- Neon colors.
- Pill-shaped buttons.
- Excessively rounded cards.
- Unnecessary floating elements.
- Fake charts or fake business metrics.
- Fake testimonials.
- Fake customer reviews.
- Fake notification counts.
- Generic hero text.
- Generic AI-generated marketing copy.
- Emoji icons.
- Decorative icons without a functional purpose.
- Excessive scroll animations.
- Cursor-following animations.
- Custom animated cursors.
- Unnecessary parallax.
- "Made with AI" labels.
- Overly large headings that waste space.
- Excessive whitespace that reduces information density.
- Unnecessary animations just to make the website look impressive.

Do not use em dashes in UI copy.

### Visual Direction

The visual direction should feel like a carefully designed enterprise operations product.

Think:

- Clear information hierarchy.
- Strong typography.
- Restrained color palette.
- Neutral backgrounds.
- Consistent spacing.
- Sharp and intentional layouts.
- Subtle borders.
- Minimal shadows.
- Functional navigation.
- Dense but readable data presentation.
- Excellent alignment.
- Consistent component sizing.

Prefer:
- White and light neutral surfaces.
- Slate and gray typography.
- Dark charcoal for primary actions.
- One restrained accent color when necessary.
- Clear status colors only when they convey meaning.

Use color to communicate information, not decorate empty space.

### Buttons and Components

- Buttons should be rectangular or modestly rounded.
- Do not use pill-shaped buttons.
- Cards should have intentional borders and spacing.
- Tables should prioritize readability.
- Inputs should have clear labels and validation.
- Dialogs should be used only when appropriate.
- Every interactive component must have a real purpose.

### Typography

- Use a consistent typography scale.
- Avoid oversized headings.
- Maintain strong readability.
- Use font weights intentionally.
- Use tabular numerals for financial and numerical data where appropriate.

### Animation

Use animation only when it improves understanding.

Acceptable:
- Small transition effects.
- Loading indicators.
- Subtle hover feedback.
- Meaningful state transitions.

Not acceptable:
- Animation everywhere.
- Large entrance animations.
- Scroll-triggered decorative animations.
- Cursor animations.
- Distracting movement.

### Design Decision Rule

Before implementing a component, ask:

1. Does this element serve a real user need?
2. Does it improve usability?
3. Is it visually consistent with the rest of the product?
4. Is the complexity justified?
5. Would this look appropriate in a serious enterprise business application?

If not, remove it.

Never add visual decoration merely to make a page look more impressive.

---

# 3. Product Roles

Orderly has four primary roles.

## RETAILER

- Register and authenticate.
- View product catalogue.
- View retailer-specific prices.
- Add products to cart.
- Create order drafts.
- Submit orders.
- View own order history.
- View own order status.

## SALESMAN

- Access assigned retailers only.
- Create orders for assigned retailers.
- Support offline order capture.
- Synchronize pending offline orders.
- View relevant retailer information.

## ORDER_DESK

- View submitted orders.
- Review order details.
- Start order review.
- Verify prices, stock, schemes, and credit.
- Approve orders.
- Reject orders with reasons.
- Manage order processing.

## DISTRIBUTOR_ADMIN

- Manage brands.
- Manage products.
- Manage product aliases.
- Manage retailers.
- Manage staff.
- Manage salesman assignments.
- Manage pricing.
- Manage inventory.
- Manage schemes.
- Manage credit limits.
- View analytics.
- Manage distributor operations.

---

# 4. Locked Product Decisions

Do not change these decisions without explicit approval.

- Every order requires Order Desk approval.
- Retailer web application is the primary ordering channel.
- Salesman application uses PWA and offline capabilities.
- Telegram is the AI ordering demonstration channel.
- WhatsApp integration is not selected.
- All channels use one shared backend.
- All channels use one shared PostgreSQL database.
- Tally-compatible CSV export is required.
- Live Tally integration is out of scope.
- Delivery tracking is out of scope.
- In-app payments are out of scope.
- AI extraction and order lifecycle are separate concerns.
- Retailers must confirm extracted AI orders before submission.
- AI cannot approve orders or modify commercial data.

---

# 5. Technology Stack

## Frontend

- Next.js 16
- React 19
- TypeScript
- App Router
- Tailwind CSS
- shadcn/ui
- TanStack Query
- React Hook Form
- Zod

## Backend

- Python
- FastAPI
- SQLAlchemy 2.0
- Alembic
- Pydantic

## Database

- PostgreSQL

## Authentication

- Firebase Authentication
- Firebase Admin SDK

## Storage

- Cloudinary for product images.

## AI

- Groq API
- Pydantic structured extraction
- RapidFuzz for product matching

## Background Processing

- Redis
- Celery

Use background processing only where necessary.

## Testing

- Pytest
- Vitest
- Playwright

## Deployment

- Docker
- Vercel
- Managed PostgreSQL
- Backend hosting
- GitHub Actions

---

# 6. Architecture Rules

Orderly follows a modular monolith architecture.

Do NOT introduce microservices.

Do NOT introduce unnecessary infrastructure.

Do NOT add:
- Kubernetes.
- Neo4j.
- Vector databases.
- LangGraph.
- React Native.
- Flutter.

Do not introduce new technologies without a clear requirement.

### Backend Organization

Keep code organized by business modules.

Examples:

- auth
- users
- retailers
- products
- pricing
- inventory
- schemes
- credit
- orders
- staff
- analytics

Follow existing module conventions.

Do not duplicate existing business logic.

Reuse existing services, schemas, models, and utilities.

---

# 7. Database and Business Rules

## Authentication and Authorization

Firebase authenticates users.

PostgreSQL determines application roles and permissions.

Never trust frontend role information as the source of authorization.

Every protected backend endpoint must enforce authorization.

Public registration must not allow arbitrary role selection.

Retailers register themselves.

Salesmen and Order Desk staff are created through Admin invitations.

Admin accounts cannot be publicly registered.

## Retailer Data Isolation

Retailers must only access their own:

- Orders.
- Prices.
- Credit information.
- Purchase history.
- Shop details.

Salesmen must only access assigned retailers.

Do not expose sensitive information through unnecessarily broad API responses.

## Pricing

Pricing priority:

1. Retailer-specific price.
2. Distributor-default price.
3. Return a clear error if no valid price exists.

Pricing must respect effective dates.

GST inclusion/exclusion must be explicit.

Never invent a GST rate.

## Inventory

Inventory supports multiple warehouses.

Stock reservation happens only when an order is approved.

Do not reserve stock when creating a draft or submitting an order.

Use transactions and appropriate row locking to prevent overselling.

Free quantities from schemes must also consume inventory.

## Credit

New retailers start with zero credit limit.

Credit eligibility must be checked during order approval.

Do not assume that a retailer has credit.

## Schemes

Reuse the existing scheme calculation engine.

Do not create duplicate scheme calculation logic.

Scheme eligibility and free quantities must be validated again during approval.

---

# 8. Order Lifecycle

Allowed statuses:

- DRAFT
- SUBMITTED
- UNDER_REVIEW
- APPROVED
- ON_HOLD
- REJECTED
- DISPATCHED
- CANCELLED

Expected lifecycle:

DRAFT
  -> SUBMITTED
  -> UNDER_REVIEW
  -> APPROVED
  -> DISPATCHED

Alternative transitions include ON_HOLD and REJECTED.

All meaningful status transitions must create an order status history record.

Do not allow arbitrary status changes.

### Order Approval

Order approval must be transactional.

Before approval:

1. Lock the order.
2. Verify the current status.
3. Revalidate retailer eligibility.
4. Revalidate current product prices.
5. Revalidate stock.
6. Revalidate scheme eligibility.
7. Revalidate credit.
8. Account for free quantities.
9. Reserve inventory.
10. Create inventory transaction records.
11. Update order status.
12. Record approval timestamp.
13. Create status history.

If any critical operation fails, roll back the transaction.

Never partially approve an order.

### Order Rejection

- A rejection reason is required.
- Store the reason in the order's appropriate notes field.
- Record status history.
- Preserve the order and its items for auditing.

---

# 9. AI Ordering Safety

AI is an extraction assistant, not an authority over business operations.

AI can:
- Extract product names.
- Extract quantities.
- Identify likely SKUs.
- Suggest product matches.
- Interpret supported Hindi and English order inputs.

AI cannot:
- Approve orders.
- Change prices.
- Change stock.
- Modify schemes.
- Modify credit limits.
- Execute SQL.
- Execute arbitrary tools.
- Bypass retailer confirmation.

Ambiguous product names and units must be clarified.

For example, "peti" must not automatically be interpreted as a specific case quantity without verified product context.

The retailer must confirm the final extracted order before submission.

---

# 10. Coding Standards

Write production-minded code.

### General

- Use meaningful variable names.
- Avoid unnecessary abstractions.
- Avoid duplicated logic.
- Keep functions focused.
- Use explicit types.
- Handle errors intentionally.
- Validate external input.
- Keep business rules in backend services.
- Keep frontend components focused.
- Avoid giant components.
- Avoid unnecessary dependencies.

### TypeScript

- Avoid `any`.
- Use proper interfaces and types.
- Validate API response assumptions.
- Handle loading, error, and empty states.
- Do not suppress TypeScript errors without justification.

### Python

- Use type hints.
- Use Pydantic schemas for API boundaries.
- Use SQLAlchemy 2.0 patterns.
- Keep routes thin.
- Put business logic in services.
- Use transactions correctly.
- Handle rollback on failure.

### API Design

- Use consistent endpoint naming.
- Return predictable response structures.
- Use appropriate HTTP status codes.
- Validate pagination parameters.
- Avoid exposing database internals.
- Enforce authorization server-side.

### Security

- Never hardcode credentials.
- Never commit secrets.
- Never trust frontend authorization.
- Prevent insecure direct object references.
- Validate user ownership.
- Protect against duplicate submissions.
- Use idempotency where appropriate.
- Avoid leaking sensitive data in error messages.

---

# 11. Frontend Engineering Rules

- Use the existing Next.js App Router structure.
- Reuse existing components.
- Reuse the existing API client.
- Reuse AuthProvider.
- Do not create a second authentication implementation.
- Keep data fetching consistent with existing patterns.
- Use proper loading states.
- Use proper error states.
- Use proper empty states.
- Provide responsive layouts.
- Make forms accessible.
- Preserve mobile usability.

Do not make pages that only look functional.

Every button, link, filter, and action must work.

Do not use mock data in production-facing functionality.

If mock data is necessary during development, label it clearly and isolate it from real API integration.

---

# 12. Responsive Design

The application must work on:

- Desktop.
- Laptop.
- Tablet.
- Mobile.

Retailer ordering should be mobile-first.

Order Desk and Admin dashboards should prioritize desktop productivity while remaining usable on smaller screens.

Tables should have appropriate responsive behavior.

Do not simply shrink a desktop layout until it fits mobile.

Design responsive information hierarchy intentionally.

---

# 13. Testing and Verification

Never claim that code works without verification.

After relevant backend changes:

    python -m compileall app
    pytest -q

After relevant frontend changes:

    npm run lint
    npm run build

Run tests from the correct project directory.

For critical business logic, write tests for:

- Successful operations.
- Invalid input.
- Unauthorized access.
- Missing resources.
- Duplicate requests.
- Concurrent requests.
- Transaction rollback.
- Boundary conditions.

Order approval, pricing, stock, credit, and authorization require especially careful testing.

Do not ignore failing tests.

Do not hide errors by weakening tests.

---

# 14. Git and Commit History

Preserve the existing Git history.

Never casually:
- Squash commits.
- Rewrite history.
- Delete meaningful commits.
- Force-push.
- Reset completed work.

Use small logical commits.

Follow Conventional Commits.

Examples:

    feat(orders): add order desk pending queue
    feat(auth): add staff invitation flow
    fix(inventory): prevent stock overselling
    test(pricing): cover retailer price fallback
    refactor(orders): extract approval validation
    chore: update development documentation

Before committing:

1. Inspect changed files.
2. Run relevant tests.
3. Review the diff.
4. Check for secrets.
5. Ensure no generated or temporary files are included.

Never commit:
- .env
- .venv
- node_modules
- .next
- Python cache files
- API credentials
- Private keys

Push completed milestones regularly.

---

# 15. AI Agent Workflow

These instructions are mandatory for every coding task.

## Before making changes

1. Understand the existing code.
2. Inspect relevant files when necessary.
3. Identify existing services and reusable components.
4. Understand database relationships.
5. Check existing API response structures.
6. Check existing authorization patterns.
7. Identify possible side effects.

Do not ask the developer to resend files that are already available in conversation context.

Do not assume fields, models, endpoint paths, or role implementation details.

If information is missing, inspect the smallest relevant portion of the codebase.

## While implementing

1. Work in small logical steps.
2. Follow existing architecture.
3. Reuse existing code.
4. Avoid unnecessary file creation.
5. Avoid unnecessary dependencies.
6. Preserve existing functionality.
7. Keep changes scoped to the requested task.

Do not rewrite entire modules when a small change is sufficient.

## After implementing

1. Explain which files changed.
2. Explain what the implementation does.
3. Provide exact commands to test.
4. Identify any remaining limitations.
5. Recommend a Git commit only after verification.

Never claim tests passed unless actual test output confirms it.

## Communication Style

The developer prefers direct, practical, step-by-step guidance.

- Give exact file paths.
- Provide complete code when requested.
- Give PowerShell commands when working on Windows.
- Specify the correct working directory.
- Avoid unnecessary explanations.
- Do not repeatedly ask for already-provided information.
- Do not jump ahead to future milestones.
- Do not invent implementation details.
- Do not say something is complete without evidence.

Build one verified milestone at a time.

---

# 16. Current Project State

The project already contains substantial implementation.

Reported completed modules include:

- Repository and project scaffolding.
- Next.js frontend.
- FastAPI backend.
- PostgreSQL and Alembic.
- User and retailer models.
- Product and brand modules.
- Pricing.
- Inventory.
- Schemes.
- Credit.
- Order models and calculation services.
- Firebase authentication scaffolding.
- Retailer registration.
- Retailer dashboard.
- Product catalogue.
- Cloudinary image integration.
- Cart.
- Retailer checkout.
- Retailer order submission.
- Order Desk pending-orders API code.

Do not recreate these modules without first checking the repository.

## Current Development Focus

The current implementation phase is the Order Desk module.

Expected frontend structure:

    frontend/src/app/order-desk/
    ├── page.tsx
    └── orders/
        ├── page.tsx
        └── [orderId]/
            └── page.tsx

The directories have been created.

The dashboard page implementation has been proposed, but its creation has not yet been confirmed.

The pending-orders API code has been added according to developer confirmation, but its test results still need verification.

## Next Milestones

1. Complete Order Desk dashboard.
2. Implement role-aware navigation.
3. Build pending-orders list.
4. Build order details page.
5. Implement Start Review.
6. Implement transactional approval.
7. Implement rejection with reason.
8. Test Order Desk permissions and lifecycle.
9. Build Tally-compatible CSV export.
10. Complete Admin workflows.
11. Complete Salesman PWA.
12. Implement Telegram AI ordering.
13. Perform final security and deployment checks.

---

# 17. Final Non-Negotiable Principles

1. Build a real enterprise product, not a generic AI-generated SaaS template.
2. Never use purple gradients or unnecessary visual effects.
3. Never introduce fake business data.
4. Never sacrifice usability for visual decoration.
5. Never trust frontend authorization.
6. Never bypass Order Desk approval.
7. Never reserve stock before approval.
8. Never modify commercial data through AI.
9. Never duplicate existing business logic.
10. Never invent database fields or API contracts.
11. Never claim unverified functionality works.
12. Preserve Git history.
13. Test critical business operations.
14. Implement one milestone at a time.
15. Prioritize correctness, security, maintainability, and intentional design over speed or visual gimmicks.

**The goal is to build Orderly as a dependable, production-minded B2B business application that real distributors and their staff can use every day.**
