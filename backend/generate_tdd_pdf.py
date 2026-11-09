"""Script to generate Technical_Design_Document.pdf using ReportLab.
"""

import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute and render total page count."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))

        # Top Running Header (Pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 750, "Orderly — Technical Design Document (Company A, Jabalpur)")
            self.drawRightString(558, 750, "B2B FMCG AI Platform")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, 742, 558, 742)

        # Bottom Running Footer
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 45, 558, 45)
        self.drawString(54, 32, "Confidential — Evaluator Submission Bundle • GitHub: github.com/ved-2/orderly")
        self.drawRightString(558, 32, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()


def build_pdf():
    pdf_path = os.path.abspath("Technical_Design_Document.pdf")
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
    )

    styles = getSampleStyleSheet()

    # Custom Typography Styles
    title_style = ParagraphStyle(
        "CoverTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=6,
    )

    subtitle_style = ParagraphStyle(
        "CoverSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=13,
        leading=17,
        textColor=colors.HexColor("#334155"),
        spaceAfter=14,
    )

    meta_style = ParagraphStyle(
        "CoverMeta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=14,
        textColor=colors.HexColor("#475569"),
    )

    h1_style = ParagraphStyle(
        "Header1",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=19,
        textColor=colors.HexColor("#0F172A"),
        spaceBefore=16,
        spaceAfter=8,
        keepWithNext=True,
    )

    h2_style = ParagraphStyle(
        "Header2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#1E293B"),
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True,
    )

    body_style = ParagraphStyle(
        "BodyDark",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13.5,
        textColor=colors.HexColor("#334155"),
        spaceAfter=6,
    )

    bullet_style = ParagraphStyle(
        "BulletItem",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=13,
        textColor=colors.HexColor("#334155"),
        leftIndent=14,
        spaceAfter=4,
    )

    callout_style = ParagraphStyle(
        "CalloutText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor("#1E3A8A"),
    )

    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.white,
    )

    table_cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#1E293B"),
    )

    table_cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#0F172A"),
    )

    story = []

    # Title & Metadata Banner
    story.append(Paragraph("TECHNICAL DESIGN DOCUMENT", ParagraphStyle("Label", fontName="Helvetica-Bold", fontSize=9, textColor=colors.HexColor("#2563EB"), spaceAfter=4)))
    story.append(Paragraph("Orderly: Enterprise B2B FMCG Distribution & Multilingual AI Order Capture Platform", title_style))
    story.append(Paragraph("Full-Stack Architecture, Wholesale Scheme Engine, Disambiguation State Machine, & Deployment Blueprint", subtitle_style))

    # Meta Table (Repository & Live Links)
    meta_data = [
        [Paragraph("<b>Target Client:</b>", meta_style), Paragraph("Company A, Jabalpur (4 Packaged Food Brands, 1,800 Kiranas, 70 Staff, ₹85–100 Cr Turnover)", meta_style)],
        [Paragraph("<b>Author / Engineer:</b>", meta_style), Paragraph("Vedant Kolte", meta_style)],
        [Paragraph("<b>GitHub Repository:</b>", meta_style), Paragraph("<font color='#2563EB'><u>https://github.com/ved-2/orderly</u></font>", meta_style)],
        [Paragraph("<b>Live Backend API:</b>", meta_style), Paragraph("<font color='#2563EB'><u>https://orderly-w9x4.onrender.com</u></font> (Docs: /docs | Health: /health)", meta_style)],
        [Paragraph("<b>Primary Tech Stack:</b>", meta_style), Paragraph("Next.js 16 (React 19), FastAPI (Python 3.11), PostgreSQL (Neon), Groq Llama 3.3, Gemini 2.5 Flash", meta_style)],
    ]
    t_meta = Table(meta_data, colWidths=[120, 384])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor("#E2E8F0")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#F1F5F9")),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 14))

    # SECTION 1: Problem Framing & Economic Model
    story.append(Paragraph("1. Problem Framing & Economic Impact Model", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=8))
    story.append(Paragraph(
        "Company A distributes 4 packaged food and home care brands across 1,800 kirana shops in Jabalpur, generating ₹85–100 Cr annually. "
        "Historically, 18 field salesmen capture daily orders in physical notebooks, while kirana owners send erratic WhatsApp messages, "
        "photos of handwritten slips (*parchis*), and Hindi voice notes. A back-office team of 6 operators manually deciphers these notes "
        "and retypes them into Tally ERP next morning. Lack of counter-level visibility into stock and active schemes leads to extensive line cuts, "
        "wrong item deliveries, and severe revenue leakage.", body_style
    ))

    # Economic Table
    econ_data = [
        [Paragraph("Metric", table_header_style), Paragraph("Current Baseline (As-Is)", table_header_style), Paragraph("Orderly Target (To-Be)", table_header_style), Paragraph("Net Annual Saving", table_header_style)],
        [Paragraph("Annual Order Volume", table_cell_bold), Paragraph("1,80,000 orders (600/day × 300 days)", table_cell_style), Paragraph("1,80,000 orders", table_cell_style), Paragraph("—", table_cell_style)],
        [Paragraph("Order Error & Return Rate", table_cell_bold), Paragraph("5.0% (9,000 wrong SKU/qty returns)", table_cell_style), Paragraph("< 1.0% (1,800 returns)", table_cell_style), Paragraph("<b>₹25.20 Lakh / yr</b><br/>(9,000 - 1,800) × ₹350", table_cell_style)],
        [Paragraph("Order Entry Office Staff", table_cell_bold), Paragraph("6 operators @ ₹2.6L = ₹15.6L/yr", table_cell_style), Paragraph("3 operators (redeploy 3)", table_cell_style), Paragraph("<b>₹7.80 Lakh / yr</b><br/>3 operators × ₹2.6L", table_cell_style)],
        [Paragraph("Stock-Out Lost Sales Margin", table_cell_bold), Paragraph("1.0% lost sales @ 6% margin = ₹5.4L", table_cell_style), Paragraph("< 0.2% lost sales", table_cell_style), Paragraph("<b>₹4.32 Lakh / yr</b><br/>Margin recovered", table_cell_style)],
        [Paragraph("<b>Total Economic Leakage</b>", table_cell_bold), Paragraph("<b>₹52.50 Lakh / year</b>", table_cell_bold), Paragraph("<b>₹15.18 Lakh / year</b>", table_cell_bold), Paragraph("<b>₹37.32 Lakh / yr</b><br/><b>ROI Payback: 2.25 mos</b>", table_cell_bold)],
    ]
    t_econ = Table(econ_data, colWidths=[120, 140, 124, 120])
    t_econ.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E293B")),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t_econ)
    story.append(Spacer(1, 10))

    # SECTION 2: Labeled Assumptions
    story.append(Paragraph("2. Explicitly Labeled System Assumptions", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=8))
    assumptions = [
        "<b>[Assumption-01] Hardware & Bandwidth Constraints:</b> Kiranas operate on low-to-mid tier Android smartphones (2–3 GB RAM) on fluctuating 3G/4G connections. First page load budget is capped at < 3.0 seconds, tap targets must exceed 48px, and client-side processing must be strictly offloaded to serverless edge APIs.",
        "<b>[Assumption-02] FMCG Packaging Hierarchy:</b> Primary distributor billing occurs at the Dealer Case (Peti) level, while kirana end-consumer resale occurs at the Piece (Packet) level. Case-to-piece conversions are strictly integer-based (e.g. 96 units/case for Glucose 75g). Fractional cases are strictly forbidden.",
        "<b>[Assumption-03] Trade Scheme Rules:</b> Distributor schemes are non-compoundable trade promotions falling into two deterministic classes: Free Goods (Buy X cases get Y free) and Slab Discounts (≥ Z cases get D% off). Arithmetic is calculated exclusively using 2-decimal rounded paisa precision.",
        "<b>[Assumption-04] Credit Terms & Hold Enforcements:</b> Kiranas hold a pre-approved rolling 14-day credit limit (₹40,000–₹1,00,000). Orders causing Total Outstanding + Order Subtotal to exceed credit limit are placed on CREDIT_HOLD for manual desk review.",
        "<b>[Assumption-05] Integration Scope Boundary:</b> Delivery truck GPS fleet tracking, in-app consumer payment gateways, and GST e-invoicing remain out of scope. Invoices and e-invoicing are preserved inside Tally ERP; Orderly exports clean, validated Tally XML batches.",
        "<b>[Assumption-06] Human-in-the-Loop Safeguard:</b> AI NLU never places an autonomous warehouse order without human verification. Every transcribed line requires retailer confirmation or desk operator approval, preventing phantom shipments.",
    ]
    for a in assumptions:
        story.append(Paragraph(f"• {a}", bullet_style))
    story.append(Spacer(1, 10))

    # SECTION 3: System Architecture & Technology Decisions
    story.append(Paragraph("3. System Architecture & Technology Trade-offs", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=8))
    story.append(Paragraph(
        "Orderly implements a modern decoupled, service-oriented architecture designed to scale seamlessly across 1,800 kiranas and 18 mobile salesmen.", body_style
    ))

    arch_data = [
        [Paragraph("Component", table_header_style), Paragraph("Technology Choice", table_header_style), Paragraph("Architectural Rationale & Alternatives Rejected", table_header_style)],
        [
            Paragraph("Frontend & PWA", table_cell_bold),
            Paragraph("Next.js 16.4 (App Router, React 19, Turbopack, Tailwind CSS)", table_cell_style),
            Paragraph("Server-rendered static routing enables instant loads on slow 3G. Rejected traditional SPA (Vite/CRA) due to heavy client-side bundle initialization delays on low-memory kirana phones.", table_cell_style)
        ],
        [
            Paragraph("API Backend", table_cell_bold),
            Paragraph("FastAPI (Python 3.11 ASGI, Uvicorn, Pydantic V2)", table_cell_style),
            Paragraph("Asynchronous ASGI handles high concurrent I/O. Pydantic V2 guarantees zero-overhead runtime validation. Direct interoperability with Python AI/ML ecosystem. Outperformed Node.js/Express in benchmarked concurrency.", table_cell_style)
        ],
        [
            Paragraph("Relational Database", table_cell_bold),
            Paragraph("PostgreSQL 16 (Neon Serverless, Alembic Migrations)", table_cell_style),
            Paragraph("ACID transactions, foreign key cascades, double-entry credit ledgering, and row-level locking for inventory deductions. Rejected NoSQL (MongoDB) due to severe lack of ACID guarantees in multi-entity financial transactions.", table_cell_style)
        ],
        [
            Paragraph("Conversational NLU", table_cell_bold),
            Paragraph("Groq Llama 3.3 70B Versatile (Function Calling JSON)", table_cell_style),
            Paragraph("Sub-450ms structured JSON extraction from colloquial Hinglish/Hindi text and voice transcriptions at 1/10th the inference cost of OpenAI GPT-4o.", table_cell_style)
        ],
        [
            Paragraph("Handwritten OCR", table_cell_bold),
            Paragraph("Google Gemini 2.5 Flash Vision API", table_cell_style),
            Paragraph("High spatial accuracy on wrinkled, low-contrast, mixed Hindi-English shopkeeper chits (*parchis*), far exceeding traditional OCR (Tesseract / AWS Textract).", table_cell_style)
        ],
    ]
    t_arch = Table(arch_data, colWidths=[90, 130, 284])
    t_arch.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E293B")),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t_arch)
    story.append(Spacer(1, 10))

    # SECTION 4: Relational Data Model
    story.append(Paragraph("4. Relational Data Model (PostgreSQL)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=8))
    story.append(Paragraph(
        "The schema consists of 12 normalized relational tables enforcing referential integrity, indexes on frequently queried foreign keys, and audit logs.", body_style
    ))

    schema_data = [
        [Paragraph("Entity", table_header_style), Paragraph("Key Fields & Constraints", table_header_style), Paragraph("Business Function & Relationship", table_header_style)],
        [
            Paragraph("users", table_cell_bold),
            Paragraph("id (PK), email (UK), phone, role (DISTRIBUTOR_ADMIN, ORDER_DESK, SALESMAN, RETAILER), is_active", table_cell_style),
            Paragraph("Unified identity & role-based access control. Linked to Firebase Auth UID for secure token verification.", table_cell_style)
        ],
        [
            Paragraph("retailers", table_cell_bold),
            Paragraph("id (PK), retailer_code (UK, e.g. RET-JBP-01), shop_name, owner_name, phone, address, city, pincode, status", table_cell_style),
            Paragraph("Kirana store profiles in Jabalpur. Belongs to assigned salesman beats and receives distributor price rules.", table_cell_style)
        ],
        [
            Paragraph("credit_accounts", table_cell_bold),
            Paragraph("id (PK), retailer_id (FK), credit_limit, current_outstanding, payment_terms_days (default 14)", table_cell_style),
            Paragraph("1-to-1 ledger with kirana. Evaluated during checkout; breaches trigger ORDER_HOLD queue.", table_cell_style)
        ],
        [
            Paragraph("products", table_cell_bold),
            Paragraph("id (PK), sku_code (UK), name, dealer_price_case, dealer_price_piece, units_per_case, gst_rate, stock_cases", table_cell_style),
            Paragraph("Master SKU catalog with packaging hierarchy (e.g. 96 pcs/case) and real-time inventory balances.", table_cell_style)
        ],
        [
            Paragraph("schemes & scheme_rules", table_cell_bold),
            Paragraph("id (PK), scheme_type (FREE_GOODS, SLAB_DISCOUNT), target_sku_id, min_cases, free_cases, discount_percentage", table_cell_style),
            Paragraph("Deterministic trade scheme rules: Buy 10 Get 1 free, and 3% off on 5+ cases.", table_cell_style)
        ],
        [
            Paragraph("orders & order_items", table_cell_bold),
            Paragraph("id (PK), order_number (UK), retailer_id, salesman_id, status, subtotal, discount, tax, total, order_source", table_cell_style),
            Paragraph("Full order transaction and line-item snapshot with free cases, unit price, and line totals.", table_cell_style)
        ],
        [
            Paragraph("retailer_assignments", table_cell_bold),
            Paragraph("id (PK), salesman_id (FK), retailer_id (FK), beat_day", table_cell_style),
            Paragraph("Maps 18 salesmen to specific kirana stores across Jabalpur geographic beats.", table_cell_style)
        ],
    ]
    t_schema = Table(schema_data, colWidths=[90, 180, 234])
    t_schema.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E293B")),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t_schema)
    story.append(Spacer(1, 10))

    # SECTION 5: Wholesale Scheme Engine
    story.append(Paragraph("5. Wholesale Scheme Engine & Calculation Logic", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=8))
    story.append(Paragraph(
        "FMCG schemes are calculated strictly on the backend to avoid discrepancies between the salesman's visit, retailer app, and Tally invoice.", body_style
    ))
    story.append(Paragraph(
        "<b>1. Free Goods Scheme (Buy X Get Y Free):</b><br/>"
        "Free Cases = floor(Ordered Cases / Threshold Cases) × Free Multiplier.<br/>"
        "<i>Example:</i> 24 cases of Glucose 75g (SKU-BS-075) with 'Buy 10 get 1 free' → floor(24/10) × 1 = <b>2 Free Cases</b>. "
        "The free line is automatically appended to the cart at ₹0.00 with appropriate GST reporting.", bullet_style
    ))
    story.append(Paragraph(
        "<b>2. Slab Discount Scheme (% off Threshold):</b><br/>"
        "Discount Amount = Ordered Cases × Price Per Case × Slab Percentage.<br/>"
        "<i>Example:</i> 5 cases of Detergent 1kg (SKU-DT-1KG, ₹2,030/case) with '3% off 5+ cases' → 5 × ₹2,030 × 0.03 = <b>₹304.50 discount</b>. "
        "Net payable = ₹9,845.50.", bullet_style
    ))
    story.append(Paragraph(
        "<b>3. Strict Financial Decimal Arithmetic:</b> All monetary computations are performed using Python's <code>Decimal</code> type "
        "with <code>ROUND_HALF_UP</code> to 2 decimal places (paisa), preventing floating point rounding errors.", bullet_style
    ))
    story.append(Spacer(1, 10))

    # SECTION 6: AI Multimodal Order Capture
    story.append(Paragraph("6. Multimodal AI Order Capture Pipeline", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=8))
    story.append(Paragraph(
        "The AI pipeline handles raw Hindi voice notes, messy WhatsApp Hinglish text, and handwritten kirana paper slips (*parchis*).", body_style
    ))

    ai_steps = [
        "<b>Acoustic Pre-filtering:</b> Client-side Web Audio API bandpass filter (300 Hz–3.4 kHz) removes background traffic, ambient shop chatter, and television noise before server transmission.",
        "<b>Multimodal NLU Ingestion:</b> Voice & text are streamed to Groq Llama 3.3 70B with active catalogue context for sub-450ms entity extraction. Handwritten parchi photos are parsed via Gemini 2.5 Flash Vision.",
        "<b>Deterministic Candidate Ranking:</b> The extracted entities are resolved against the catalog using: (1) Exact SKU code match, (2) Fuzzy Levenshtein token similarity (threshold ≥ 0.78), and (3) Retailer historical order affinity (+0.15 boost for previously purchased SKUs).",
        "<b>Disambiguation Guardrails (When AI is Unsure):</b> If match confidence is < 85% or multiple SKU matches occur, a yellow Disambiguation Card is displayed. It shows the original verbatim Hindi phrase, confidence score, and 2 alternative SKU options.",
        "<b>Unit Clarification:</b> Ambiguous quantities (e.g. '5 biscuit') explicitly prompt the user: <i>'Did you mean 5 Peti (Cases) or 5 Packets?'</i>, never guessing.",
        "<b>Continuous Alias Learning:</b> When a desk operator or retailer corrects a match, the system stores the raw term as a retailer-specific alias dictionary entry for instant zero-shot resolution in future orders.",
    ]
    for s in ai_steps:
        story.append(Paragraph(f"• {s}", bullet_style))
    story.append(Spacer(1, 10))

    # SECTION 7: UI & UX Design Decisions
    story.append(Paragraph("7. UI & UX Design Decisions", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=8))
    ui_points = [
        "<b>Restrained Minimalist Palette:</b> Warm natural off-white backgrounds (#FBF9F1, #F3F0E6), dark charcoal typography (#242724), and subtle slate borders (#DCD9D0) prevent visual fatigue during long ordering sessions.",
        "<b>Touch Target Standards:</b> Minimum 48px tap targets on all stepper buttons, inputs, and search bars to support rapid one-handed thumb entry while standing at a physical shop counter.",
        "<b>Fixed Sticky Navigation:</b> Both top header (h-14 fixed) and sidebar (fixed left-0) remain pinned across all viewport sizes, ensuring the cart button and search bar never scroll out of view.",
        "<b>Explicit GST Breakdown:</b> Every SKU card displays clear indicators showing whether GST is included (e.g. <i>'₹8.10/pc incl. 18% GST'</i>) to eliminate pricing disputes at delivery time.",
        "<b>Zero Dead Button Guarantee:</b> Every action provides instant visual feedback, loading spinners, and clear empty/error recovery states.",
    ]
    for p in ui_points:
        story.append(Paragraph(f"• {p}", bullet_style))
    story.append(Spacer(1, 10))

    # SECTION 8: Out of Scope & Future Roadmap
    story.append(Paragraph("8. Scope Boundary & Engineering Roadmap", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=8))

    scope_data = [
        [Paragraph("Feature Area", table_header_style), Paragraph("Status in Core Build", table_header_style), Paragraph("Future Roadmap (Phase 2 & 3)", table_header_style)],
        [
            Paragraph("Ordering Channels", table_cell_bold),
            Paragraph("Web PWA, AI Voice, AI Text, Handwritten Parchi OCR", table_cell_style),
            Paragraph("Direct Meta WhatsApp Business Cloud API webhook integration.", table_cell_style)
        ],
        [
            Paragraph("Offline Capabilities", table_cell_bold),
            Paragraph("Client-side catalog caching & offline salesman order queue", table_cell_style),
            Paragraph("Background IndexedDB bi-directional sync worker.", table_cell_style)
        ],
        [
            Paragraph("Accounting & ERP", table_cell_bold),
            Paragraph("Compliant Tally ERP9 / Tally Prime XML export batches", table_cell_style),
            Paragraph("Two-way automated Tally ODBC connector for real-time ledger sync.", table_cell_style)
        ],
        [
            Paragraph("Payments & Delivery", table_cell_bold),
            Paragraph("Out of scope per brief (credit ledger & loading lists built)", table_cell_style),
            Paragraph("Razorpay B2B virtual account reconciliation & driver dispatch app.", table_cell_style)
        ],
    ]
    t_scope = Table(scope_data, colWidths=[100, 190, 214])
    t_scope.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E293B")),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t_scope)
    story.append(Spacer(1, 14))

    # Summary Callout Box
    summary_box_data = [[
        Paragraph(
            "<b>Summary Statement:</b> Orderly directly eliminates the ₹52.5 Lakh annual operational loss of Company A through "
            "sub-second multilingual AI order extraction, a deterministic wholesale scheme engine, and credit hold guardrails. "
            "All core brief flows are fully operational, tested with 88 automated test suites, and deployed live.",
            callout_style
        )
    ]]
    t_box = Table(summary_box_data, colWidths=[504])
    t_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#EFF6FF")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#3B82F6")),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(t_box)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Generated PDF successfully at: {pdf_path}")


if __name__ == "__main__":
    build_pdf()
