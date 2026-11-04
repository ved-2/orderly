"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Info,
  RefreshCw,
  Wallet,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";

interface RetailerInfo {
  id: string;
  shop_name: string;
  owner_name: string;
  retailer_code: string;
  phone: string;
}

interface CreditSummary {
  retailer: RetailerInfo;
  credit_limit: number;
  current_outstanding: number;
  available_credit: number;
  utilization_percentage: number;
  payment_terms_days: number;
  account_status: "HEALTHY" | "NEAR_LIMIT" | "LIMIT_EXCEEDED" | "NOT_ASSIGNED";
  updated_at: string | null;
  total_debits_amount: number;
  total_payments_amount: number;
  total_transactions_count: number;
}

interface LedgerItem {
  id: string;
  transaction_type: "ORDER_DEBIT" | "PAYMENT" | "CREDIT_NOTE" | "ADJUSTMENT";
  amount: number;
  reference_type: string | null;
  reference_id: string | null;
  reference_number: string | null;
  note: string | null;
  created_at: string;
  running_balance: number;
}

interface OutstandingInvoice {
  order_id: string;
  order_number: string;
  total_amount: number;
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

function formatCurrency(amount: number | string): string {
  const numeric = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numeric)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(numeric);
}

function formatDateTime(isoString: string): string {
  if (!isoString) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(isoString));
}

function formatDate(isoString: string | null): string {
  if (!isoString) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(isoString));
}

