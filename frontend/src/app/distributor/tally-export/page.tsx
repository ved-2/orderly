"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";

interface TallyPreviewItem {
  voucher_number: string;
  voucher_date: string;
  party_name: string;
  retailer_code: string;
  item_name: string;
  sku: string;
  billed_qty: number;
  free_qty: number;
  uom: string;
  rate: number;
  discount: number;
  tax: number;
  amount: number;
  voucher_total: number;
  city: string;
  address: string;
  status: string;
}

interface TallyPreviewResponse {
  items: TallyPreviewItem[];
  count: number;
  orders_count: number;
}

interface UserProfile {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
}

const ALLOWED_ROLES = new Set(["DISTRIBUTOR_ADMIN", "ORDER_DESK"]);

export default function TallyExportPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState("APPROVED");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [preview, setPreview] = useState<TallyPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // 1. Authenticate user
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setProfileLoading(false);
      return;
    }

    let isMounted = true;
    async function fetchProfile() {
      try {
        const data = await apiRequest<UserProfile>("/auth/me");
        if (isMounted) setProfile(data);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Authentication error");
        }
      } finally {
        if (isMounted) setProfileLoading(false);
      }
    }

    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [user, authLoading]);

  // 2. Load Preview
  const loadPreview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let url = `/orders/export/tally?format=json&status=${statusFilter}`;
      if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
      if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;

      const res = await apiRequest<TallyPreviewResponse>(url);
      setPreview(res);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load Tally preview from server."
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter, startDate, endDate]);

  useEffect(() => {
    if (profile && ALLOWED_ROLES.has(profile.role)) {
      loadPreview();
    }
  }, [profile, loadPreview]);

  // 3. Download CSV File
  const handleDownloadCsv = async () => {
    if (!user) return;
    setDownloading(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL!.replace(/\/+$/, "");

      let url = `${baseUrl}/orders/export/tally?format=csv&status=${statusFilter}`;
      if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
      if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: "text/csv",
        },
      });

      if (!res.ok) {
        throw new Error(`Export failed with HTTP status ${res.status}`);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `orderly_tally_sales_${today}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download CSV.");
    } finally {
      setDownloading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  if (authLoading || profileLoading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm text-gray-500">Authenticating session...</p>
        </div>
      </main>
    );
  }

  if (!user || !profile || !ALLOWED_ROLES.has(profile.role)) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-md border border-gray-200 bg-white p-6">
          <h1 className="text-lg font-semibold text-gray-950">
            Access Restricted
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Only Distributor Administrators and Order Desk staff can export Tally vouchers.
          </p>
          <div className="mt-6">
            <Link
              href="/register"
              className="inline-block bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const items = preview?.items || [];
  const totalValue = items.reduce((acc, row) => acc + row.amount, 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E7E6E0] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#969892]">
            <span>ERP Accounting Integration</span>
            <span>·</span>
            <span>Tally Prime / ERP 9 Schemas</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#242724]">
            Tally Sales Voucher Export
          </h1>
          <p className="mt-0.5 text-xs text-[#666864]">
            Export approved dispatches and billed orders into Tally multi-line sales vouchers with itemized GST.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadCsv}
          disabled={downloading || items.length === 0}
          className="inline-flex items-center gap-2 rounded-[4px] bg-[#1E4B72] px-4 py-2 text-xs font-semibold text-white hover:bg-[#183c5c] transition-colors disabled:opacity-40 shadow-2xs"
        >
          {downloading ? "Generating CSV..." : "Download Tally CSV"}
        </button>
      </div>

      {error && (
        <div className="rounded-[6px] border border-[#EDBCBC] bg-[#FBF0F0] p-3 text-xs text-[#8C2828]">
          {error}
        </div>
      )}

      <div>
        {/* Filter Controls */}
        <div className="border border-gray-200 bg-white p-5 mb-6">
          <div className="grid gap-4 sm:grid-cols-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Order Status Filter
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 outline-none focus:border-gray-900"
              >
                <option value="APPROVED">Approved Orders Only</option>
                <option value="DISPATCHED">Dispatched Orders Only</option>
                <option value="ALL">All (Approved + Dispatched)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                From Date (Optional)
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-300 px-3 py-1.5 text-xs text-gray-900 outline-none focus:border-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                To Date (Optional)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-gray-300 px-3 py-1.5 text-xs text-gray-900 outline-none focus:border-gray-900"
              />
            </div>

            <div>
              <button
                type="button"
                onClick={loadPreview}
                disabled={loading}
                className="w-full border border-gray-900 bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? "Refreshing..." : "Update Preview"}
              </button>
            </div>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <div className="border border-gray-200 bg-white p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Orders Ready to Export
            </p>
            <p className="mt-2 text-2xl font-bold font-mono text-gray-950">
              {preview?.orders_count || 0}
            </p>
          </div>

          <div className="border border-gray-200 bg-white p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Voucher Line Items
            </p>
            <p className="mt-2 text-2xl font-bold font-mono text-gray-950">
              {preview?.count || 0}
            </p>
          </div>

          <div className="border border-gray-200 bg-white p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Export Batch Value
            </p>
            <p className="mt-2 text-2xl font-bold font-mono text-emerald-700">
              {formatCurrency(totalValue)}
            </p>
          </div>
        </div>

        {/* Preview Table */}
        <div className="border border-gray-200 bg-white mb-8">
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-950">
                Tally Voucher Preview
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Multi-line sales voucher format compatible with Tally Prime XML / CSV import.
              </p>
            </div>
            <div className="text-xs text-gray-500">
              {items.length} records in batch
            </div>
          </div>

          {loading && items.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Generating export preview...
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-medium text-gray-900">
                No orders match export criteria
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Approve newly submitted orders in the Order Desk to prepare them for Tally export.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Voucher #</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Party Ledger (Kirana)</th>
                    <th className="px-6 py-3">Item / SKU</th>
                    <th className="px-6 py-3 text-center">Billed Qty</th>
                    <th className="px-6 py-3 text-center">Free Qty</th>
                    <th className="px-6 py-3 text-right">Rate</th>
                    <th className="px-6 py-3 text-right">Line Amount</th>
                    <th className="px-6 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((row, idx) => (
                    <tr key={`${row.voucher_number}-${row.sku}-${idx}`} className="hover:bg-gray-50/50">
                      <td className="px-6 py-3 font-mono font-medium text-gray-950 text-xs">
                        {row.voucher_number}
                      </td>
                      <td className="px-6 py-3 text-xs text-gray-600">
                        {row.voucher_date}
                      </td>
                      <td className="px-6 py-3 text-xs">
                        <p className="font-medium text-gray-900">{row.party_name}</p>
                        <p className="text-gray-500 font-mono text-[11px]">{row.retailer_code}</p>
                      </td>
                      <td className="px-6 py-3 text-xs">
                        <p className="font-medium text-gray-900">{row.item_name}</p>
                        <p className="text-gray-500 font-mono text-[11px]">{row.sku}</p>
                      </td>
                      <td className="px-6 py-3 text-center font-mono text-xs text-gray-900">
                        {row.billed_qty} {row.uom}
                      </td>
                      <td className="px-6 py-3 text-center text-xs">
                        {row.free_qty > 0 ? (
                          <span className="border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800">
                            +{row.free_qty}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-xs text-gray-700">
                        {formatCurrency(row.rate)}
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-xs font-semibold text-gray-950">
                        {formatCurrency(row.amount)}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className="border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Technical Field Mapping Guide */}
        <div className="border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Tally Integration Field Mapping Standard
          </h3>
          <p className="mt-1 text-xs text-gray-600 leading-relaxed">
            The exported CSV conforms to standard Tally Prime voucher import fields.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            <div className="border border-gray-100 bg-gray-50 p-3">
              <span className="font-semibold text-gray-900">Party A/c Name</span>
              <p className="mt-0.5 text-gray-500">Mapped to verified Kirana Shop Name.</p>
            </div>
            <div className="border border-gray-100 bg-gray-50 p-3">
              <span className="font-semibold text-gray-900">Voucher Type</span>
              <p className="mt-0.5 text-gray-500">Defaults to Sales Voucher standard.</p>
            </div>
            <div className="border border-gray-100 bg-gray-50 p-3">
              <span className="font-semibold text-gray-900">Actual vs Billed Qty</span>
              <p className="mt-0.5 text-gray-500">Includes promotional free scheme quantities.</p>
            </div>
            <div className="border border-gray-100 bg-gray-50 p-3">
              <span className="font-semibold text-gray-900">GST / Tax Breakup</span>
              <p className="mt-0.5 text-gray-500">Pre-computed itemized line tax.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
