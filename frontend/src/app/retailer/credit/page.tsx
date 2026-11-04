"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  FileText,
  X,
  CreditCard,
  Building2,
  Phone,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types & Interfaces matching Backend Credit Schemas                 */
/* ------------------------------------------------------------------ */

interface RetailerInfo {
  id: string;
  shop_name: string;
  owner_name: string;
  retailer_code: string;
  phone: string;
}

interface CreditSummary {
  retailer: RetailerInfo;
  credit_limit: number | string;
  current_outstanding: number | string;
  available_credit: number | string;
  utilization_percentage: number;
  payment_terms_days: number;
  account_status: "HEALTHY" | "NEAR_LIMIT" | "LIMIT_EXCEEDED" | "NOT_ASSIGNED";
  updated_at: string | null;
  total_debits_amount: number | string;
  total_payments_amount: number | string;
  total_transactions_count: number;
}

interface LedgerItem {
  id: string;
  transaction_type: "ORDER_DEBIT" | "PAYMENT" | "CREDIT_NOTE" | "ADJUSTMENT";
  amount: number | string;
  reference_type: string | null;
  reference_id: string | null;
  reference_number: string | null;
  note: string | null;
  created_at: string;
  running_balance: number | string;
}

interface OutstandingInvoice {
  order_id: string;
  order_number: string;
  total_amount: number | string;
  approved_at: string | null;
  due_date: string | null;
  days_remaining: number | null;
  is_overdue: boolean;
}

interface LedgerResponse {
  summary: CreditSummary;
  items: LedgerItem[];
  outstanding_invoices: OutstandingInvoice[];
  total_count: number;
}

/* ------------------------------------------------------------------ */
/*  Bilingual Translations (English & Hindi)                          */
/* ------------------------------------------------------------------ */

type SupportedLang = "en" | "hi";