export default function RetailerCreditPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [ledgerData, setLedgerData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<
    "ALL" | "ORDER_DEBIT" | "PAYMENT" | "CREDIT_NOTE" | "ADJUSTMENT"
  >("ALL");
  const [exporting, setExporting] = useState(false);

  // 1. Fetch full ledger
  const fetchLedger = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let url = "/retailer/credit/ledger?limit=100";
      if (filterType !== "ALL") {
        url += `&type=${filterType}`;
      }

      const res = await apiRequest<LedgerResponse>(url);
      setLedgerData(res);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load credit statement."
      );
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/register");
      return;
    }
    void fetchLedger();
  }, [user, authLoading, router, fetchLedger]);

  // 2. Export statement as CSV
  const handleExportCsv = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const idToken = await user.getIdToken();
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL!.replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/retailer/credit/export`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: "text/csv",
        },
      });

      if (!res.ok) {
        throw new Error(`Export failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `credit_statement_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Failed to export statement. Please try again."
      );
    } finally {
      setExporting(false);
    }
  };

  if (authLoading || (loading && !ledgerData)) {
    return (
      <div className="p-6 sm:p-8 space-y-6">
        <div className="h-8 w-64 bg-neutral-200 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-neutral-200 animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-neutral-200 animate-pulse" />
      </div>
    );
  }

  if (error && !ledgerData) {
    return (
      <div className="p-6 sm:p-8">
        <div className="max-w-lg border border-red-200 bg-white p-6">
          <h2 className="text-base font-semibold text-red-950">
            Unable to load credit account
          </h2>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <button
            onClick={() => void fetchLedger()}
            className="mt-4 bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const summary = ledgerData?.summary;
  const items = ledgerData?.items || [];
  const outstandingInvoices = ledgerData?.outstanding_invoices || [];

  const utilization = summary?.utilization_percentage || 0;
  const isHealthy = summary?.account_status === "HEALTHY";
  const isNearLimit = summary?.account_status === "NEAR_LIMIT";
  const isExceeded = summary?.account_status === "LIMIT_EXCEEDED";

  return (
    <div className="p-6 sm:p-8 space-y-8">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Retailer Workspace / Credit Passbook
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-950">
            Credit Account & Statement
          </h1>
          {summary && (
            <p className="mt-1 text-xs text-neutral-600">
              <span className="font-semibold text-neutral-900">
                {summary.retailer.shop_name}
              </span>{" "}
              ({summary.retailer.retailer_code}) &bull; Payment Window:{" "}
              <span className="font-medium text-neutral-900">
                {summary.payment_terms_days} Days Net
              </span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void fetchLedger()}
            disabled={loading}
            className="flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={exporting || items.length === 0}
            className="flex items-center gap-1.5 bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            <Download size={14} />
            <span>{exporting ? "Generating..." : "Download Statement (CSV)"}</span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Approved Limit */}
        <div className="border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">
              Total Credit Limit
            </span>
            <Wallet size={16} />
          </div>
          <p className="mt-3 text-2xl font-bold font-mono text-neutral-950">
            {formatCurrency(summary?.credit_limit || 0)}
          </p>
          <p className="mt-1 text-[11px] text-neutral-500">
            Trade credit sanctioned by distributor
          </p>
        </div>

        {/* Current Outstanding */}
        <div className="border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">
              Current Outstanding
            </span>
            <ArrowUpRight size={16} className="text-amber-600" />
          </div>
          <p className="mt-3 text-2xl font-bold font-mono text-amber-900">
            {formatCurrency(summary?.current_outstanding || 0)}
          </p>
          <p className="mt-1 text-[11px] text-neutral-500">
            Total unpaid balance across approved orders
          </p>
        </div>

        {/* Available Credit */}
        <div className="border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">
              Available Headroom
            </span>
            <ArrowDownLeft size={16} className="text-emerald-600" />
          </div>
          <p className="mt-3 text-2xl font-bold font-mono text-emerald-800">
            {formatCurrency(summary?.available_credit || 0)}
          </p>
          <p className="mt-1 text-[11px] text-neutral-500">
            Remaining credit available for new orders
          </p>
        </div>

        {/* Account Status */}
        <div className="border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">
              Credit Status
            </span>
            {isHealthy && <CheckCircle2 size={16} className="text-emerald-600" />}
            {isNearLimit && <AlertCircle size={16} className="text-amber-600" />}
            {isExceeded && <AlertCircle size={16} className="text-red-600" />}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span
              className={`inline-block px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                isHealthy
                  ? "border border-emerald-300 bg-emerald-50 text-emerald-900"
                  : isNearLimit
                  ? "border border-amber-300 bg-amber-50 text-amber-900"
                  : isExceeded
                  ? "border border-red-300 bg-red-50 text-red-900"
                  : "border border-neutral-300 bg-neutral-100 text-neutral-700"
              }`}
            >
              {summary?.account_status.replace("_", " ") || "UNKNOWN"}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-neutral-500">
            Settlement window: {summary?.payment_terms_days || 7} days
          </p>
        </div>
      </div>

      {/* 3. Credit Utilization Progress Bar */}
      <div className="border border-neutral-200 bg-white p-5 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-neutral-800 uppercase tracking-wider">
            Credit Line Utilization
          </span>
          <span className="font-mono font-bold text-neutral-900">
            {utilization}% Used
          </span>
        </div>

        <div className="h-3 w-full bg-neutral-100 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isExceeded
                ? "bg-red-600"
                : isNearLimit
                ? "bg-amber-500"
                : "bg-neutral-900"
            }`}
            style={{ width: `${Math.min(utilization, 100)}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between text-[11px] text-neutral-500 pt-1">
          <span>
            {formatCurrency(summary?.current_outstanding || 0)} used of{" "}
            {formatCurrency(summary?.credit_limit || 0)} limit
          </span>
          <span className="font-medium text-emerald-700">
            {formatCurrency(summary?.available_credit || 0)} available for immediate
            order dispatch
          </span>
        </div>
      </div>

      {/* 4. Active Due Invoices (Approved & Dispatched Orders) */}
      <div className="border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-950">
              Unsettled Orders Pending Clearance
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Approved orders currently contributing to your outstanding balance
            </p>
          </div>
          <span className="text-xs font-mono font-medium text-neutral-600 bg-neutral-100 px-2 py-0.5">
            {outstandingInvoices.length} active
          </span>
        </div>

        {outstandingInvoices.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle2 size={24} className="mx-auto text-emerald-600" />
            <p className="mt-2 text-xs font-semibold text-neutral-900">
              No outstanding unpaid orders
            </p>
            <p className="mt-1 text-[11px] text-neutral-500">
              All approved deliveries have been settled. Your full credit line is
              available.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="py-2.5 px-6 font-semibold">Order Number</th>
                  <th className="py-2.5 px-6 font-semibold">Approval Date</th>
                  <th className="py-2.5 px-6 font-semibold">Due Date</th>
                  <th className="py-2.5 px-6 font-semibold text-right">
                    Order Amount
                  </th>
                  <th className="py-2.5 px-6 font-semibold text-center">
                    Settlement Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-neutral-800">
                {outstandingInvoices.map((inv) => (
                  <tr key={inv.order_id} className="hover:bg-neutral-50">
                    <td className="py-3 px-6 font-mono font-semibold">
                      <Link
                        href="/retailer/orders"
                        className="text-neutral-900 underline hover:text-neutral-600"
                      >
                        {inv.order_number}
                      </Link>
                    </td>
                    <td className="py-3 px-6 text-neutral-600">
                      {formatDate(inv.approved_at)}
                    </td>
                    <td className="py-3 px-6 text-neutral-600">
                      {formatDate(inv.due_date)}
                    </td>
                    <td className="py-3 px-6 text-right font-mono font-semibold text-neutral-950">
                      {formatCurrency(inv.total_amount)}
                    </td>
                    <td className="py-3 px-6 text-center">
                      {inv.is_overdue ? (
                        <span className="inline-block border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-800">
                          Overdue ({Math.abs(inv.days_remaining || 0)}d)
                        </span>
                      ) : (
                        <span className="inline-block border border-neutral-300 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-700">
                          Due in {inv.days_remaining ?? summary?.payment_terms_days}d
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Complete Ledger / Passbook Statement */}
      <div className="border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-950">
              Transaction Passbook & Ledger
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Complete chronological audit of order debits, cash/bank payments, and
              adjustments
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "ALL", label: "All Transactions" },
              { id: "ORDER_DEBIT", label: "Order Debits" },
              { id: "PAYMENT", label: "Payments Received" },
              { id: "CREDIT_NOTE", label: "Credit Notes" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() =>
                  setFilterType(
                    tab.id as
                      | "ALL"
                      | "ORDER_DEBIT"
                      | "PAYMENT"
                      | "CREDIT_NOTE"
                      | "ADJUSTMENT"
                  )
                }
                className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                  filterType === tab.id
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={24} className="mx-auto text-neutral-400" />
            <p className="mt-2 text-xs font-semibold text-neutral-900">
              No transactions found
            </p>
            <p className="mt-1 text-[11px] text-neutral-500">
              {filterType === "ALL"
                ? "Your credit ledger will show debits and payments once orders are placed and settled."
                : "No transactions match the selected filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="py-2.5 px-6 font-semibold">Date & Time (IST)</th>
                  <th className="py-2.5 px-6 font-semibold">Type</th>
                  <th className="py-2.5 px-6 font-semibold">Reference</th>
                  <th className="py-2.5 px-6 font-semibold text-right">
                    Debit (Dr.)
                  </th>
                  <th className="py-2.5 px-6 font-semibold text-right">
                    Credit (Cr.)
                  </th>
                  <th className="py-2.5 px-6 font-semibold text-right">
                    Running Balance
                  </th>
                  <th className="py-2.5 px-6 font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-neutral-800">
                {items.map((tx) => {
                  const isDebit = tx.transaction_type === "ORDER_DEBIT";
                  const isCredit =
                    tx.transaction_type === "PAYMENT" ||
                    tx.transaction_type === "CREDIT_NOTE";

                  return (
                    <tr key={tx.id} className="hover:bg-neutral-50">
                      <td className="py-3 px-6 font-mono text-neutral-600 whitespace-nowrap">
                        {formatDateTime(tx.created_at)}
                      </td>
                      <td className="py-3 px-6 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            isDebit
                              ? "border border-neutral-300 bg-neutral-100 text-neutral-800"
                              : isCredit
                              ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                              : "border border-amber-300 bg-amber-50 text-amber-800"
                          }`}
                        >
                          {tx.transaction_type === "ORDER_DEBIT"
                            ? "Order Debit"
                            : tx.transaction_type === "PAYMENT"
                            ? "Payment"
                            : tx.transaction_type === "CREDIT_NOTE"
                            ? "Credit Note"
                            : "Adjustment"}
                        </span>
                      </td>
                      <td className="py-3 px-6 font-mono">
                        {tx.reference_number ? (
                          <Link
                            href="/retailer/orders"
                            className="text-neutral-900 underline hover:text-neutral-600"
                          >
                            {tx.reference_number}
                          </Link>
                        ) : tx.reference_type ? (
                          <span className="text-neutral-600">
                            {tx.reference_type}
                          </span>
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-6 text-right font-mono font-medium text-neutral-950">
                        {isDebit ? formatCurrency(tx.amount) : "-"}
                      </td>
                      <td className="py-3 px-6 text-right font-mono font-semibold text-emerald-700">
                        {isCredit ? formatCurrency(tx.amount) : "-"}
                      </td>
                      <td className="py-3 px-6 text-right font-mono font-bold text-neutral-900">
                        {formatCurrency(tx.running_balance)}
                      </td>
                      <td className="py-3 px-6 text-neutral-600 max-w-xs truncate">
                        {tx.note || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Kirana Credit Information Notice */}
      <div className="border border-neutral-200 bg-white p-5 flex items-start gap-3">
        <Info size={18} className="text-neutral-600 shrink-0 mt-0.5" />
        <div className="text-xs text-neutral-600 space-y-1">
          <p className="font-semibold text-neutral-900">
            How Orderly Credit Billing Works
          </p>
          <p className="leading-relaxed">
            Every approved order automatically debits from your credit line.
            Payments collected in cash, cheque, or UPI by your assigned distributor
            salesman are recorded in real-time, instantly restoring your available
            order headroom.
          </p>
        </div>
      </div>
    </div>
  );
}
