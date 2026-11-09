"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Inbox,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  ArrowRight,
  ShieldAlert,
  Store,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Boxes,
} from "lucide-react";

import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface DeskStatusCounts {
  ALL: number;
  SUBMITTED: number;
  UNDER_REVIEW: number;
  ON_HOLD: number;
  APPROVED: number;
  REJECTED: number;
  DISPATCHED: number;
}

interface OrderItem {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  quantity_unit: string;
  free_quantity: number;
  unit_price: number;
  line_total: number;
}

interface OrderSummary {
  id: string;
  order_number: string;
  retailer_id: string;
  shop_name: string | null;
  retailer_code: string | null;
  retailer_phone: string | null;
  retailer_city: string | null;
  status: string;
  source: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  customer_note: string | null;
  desk_note: string | null;
  items_count: number;
  created_at: string;
  submitted_at: string | null;
  approved_at: string | null;
  lines: OrderItem[];
  credit: {
    credit_limit: number;
    current_outstanding: number;
    available_credit: number;
  } | null;
}

interface DeskListingResponse {
  items: OrderSummary[];
  total: number;
  limit: number;
  offset: number;
  counts: DeskStatusCounts;
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(val);
}

function formatDate(isoString: string | null): string {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export default function OrderDeskWorkspacePage() {
  const [data, setData] = useState<DeskListingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspaceData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await apiRequest<DeskListingResponse>("/orders/desk?limit=8");
      setData(res);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load Order Desk workspace data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Order Desk Workspace | Orderly";
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  const counts = data?.counts || {
    ALL: 0,
    SUBMITTED: 0,
    UNDER_REVIEW: 0,
    ON_HOLD: 0,
    APPROVED: 0,
    REJECTED: 0,
    DISPATCHED: 0,
  };

  const urgentOrders = data?.items || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Workspace Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E7E6E0] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#242724]">
              Order Desk Workspace
            </h1>
            <Badge variant="outline" className="text-[10px]">
              Live Depot Queue
            </Badge>
          </div>
          <p className="mt-1 text-xs text-[#666864]">
            Operational triage for incoming retailer orders, stock reservation, and credit controls.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadWorkspaceData(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#E7E6E0] bg-white px-3 py-1.5 text-xs font-semibold text-[#242724] hover:bg-[#F0EFEA] transition-colors shadow-2xs disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            <span>{refreshing ? "Syncing..." : "Refresh Status"}</span>
          </button>
          <Link
            href="/order-desk/orders"
            className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#79565D] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#67474E] transition-colors shadow-2xs"
          >
            <span>Open All Orders Queue</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-[4px] border border-[#EDBCBC] bg-[#FBF0F0] p-4 text-xs text-[#8C2828] flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => loadWorkspaceData(true)}
            className="font-semibold underline ml-3"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4 Primary Operational Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Pending Review */}
        <Link
          href="/order-desk/orders?status=SUBMITTED"
          className="group rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs hover:border-[#7A4E12] transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#969892]">
              Action Required
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#FCF6EC] text-[#7A4E12]">
              <Clock size={15} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold font-mono text-[#242724] tabular-nums">
            {loading ? "—" : counts.SUBMITTED}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-[#666864] text-[11px]">Pending Desk Review</span>
            <span className="font-semibold text-[#7A4E12] group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 text-[11px]">
              Triage &rarr;
            </span>
          </div>
        </Link>

        {/* 2. In Review */}
        <Link
          href="/order-desk/orders?status=UNDER_REVIEW"
          className="group rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs hover:border-[#1E4B72] transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#969892]">
              Under Review
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#EFF5FB] text-[#1E4B72]">
              <Inbox size={15} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold font-mono text-[#242724] tabular-nums">
            {loading ? "—" : counts.UNDER_REVIEW}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-[#666864] text-[11px]">Being Verified</span>
            <span className="font-semibold text-[#1E4B72] group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 text-[11px]">
              Resume &rarr;
            </span>
          </div>
        </Link>

        {/* 3. Credit / Stock Holds */}
        <Link
          href="/order-desk/orders?status=ON_HOLD"
          className="group rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs hover:border-[#8C2828] transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#969892]">
              On Hold
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#FBF0F0] text-[#8C2828]">
              <ShieldAlert size={15} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold font-mono text-[#242724] tabular-nums">
            {loading ? "—" : counts.ON_HOLD}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-[#666864] text-[11px]">Credit / Stock Exception</span>
            <span className="font-semibold text-[#8C2828] group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 text-[11px]">
              Inspect &rarr;
            </span>
          </div>
        </Link>

        {/* 4. Confirmed Today */}
        <Link
          href="/order-desk/orders?status=APPROVED"
          className="group rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs hover:border-[#205234] transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#969892]">
              Confirmed
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#EEF6F1] text-[#205234]">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold font-mono text-[#242724] tabular-nums">
            {loading ? "—" : counts.APPROVED}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-[#666864] text-[11px]">Ready for Dispatch / Tally</span>
            <span className="font-semibold text-[#205234] group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 text-[11px]">
              View &rarr;
            </span>
          </div>
        </Link>
      </div>

      {/* Urgent Orders Queue Card */}
      <div className="rounded-[6px] border border-[#E7E6E0] bg-white shadow-2xs overflow-hidden">
        <div className="border-b border-[#E7E6E0] bg-[#FAF9F6] px-5 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#242724]">
              Actionable Orders Intake
            </h2>
            <p className="mt-0.5 text-[11px] text-[#666864]">
              Latest incoming orders requiring review, verification, or hold resolution.
            </p>
          </div>
          <Link
            href="/order-desk/orders"
            className="text-xs font-semibold text-[#79565D] hover:underline flex items-center gap-1"
          >
            <span>View All ({counts.ALL})</span>
            <ChevronRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded bg-[#F0EFEA] animate-pulse" />
            ))}
          </div>
        ) : urgentOrders.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#666864]">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF6F1] text-[#205234] mb-2">
              <CheckCircle2 size={18} />
            </div>
            <p className="font-bold text-[#242724]">All Caught Up!</p>
            <p className="mt-1 text-[11px] text-[#969892]">
              There are no orders requiring attention in the intake queue right now.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E7E6E0] bg-[#FAF9F6] text-[10px] font-bold uppercase tracking-wider text-[#969892]">
                <tr>
                  <th className="px-5 py-2.5">Order / Source</th>
                  <th className="px-5 py-2.5">Kirana Retailer</th>
                  <th className="px-5 py-2.5 text-center">Items</th>
                  <th className="px-5 py-2.5 text-right">Order Value</th>
                  <th className="px-5 py-2.5 text-center">Credit Exposure</th>
                  <th className="px-5 py-2.5 text-center">Status</th>
                  <th className="px-5 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EFEA]">
                {urgentOrders.map((order) => {
                  const isCreditShort =
                    order.credit &&
                    order.total_amount > order.credit.available_credit;

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-[#FBFBFA] transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/order-desk/orders/${order.id}`}
                          className="font-mono font-bold text-[#242724] hover:text-[#79565D] hover:underline"
                        >
                          {order.order_number}
                        </Link>
                        <p className="text-[10px] text-[#969892] mt-0.5">
                          {formatDate(order.submitted_at || order.created_at)} •{" "}
                          <span className="font-semibold text-[#666864]">
                            {order.source}
                          </span>
                        </p>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 font-bold text-[#242724]">
                          <Store size={13} className="text-[#79565D] shrink-0" />
                          <span className="truncate max-w-[180px]">
                            {order.shop_name || "Kirana Retailer"}
                          </span>
                        </div>
                        <p className="font-mono text-[10px] text-[#969892] mt-0.5">
                          {order.retailer_code || "Code Pending"} • {order.retailer_city || "Jabalpur"}
                        </p>
                      </td>

                      <td className="px-5 py-3.5 text-center font-mono font-semibold text-[#242724]">
                        {order.items_count} SKUs
                      </td>

                      <td className="px-5 py-3.5 text-right font-mono font-bold text-[#242724] tabular-nums">
                        {formatCurrency(order.total_amount)}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        {order.credit ? (
                          isCreditShort ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8C2828] bg-[#FBF0F0] px-2 py-0.5 rounded-[3px] border border-[#EDBCBC]">
                              <AlertTriangle size={11} />
                              <span>Limit Exceeded</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-[#205234]">
                              {formatCurrency(order.credit.available_credit)} avail
                            </span>
                          )
                        ) : (
                          <span className="text-[#969892] text-[11px]">—</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <Badge
                          variant={
                            order.status === "APPROVED"
                              ? "success"
                              : order.status === "SUBMITTED"
                              ? "warning"
                              : order.status === "UNDER_REVIEW"
                              ? "info"
                              : order.status === "ON_HOLD"
                              ? "warning"
                              : order.status === "REJECTED"
                              ? "danger"
                              : "default"
                          }
                        >
                          {order.status.replace("_", " ")}
                        </Badge>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/order-desk/orders/${order.id}`}
                          className="inline-flex items-center gap-1 rounded-[4px] border border-[#E7E6E0] bg-white px-2.5 py-1 text-xs font-semibold text-[#242724] hover:border-[#79565D] hover:text-[#79565D] transition-colors"
                        >
                          <span>Review</span>
                          <ChevronRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Operations Quick Utilities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tally Voucher Export Card */}
        <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#EFF5FB] text-[#1E4B72]">
                <FileSpreadsheet size={18} />
              </div>
              <Badge variant="info">ERP Sync</Badge>
            </div>
            <h3 className="mt-3.5 font-bold text-sm text-[#242724]">
              Tally Voucher Export Utility
            </h3>
            <p className="mt-1 text-xs text-[#666864] leading-relaxed">
              Generate standardized sales vouchers for all approved kirana orders formatted for direct daily import into Tally ERP 9 / Tally Prime.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-[#F0EFEA]">
            <Link
              href="/distributor/tally-export"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E4B72] hover:underline"
            >
              <span>Launch Tally Export Utility</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* Operating Rules & Warehouse Lock Checklist */}
        <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#F4EFF0] text-[#79565D]">
                <Boxes size={18} />
              </div>
              <Badge variant="accent">Depot Protocol</Badge>
            </div>
            <h3 className="mt-3.5 font-bold text-sm text-[#242724]">
              Distributor Verification Protocols
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs text-[#666864]">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#205234]" />
                <span>Warehouse stock reserved automatically on order approval.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#205234]" />
                <span>Retailer credit limit verified before releasing holds.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#205234]" />
                <span>Trade scheme discounts locked per unit case arithmetic.</span>
              </li>
            </ul>
          </div>
          <div className="mt-5 pt-3 border-t border-[#F0EFEA]">
            <Link
              href="/order-desk/orders?status=ON_HOLD"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#79565D] hover:underline"
            >
              <span>Manage Credit Holds ({counts.ON_HOLD})</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