const DICT: Record<SupportedLang, Record<string, string>> = {
  en: {
    pageTitle: "My Credit",
    pageSubtitle: "Your shop's credit overview.",
    availableCredit: "Available Credit",
    availableForOrders: "Available for new order dispatches",
    totalCreditLimit: "Total Credit Limit",
    creditUtilized: "Credit Used",
    utilization: "Utilization",
    healthyStatus: "Healthy Utilization",
    cautionStatus: "Caution • Approaching Limit",
    exceededStatus: "High Utilization • Limit Exceeded",
    unassignedStatus: "Limit Not Sanctioned",
    outstandingDues: "Outstanding Dues",
    outstandingDuesSub: "Unsettled balance across approved orders",
    allSettled: "All cleared • No dues pending",
    nextDueDate: "Next Due Date",
    noDuesScheduled: "No pending dues",
    overdueBy: "Overdue by",
    dueIn: "Due in",
    today: "Due today",
    days: "days",
    netTerms: "Terms",
    daysNet: "Days Net",
    recentTransactions: "Recent Transactions",
    recentTransactionsSub: "Your latest credit debits and payment receipts",
    viewAllTransactions: "View All Transactions",
    closeHistory: "Back to Overview",
    allTransactionsTitle: "Credit Transaction History",
    allTransactionsSub: "Complete chronological passbook of order debits, settlements and credits",
    filterAll: "All",
    filterDebits: "Order Debits",
    filterPayments: "Payments Received",
    filterNotes: "Credit Notes",
    searchPlaceholder: "Search by order number or note...",
    orderDebit: "Order Debit",
    paymentReceived: "Payment Received",
    creditNote: "Credit Note",
    adjustment: "Adjustment",
    balanceAfter: "Balance after",
    downloadStatement: "Statement (CSV)",
    refresh: "Refresh",
    loading: "Loading credit overview...",
    emptyTransactions: "No transactions recorded yet",
    emptyTransactionsSub: "Your credit ledger will record debits when orders are approved, and credits when payments are verified.",
    unsettledOrdersTitle: "Unsettled Invoices Pending Clearance",
    unsettledOrdersSub: "Orders currently contributing to your outstanding dues",
    orderNo: "Order #",
    orderDate: "Date",
    amount: "Amount",
    status: "Status",
    viewOrders: "View Orders",
    creditPolicyTitle: "Distributor Credit Billing Policy",
    creditPolicyDesc: "Approved orders automatically utilize sanctioned credit. Payments made to the delivery salesman or Jabalpur depot instantly restore your available credit line.",
    retry: "Retry Loading",
    errorLoading: "Unable to load credit account",
    showing: "Showing",
    of: "of",
    transactions: "transactions",
    page: "Page",
    prev: "Previous",
    next: "Next",
  },
  hi: {
    pageTitle: "मेरा क्रेडिट",
    pageSubtitle: "आपकी दुकान का क्रेडिट विवरण।",
    availableCredit: "उपलब्ध क्रेडिट",
    availableForOrders: "नए ऑर्डर के लिए उपलब्ध राशि",
    totalCreditLimit: "कुल क्रेडिट सीमा",
    creditUtilized: "उपयोग किया गया क्रेडिट",
    utilization: "उपयोग",
    healthyStatus: "स्वस्थ उपयोग",
    cautionStatus: "सावधानी • सीमा के करीब",
    exceededStatus: "अत्यधिक उपयोग • सीमा समाप्त",
    unassignedStatus: "क्रेडिट सीमा स्वीकृत नहीं",
    outstandingDues: "बकाया राशि",
    outstandingDuesSub: "स्वीकृत ऑर्डरों का असमाशोधित बकाया",
    allSettled: "पूर्ण चुकता • कोई बकाया नहीं",
    nextDueDate: "अगली भुगतान तिथि",
    noDuesScheduled: "कोई बकाया नहीं",
    overdueBy: "समय सीमा पार",
    dueIn: "देय तिथि शेष",
    today: "आज देय",
    days: "दिन",
    netTerms: "अवधि",
    daysNet: "दिन नेट",
    recentTransactions: "हाल के लेन-देन",
    recentTransactionsSub: "आपके नवीनतम ऑर्डर डेबिट और प्राप्त भुगतान",
    viewAllTransactions: "सभी लेन-देन देखें",
    closeHistory: "अवलोकन पर लौटें",
    allTransactionsTitle: "क्रेडिट लेन-देन इतिहास",
    allTransactionsSub: "ऑर्डर डेबिट, भुगतान और क्रेडिट का पूर्ण बहीखाता",
    filterAll: "सभी",
    filterDebits: "ऑर्डर डेबिट",
    filterPayments: "प्राप्त भुगतान",
    filterNotes: "क्रेडिट नोट",
    searchPlaceholder: "ऑर्डर नंबर या विवरण से खोजें...",
    orderDebit: "ऑर्डर डेबिट",
    paymentReceived: "भुगतान प्राप्त",
    creditNote: "क्रेडिट नोट",
    adjustment: "समायोजन",
    balanceAfter: "शेष बकाया",
    downloadStatement: "स्टेटमेंट डाउनलोड करें",
    refresh: "ताज़ा करें",
    loading: "क्रेडिट विवरण लोड हो रहा है...",
    emptyTransactions: "अभी कोई लेन-देन दर्ज नहीं है",
    emptyTransactionsSub: "ऑर्डर स्वीकृत होने पर डेबिट और भुगतान होने पर क्रेडिट स्वतः जुड़ेंगे।",
    unsettledOrdersTitle: "लंबित इनवॉइस",
    unsettledOrdersSub: "वर्तमान में बकाया राशि से जुड़े स्वीकृत ऑर्डर",
    orderNo: "ऑर्डर सं.",
    orderDate: "दिनांक",
    amount: "राशि",
    status: "स्थिति",
    viewOrders: "ऑर्डर देखें",
    creditPolicyTitle: "डिस्ट्रिब्यूटर क्रेडिट नीति",
    creditPolicyDesc: "स्वीकृत ऑर्डर आपकी क्रेडिट सीमा से घटते हैं। डिलीवरी वैन या जबलपुर डिपो पर भुगतान होते ही क्रेडिट तुरंत बहाल हो जाता है।",
    retry: "पुनः प्रयास करें",
    errorLoading: "क्रेडिट विवरण लोड करने में असमर्थ",
    showing: "दिखाया जा रहा है",
    of: "कुल",
    transactions: "लेन-देन",
    page: "पृष्ठ",
    prev: "पिछला",
    next: "अगला",
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "₹0.00";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(isoString));
  } catch {
    return "—";
  }
}

function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(isoString));
  } catch {
    return "—";
  }
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */

export default function RetailerCreditPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Language state
  const [lang, setLang] = useState<SupportedLang>("en");

  // Credit Data State
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // View state: overview vs all transactions
  const [viewMode, setViewMode] = useState<"overview" | "history">("overview");

  // History Filter & Search State
  const [filterType, setFilterType] = useState<
    "ALL" | "ORDER_DEBIT" | "PAYMENT" | "CREDIT_NOTE"
  >("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Sync language from storage or settings
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLang = localStorage.getItem("orderly_lang") as SupportedLang;
      if (savedLang === "en" || savedLang === "hi") {
        setLang(savedLang);
      }
    }
  }, []);

  const t = DICT[lang];

  // Fetch full ledger statement
  const fetchCreditData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<LedgerResponse>("/retailer/credit/ledger?limit=150");
      setData(res);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load credit account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/register");
      return;
    }
    void fetchCreditData();
  }, [user, authLoading, router, fetchCreditData]);

  // Handle CSV export
  const handleExportCsv = async () => {
    if (!user) return;
    setIsExporting(true);
    try {
      const idToken = await user.getIdToken();
      const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/retailer/credit/export`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: "text/csv",
        },
      });

      if (!res.ok) {
        throw new Error(`Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `orderly_credit_statement_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Unable to export statement. Please try again."
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Calculations & States
  const summary = data?.summary;
  const items = useMemo(() => data?.items || [], [data]);
  const outstandingInvoices = useMemo(
    () => data?.outstanding_invoices || [],
    [data]
  );

  const availableCreditNum = Number(summary?.available_credit ?? 0);
  const creditLimitNum = Number(summary?.credit_limit ?? 0);
  const currentOutstandingNum = Number(summary?.current_outstanding ?? 0);
  const utilizationPct = summary?.utilization_percentage ?? 0;

  // Clear utilization status & color scheme (accessible with text + contrast)
  const utilizationState = useMemo(() => {
    if (creditLimitNum <= 0) {
      return {
        label: t.unassignedStatus,
        colorClass: "text-[#666864] bg-[#F0EFEA] border-[#D5D3CB]",
        barClass: "bg-[#969892]",
        type: "gray" as const,
      };
    }
    if (currentOutstandingNum > creditLimitNum || utilizationPct >= 90) {
      return {
        label: t.exceededStatus,
        colorClass: "text-[#991B1B] bg-[#FEF2F2] border-[#FCA5A5]",
        barClass: "bg-[#DC2626]",
        type: "red" as const,
      };
    }
    if (utilizationPct >= 70) {
      return {
        label: t.cautionStatus,
        colorClass: "text-[#92400E] bg-[#FFFBEB] border-[#FCD34D]",
        barClass: "bg-[#D97706]",
        type: "amber" as const,
      };
    }
    return {
      label: t.healthyStatus,
      colorClass: "text-[#166534] bg-[#F0FDF4] border-[#86EFAC]",
      barClass: "bg-[#16A34A]",
      type: "green" as const,
    };
  }, [creditLimitNum, currentOutstandingNum, utilizationPct, t]);

  // Earliest Next Due Date computation
  const earliestDueInfo = useMemo(() => {
    if (currentOutstandingNum <= 0) {
      return {
        hasDue: false,
        displayDate: t.allSettled,
        subtext: t.noDuesScheduled,
        isOverdue: false,
      };
    }

    if (outstandingInvoices.length > 0) {
      const firstInvoice = outstandingInvoices[0];
      if (firstInvoice.due_date) {
        const days = firstInvoice.days_remaining;
        let sub = "";
        if (firstInvoice.is_overdue) {
          sub = `${t.overdueBy} ${Math.abs(days || 0)} ${t.days}`;
        } else if (days === 0) {
          sub = t.today;
        } else if (days !== null && days !== undefined && days > 0) {
          sub = `${t.dueIn} ${days} ${t.days}`;
        } else {
          sub = `${summary?.payment_terms_days ?? 14} ${t.daysNet}`;
        }

        return {
          hasDue: true,
          displayDate: formatDate(firstInvoice.due_date),
          subtext: sub,
          isOverdue: firstInvoice.is_overdue,
          orderNumber: firstInvoice.order_number,
        };
      }
    }

    // Fallback if no specific invoice due date is present
    return {
      hasDue: true,
      displayDate: `${summary?.payment_terms_days ?? 14} ${t.daysNet}`,
      subtext: t.outstandingDuesSub,
      isOverdue: false,
    };
  }, [currentOutstandingNum, outstandingInvoices, summary, t]);

  // Filtered & Paginated Transactions for History View
  const filteredHistoryItems = useMemo(() => {
    return items.filter((item) => {
      // Type filter
      if (filterType !== "ALL" && item.transaction_type !== filterType) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesRef = item.reference_number?.toLowerCase().includes(q);
        const matchesNote = item.note?.toLowerCase().includes(q);
        const matchesType = item.transaction_type.toLowerCase().includes(q);
        if (!matchesRef && !matchesNote && !matchesType) return false;
      }
      return true;
    });
  }, [items, filterType, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredHistoryItems.length / ITEMS_PER_PAGE)
  );

  const paginatedHistoryItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredHistoryItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredHistoryItems, currentPage]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, searchQuery]);

  // Top 5 recent transactions for the overview screen
  const recentTransactions = useMemo(() => {
    return items.slice(0, 5);
  }, [items]);

  /* ------------------------------------------------------------------ */
  /*  Render Loading State                                              */
  /* ------------------------------------------------------------------ */
  if (authLoading || (loading && !data)) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-32 bg-[#E7E6E0] animate-pulse rounded" />
            <div className="h-8 w-64 bg-[#E7E6E0] animate-pulse rounded" />
            <div className="h-4 w-48 bg-[#E7E6E0] animate-pulse rounded" />
          </div>
          <div className="h-10 w-28 bg-[#E7E6E0] animate-pulse rounded" />
        </div>

        {/* Available Credit Hero Skeleton */}
        <div className="border border-[#E7E6E0] bg-white rounded-lg p-6 sm:p-8 space-y-6">
          <div className="h-5 w-40 bg-[#E7E6E0] animate-pulse rounded" />
          <div className="h-12 w-72 bg-[#E7E6E0] animate-pulse rounded" />
          <div className="h-3 w-full bg-[#E7E6E0] animate-pulse rounded-full" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-6 w-32 bg-[#E7E6E0] animate-pulse rounded" />
            <div className="h-6 w-32 bg-[#E7E6E0] animate-pulse rounded ml-auto" />
          </div>
        </div>

        {/* 2 Summary Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-[#E7E6E0] bg-white rounded-lg p-6 space-y-3">
            <div className="h-4 w-28 bg-[#E7E6E0] animate-pulse rounded" />
            <div className="h-8 w-44 bg-[#E7E6E0] animate-pulse rounded" />
          </div>
          <div className="border border-[#E7E6E0] bg-white rounded-lg p-6 space-y-3">
            <div className="h-4 w-28 bg-[#E7E6E0] animate-pulse rounded" />
            <div className="h-8 w-44 bg-[#E7E6E0] animate-pulse rounded" />
          </div>
        </div>

        {/* Transactions Skeleton */}
        <div className="border border-[#E7E6E0] bg-white rounded-lg p-6 space-y-4">
          <div className="h-6 w-48 bg-[#E7E6E0] animate-pulse rounded" />
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-[#F6F5F1] animate-pulse rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Render Error State                                                */
  /* ------------------------------------------------------------------ */
  if (error && !data) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-16 text-center">
        <div className="rounded-xl border border-red-200 bg-white p-8 shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-[#242724]">
            {t.errorLoading}
          </h2>
          <p className="mt-2 text-sm text-[#666864]">{error}</p>
          <button
            onClick={() => void fetchCreditData()}
            className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-md bg-[#242724] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#79565D]"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t.retry}
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Main UI                                                           */
  /* ------------------------------------------------------------------ */
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* 1. CREDIT PAGE HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E7E6E0] pb-5">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white border border-[#E7E6E0] shadow-sm text-[#79565D]">
            <Wallet className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#242724]">
                {t.pageTitle}
              </h1>
              {summary && (
                <span className="inline-flex items-center rounded-full bg-[#F4EFF0] px-2.5 py-0.5 text-xs font-semibold text-[#67474E] border border-[#EBDDE0]">
                  {summary.retailer.retailer_code}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-[#666864]">{t.pageSubtitle}</p>
          </div>
        </div>

        {/* Top Actions: Refresh, CSV Export, Language Toggle */}
        <div className="flex items-center gap-2 sm:self-center flex-wrap">
          {/* Quick Language switch */}
          <button
            onClick={() => {
              const next = lang === "en" ? "hi" : "en";
              setLang(next);
              if (typeof window !== "undefined") {
                localStorage.setItem("orderly_lang", next);
              }
            }}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[#E7E6E0] bg-white px-3 py-2 text-xs font-semibold text-[#242724] hover:bg-[#F0EFEA] transition shadow-sm"
            aria-label="Switch Language"
          >
            <span>{lang === "en" ? "हिंदी" : "English"}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => void fetchCreditData()}
            disabled={loading}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[#E7E6E0] bg-white px-3.5 py-2 text-xs font-semibold text-[#242724] hover:bg-[#F0EFEA] transition shadow-sm disabled:opacity-50"
            aria-label={t.refresh}
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin text-[#79565D]" : "text-[#666864]"}`}
            />
            <span className="hidden sm:inline">{t.refresh}</span>
          </button>

          {/* Download Statement CSV Button */}
          <button
            onClick={handleExportCsv}
            disabled={isExporting || items.length === 0}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-[#242724] px-4 py-2 text-xs font-semibold text-white hover:bg-[#79565D] transition shadow-sm disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>{isExporting ? "Exporting..." : t.downloadStatement}</span>
          </button>
        </div>
      </div>

      {/* 2. AVAILABLE CREDIT CARD (The Most Prominent Section) */}
      <section
        aria-labelledby="available-credit-heading"
        className="relative overflow-hidden rounded-xl border border-[#E7E6E0] bg-white p-6 sm:p-8 shadow-sm transition"
      >
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F4EFF0] text-[#79565D]">
                <CreditCard className="h-3.5 w-3.5" />
              </span>
              <h2
                id="available-credit-heading"
                className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#666864]"
              >
                {t.availableCredit}
              </h2>
            </div>

            {/* Large Available Amount */}
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight font-mono text-[#242724] tabular-nums">
                {formatCurrency(availableCreditNum)}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${utilizationState.colorClass}`}
              >
                {utilizationState.type === "green" && (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                )}
                {utilizationState.type === "amber" && (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                )}
                {utilizationState.type === "red" && (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                )}
                <span>{utilizationState.label}</span>
              </span>
            </div>

            <p className="text-xs sm:text-sm text-[#666864]">
              {t.availableForOrders}
            </p>
          </div>

          {/* Right Pillar: Total Credit Limit Reference */}
          <div className="lg:text-right border-t lg:border-t-0 border-[#E7E6E0] pt-4 lg:pt-0 shrink-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#969892]">
              {t.totalCreditLimit}
            </span>
            <p className="text-xl sm:text-2xl font-bold font-mono text-[#242724] tabular-nums mt-0.5">
              {formatCurrency(creditLimitNum)}
            </p>
            <p className="text-xs text-[#666864] mt-0.5">
              {summary?.payment_terms_days ?? 14} {t.daysNet}
            </p>
          </div>
        </div>

        {/* Credit Utilization Progress Bar */}
        <div className="mt-8 space-y-2.5">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="font-semibold text-[#242724]">
              {t.creditUtilized}:{" "}
              <span className="font-mono font-bold text-[#79565D]">
                {formatCurrency(currentOutstandingNum)}
              </span>
            </span>
            <span className="font-mono font-bold text-[#242724]">
              {utilizationPct}% {t.utilization}
            </span>
          </div>

          {/* Bar track */}
          <div className="h-3.5 w-full overflow-hidden rounded-full bg-[#F0EFEA] border border-[#E7E6E0]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${utilizationState.barClass}`}
              style={{ width: `${Math.min(utilizationPct, 100)}%` }}
              role="progressbar"
              aria-valuenow={utilizationPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${utilizationPct}% credit utilized`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#666864] pt-1">
            <span>
              {formatCurrency(currentOutstandingNum)} used of{" "}
              {formatCurrency(creditLimitNum)}
            </span>
            <span className="font-medium text-[#166534]">
              {formatCurrency(availableCreditNum)} remaining
            </span>
          </div>
        </div>
      </section>

      {/* 3. CREDIT SUMMARY (Two Compact Cards) */}
      <section
        aria-label="Credit Summary Overview"
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        {/* Card 1: Outstanding Dues */}
        <div className="rounded-xl border border-[#E7E6E0] bg-white p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#666864]">
              {t.outstandingDues}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFFBEB] text-[#D97706] border border-[#FCD34D]">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold font-mono text-[#242724] tabular-nums">
              {formatCurrency(currentOutstandingNum)}
            </div>
            <p className="mt-1 text-xs text-[#666864]">
              {currentOutstandingNum > 0
                ? t.outstandingDuesSub
                : t.allSettled}
            </p>
          </div>

          {currentOutstandingNum > 0 && outstandingInvoices.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[#E7E6E0] flex items-center justify-between text-xs">
              <span className="text-[#666864]">
                {outstandingInvoices.length} {t.status === "Status" ? "unsettled order(s)" : "लंबित ऑर्डर"}
              </span>
              <Link
                href="/retailer/orders"
                className="font-semibold text-[#79565D] hover:underline inline-flex items-center gap-1"
              >
                <span>{t.viewOrders}</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>

        {/* Card 2: Next Due Date */}
        <div className="rounded-xl border border-[#E7E6E0] bg-white p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#666864]">
              {t.nextDueDate}
            </span>
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                earliestDueInfo.isOverdue
                  ? "bg-[#FEF2F2] text-[#DC2626] border-[#FCA5A5]"
                  : "bg-[#F0FDF4] text-[#16A34A] border-[#86EFAC]"
              }`}
            >
              <Calendar className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-3">
            <div
              className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${
                earliestDueInfo.isOverdue ? "text-[#991B1B]" : "text-[#242724]"
              }`}
            >
              {earliestDueInfo.displayDate}
            </div>
            <p
              className={`mt-1 text-xs font-medium ${
                earliestDueInfo.isOverdue ? "text-[#DC2626]" : "text-[#666864]"
              }`}
            >
              {earliestDueInfo.subtext}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E7E6E0] flex items-center justify-between text-xs text-[#666864]">
            <span>{t.netTerms}:</span>
            <span className="font-semibold text-[#242724]">
              {summary?.payment_terms_days ?? 14} {t.daysNet}
            </span>
          </div>
        </div>
      </section>

      {/* 4. ACTIVE UNSETTLED INVOICES TABLE (If Any) */}
      {outstandingInvoices.length > 0 && viewMode === "overview" && (
        <section
          aria-labelledby="unsettled-invoices-heading"
          className="rounded-xl border border-[#E7E6E0] bg-white shadow-sm overflow-hidden"
        >
          <div className="border-b border-[#E7E6E0] px-5 py-4 flex items-center justify-between bg-[#FBFBFA]">
            <div>
              <h2
                id="unsettled-invoices-heading"
                className="text-sm font-bold uppercase tracking-wider text-[#242724]"
              >
                {t.unsettledOrdersTitle}
              </h2>
              <p className="text-xs text-[#666864] mt-0.5">
                {t.unsettledOrdersSub}
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#F0EFEA] text-[#242724]">
              {outstandingInvoices.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-[#E7E6E0] bg-[#F6F5F1] text-[#666864] font-semibold">
                <tr>
                  <th className="py-3 px-4 sm:px-6">{t.orderNo}</th>
                  <th className="py-3 px-4 sm:px-6">{t.orderDate}</th>
                  <th className="py-3 px-4 sm:px-6">{t.nextDueDate}</th>
                  <th className="py-3 px-4 sm:px-6 text-right">{t.amount}</th>
                  <th className="py-3 px-4 sm:px-6 text-center">{t.status}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E6E0] text-[#242724]">
                {outstandingInvoices.map((inv) => (
                  <tr key={inv.order_id} className="hover:bg-[#FBFBFA] transition">
                    <td className="py-3.5 px-4 sm:px-6 font-mono font-semibold">
                      <Link
                        href="/retailer/orders"
                        className="text-[#79565D] hover:underline inline-flex items-center gap-1"
                      >
                        {inv.order_number}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-[#666864]">
                      {formatDate(inv.approved_at)}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-[#666864]">
                      {formatDate(inv.due_date)}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right font-mono font-bold text-[#242724]">
                      {formatCurrency(inv.total_amount)}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-center">
                      {inv.is_overdue ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]">
                          {t.overdueBy} {Math.abs(inv.days_remaining || 0)}d
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border border-[#86EFAC] bg-[#F0FDF4] text-[#166534]">
                          {inv.days_remaining !== null && inv.days_remaining !== undefined
                            ? `${t.dueIn} ${inv.days_remaining}d`
                            : `${summary?.payment_terms_days ?? 14}d`}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 5. RECENT TRANSACTIONS (Overview Mode) */}
      {viewMode === "overview" && (
        <section
          aria-labelledby="recent-transactions-heading"
          className="rounded-xl border border-[#E7E6E0] bg-white shadow-sm overflow-hidden"
        >
          <div className="border-b border-[#E7E6E0] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#FBFBFA]">
            <div>
              <h2
                id="recent-transactions-heading"
                className="text-base sm:text-lg font-bold text-[#242724]"
              >
                {t.recentTransactions}
              </h2>
              <p className="text-xs sm:text-sm text-[#666864] mt-0.5">
                {t.recentTransactionsSub}
              </p>
            </div>

            {/* Prominent Action to Open Full History */}
            <button
              onClick={() => {
                setViewMode("history");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md border border-[#79565D] bg-[#F4EFF0] px-4 py-2 text-xs font-bold text-[#67474E] hover:bg-[#EBDDE0] transition"
            >
              <span>{t.viewAllTransactions}</span>
              <span className="ml-1 rounded bg-[#67474E] text-white px-1.5 py-0.2 text-[10px]">
                {items.length}
              </span>
              <ChevronRight className="h-4 w-4 ml-0.5" />
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F0EFEA] text-[#969892]">
                <FileText className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-[#242724]">
                {t.emptyTransactions}
              </p>
              <p className="mt-1 text-xs text-[#666864] max-w-md mx-auto">
                {t.emptyTransactionsSub}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E7E6E0]">
              {recentTransactions.map((tx) => {
                const isDebit = tx.transaction_type === "ORDER_DEBIT";
                const isPayment = tx.transaction_type === "PAYMENT";
                const isCreditNote = tx.transaction_type === "CREDIT_NOTE";

                return (
                  <div
                    key={tx.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FBFBFA] transition"
                  >
                    {/* Left: Icon & Description */}
                    <div className="flex items-start gap-3.5">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border mt-0.5 ${
                          isDebit
                            ? "bg-[#F6F5F1] border-[#E7E6E0] text-[#242724]"
                            : isPayment
                            ? "bg-[#F0FDF4] border-[#86EFAC] text-[#16A34A]"
                            : "bg-[#FFFBEB] border-[#FCD34D] text-[#D97706]"
                        }`}
                      >
                        {isDebit && <ArrowUpRight className="h-5 w-5" />}
                        {isPayment && <ArrowDownLeft className="h-5 w-5" />}
                        {isCreditNote && <CheckCircle2 className="h-5 w-5" />}
                      </span>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-[#242724]">
                            {isDebit && (tx.reference_number ? `Order #${tx.reference_number}` : t.orderDebit)}
                            {isPayment && t.paymentReceived}
                            {isCreditNote && t.creditNote}
                            {!isDebit && !isPayment && !isCreditNote && t.adjustment}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isDebit
                                ? "bg-[#F0EFEA] text-[#242724]"
                                : isPayment
                                ? "bg-[#DCFCE7] text-[#166534]"
                                : "bg-[#FEF3C7] text-[#92400E]"
                            }`}
                          >
                            {tx.transaction_type.replace("_", " ")}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-[#666864] mt-1 flex-wrap">
                          <span>{formatDateTime(tx.created_at)}</span>
                          {tx.note && (
                            <>
                              <span>&bull;</span>
                              <span className="italic text-[#969892]">{tx.note}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount & Running Balance */}
                    <div className="sm:text-right shrink-0 pl-13 sm:pl-0">
                      <div
                        className={`text-base sm:text-lg font-bold font-mono tabular-nums ${
                          isDebit
                            ? "text-[#242724]"
                            : "text-[#15803D]"
                        }`}
                      >
                        {isDebit ? `- ${formatCurrency(tx.amount)}` : `+ ${formatCurrency(tx.amount)}`}
                      </div>
                      <div className="text-xs text-[#969892] mt-0.5 font-mono">
                        {t.balanceAfter}: {formatCurrency(tx.running_balance)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer Card Action */}
          {items.length > 5 && (
            <div className="p-4 border-t border-[#E7E6E0] bg-[#FBFBFA] text-center">
              <button
                onClick={() => {
                  setViewMode("history");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="text-xs sm:text-sm font-bold text-[#79565D] hover:underline inline-flex items-center gap-1 min-h-[44px]"
              >
                <span>{t.viewAllTransactions} ({items.length})</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </section>
      )}

      {/* 6. DEDICATED TRANSACTION HISTORY VIEW (When View All is Active) */}
      {viewMode === "history" && (
        <section
          aria-labelledby="all-transactions-heading"
          className="rounded-xl border border-[#E7E6E0] bg-white shadow-sm overflow-hidden"
        >
          {/* Header with Back Button */}
          <div className="border-b border-[#E7E6E0] p-5 sm:p-6 bg-[#FBFBFA]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <button
                  onClick={() => setViewMode("overview")}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#79565D] hover:underline mb-2 min-h-[36px]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>{t.closeHistory}</span>
                </button>
                <h2
                  id="all-transactions-heading"
                  className="text-xl sm:text-2xl font-bold text-[#242724]"
                >
                  {t.allTransactionsTitle}
                </h2>
                <p className="text-xs sm:text-sm text-[#666864] mt-0.5">
                  {t.allTransactionsSub}
                </p>
              </div>

              {/* Download Statement in History */}
              <button
                onClick={handleExportCsv}
                disabled={isExporting || items.length === 0}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[#E7E6E0] bg-white px-3.5 py-2 text-xs font-semibold text-[#242724] hover:bg-[#F0EFEA] transition shadow-sm self-start sm:self-center"
              >
                <Download className="h-4 w-4 text-[#79565D]" />
                <span>{isExporting ? "Generating..." : t.downloadStatement}</span>
              </button>
            </div>

            {/* Filter Pills and Search Row */}
            <div className="mt-5 flex flex-col md:flex-row md:items-center justify-between gap-3 pt-4 border-t border-[#E7E6E0]">
              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: "ALL", label: t.filterAll },
                  { id: "ORDER_DEBIT", label: t.filterDebits },
                  { id: "PAYMENT", label: t.filterPayments },
                  { id: "CREDIT_NOTE", label: t.filterNotes },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() =>
                      setFilterType(
                        tab.id as "ALL" | "ORDER_DEBIT" | "PAYMENT" | "CREDIT_NOTE"
                      )
                    }
                    className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-md border transition ${
                      filterType === tab.id
                        ? "border-[#242724] bg-[#242724] text-white"
                        : "border-[#E7E6E0] bg-white text-[#666864] hover:bg-[#F0EFEA]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#969892]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full rounded-md border border-[#E7E6E0] bg-white pl-9 pr-8 py-2 text-xs sm:text-sm text-[#242724] placeholder-[#969892] focus:border-[#79565D] focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#969892] hover:text-[#242724]"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Transaction Table / List */}
          {paginatedHistoryItems.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="mx-auto h-10 w-10 text-[#969892]" />
              <p className="mt-3 text-sm font-semibold text-[#242724]">
                {t.emptyTransactions}
              </p>
              <p className="mt-1 text-xs text-[#666864]">
                {searchQuery || filterType !== "ALL"
                  ? "No transactions match your current search or filter."
                  : t.emptyTransactionsSub}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-[#E7E6E0] bg-[#F6F5F1] text-[#666864] font-semibold">
                  <tr>
                    <th className="py-3 px-4 sm:px-6">{t.orderDate}</th>
                    <th className="py-3 px-4 sm:px-6">Description</th>
                    <th className="py-3 px-4 sm:px-6">{t.status}</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Debit (-)</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Payment / Credit (+)</th>
                    <th className="py-3 px-4 sm:px-6 text-right">{t.balanceAfter}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E6E0] text-[#242724]">
                  {paginatedHistoryItems.map((tx) => {
                    const isDebit = tx.transaction_type === "ORDER_DEBIT";
                    const isPayment = tx.transaction_type === "PAYMENT";
                    const isCreditNote = tx.transaction_type === "CREDIT_NOTE";

                    return (
                      <tr key={tx.id} className="hover:bg-[#FBFBFA] transition">
                        <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap text-[#666864] font-mono text-xs">
                          {formatDateTime(tx.created_at)}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="font-semibold text-[#242724]">
                            {tx.reference_number ? (
                              <Link
                                href="/retailer/orders"
                                className="text-[#79565D] hover:underline inline-flex items-center gap-1"
                              >
                                Order #{tx.reference_number}
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            ) : (
                              <span>
                                {isDebit && t.orderDebit}
                                {isPayment && t.paymentReceived}
                                {isCreditNote && t.creditNote}
                                {!isDebit && !isPayment && !isCreditNote && t.adjustment}
                              </span>
                            )}
                          </div>
                          {tx.note && (
                            <p className="text-xs text-[#969892] mt-0.5 truncate max-w-xs">
                              {tx.note}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
                              isDebit
                                ? "bg-[#F0EFEA] text-[#242724]"
                                : isPayment
                                ? "bg-[#DCFCE7] text-[#166534]"
                                : "bg-[#FEF3C7] text-[#92400E]"
                            }`}
                          >
                            {tx.transaction_type.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-right font-mono font-medium text-[#242724]">
                          {isDebit ? `- ${formatCurrency(tx.amount)}` : "—"}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-right font-mono font-bold text-[#15803D]">
                          {!isDebit ? `+ ${formatCurrency(tx.amount)}` : "—"}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-right font-mono font-bold text-[#242724]">
                          {formatCurrency(tx.running_balance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {filteredHistoryItems.length > ITEMS_PER_PAGE && (
            <div className="p-4 border-t border-[#E7E6E0] bg-[#FBFBFA] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#666864]">
              <div>
                {t.showing}{" "}
                <span className="font-semibold text-[#242724]">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}
                </span>{" "}
                –{" "}
                <span className="font-semibold text-[#242724]">
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredHistoryItems.length)}
                </span>{" "}
                {t.of}{" "}
                <span className="font-semibold text-[#242724]">
                  {filteredHistoryItems.length}
                </span>{" "}
                {t.transactions}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="min-h-[40px] px-3 py-1.5 rounded-md border border-[#E7E6E0] bg-white text-[#242724] font-semibold hover:bg-[#F0EFEA] disabled:opacity-40 transition"
                >
                  <ChevronLeft className="h-4 w-4 inline mr-1" />
                  {t.prev}
                </button>
                <span className="px-2 font-medium">
                  {t.page} {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="min-h-[40px] px-3 py-1.5 rounded-md border border-[#E7E6E0] bg-white text-[#242724] font-semibold hover:bg-[#F0EFEA] disabled:opacity-40 transition"
                >
                  {t.next}
                  <ChevronRight className="h-4 w-4 inline ml-1" />
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 7. DISTRIBUTOR CREDIT POLICY NOTICE */}
      <footer className="rounded-xl border border-[#E7E6E0] bg-white p-5 sm:p-6 shadow-sm flex items-start gap-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F4EFF0] text-[#79565D] mt-0.5">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="text-xs sm:text-sm text-[#666864] space-y-1">
          <h3 className="font-bold text-[#242724]">
            {t.creditPolicyTitle}
          </h3>
          <p className="leading-relaxed">
            {t.creditPolicyDesc}
          </p>
        </div>
      </footer>
    </div>
  );
}
