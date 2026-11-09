"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Users,
  Store,
  RefreshCw,
  Search,
  Filter,
  FileSpreadsheet,
  ArrowUpRight,
  ExternalLink,
  ChevronRight,
  Truck,
} from "lucide-react";

import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface SalesMetricsResponse {
  total_revenue: number;
  total_orders: number;
  confirmed_revenue: number;
  confirmed_orders_count: number;
  pending_revenue: number;
  pending_orders_count: number;
  avg_order_value: number;
  status_breakdown: Record<string, { count: number; amount: number }>;
  source_breakdown: Record<string, { count: number; amount: number }>;
  top_retailers: Array<{
    id: string;
    shop_name: string;
    retailer_code: string;
    city: string;
    orders_count: number;
    total_spend: number;
  }>;
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
  total_amount: number;
  items_count: number;
  created_at: string;
  source?: string;
}

interface DeskListingResponse {
  items: OrderSummary[];
  total: number;
  counts: Record<string, number>;
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(val);
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function DistributorSalesPage() {
  const [metrics, setMetrics] = useState<SalesMetricsResponse | null>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [metricsRes, ordersRes] = await Promise.all([
        apiRequest<SalesMetricsResponse>("/distributor/sales/metrics"),
        apiRequest<DeskListingResponse>(
          `/orders/desk?limit=50${statusFilter !== "ALL" ? `&status=${statusFilter}` : ""}`
        ),
      ]);

      setMetrics(metricsRes);
      setOrders(ordersRes.items || []);
      setCounts(ordersRes.counts || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sales data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    document.title = "B2B Sales & Revenue Intelligence | Orderly";
    loadData();
  }, [loadData]);

  const filteredOrders = orders.filter((o) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.order_number.toLowerCase().includes(q) ||
      (o.shop_name && o.shop_name.toLowerCase().includes(q)) ||
      (o.retailer_code && o.retailer_code.toLowerCase().includes(q)) ||
      (o.retailer_city && o.retailer_city.toLowerCase().includes(q)) ||
      (o.retailer_phone && o.retailer_phone.includes(q))
    );
  });

  const statusBadgeVariant = (st: string) => {
    switch (st) {
      case "APPROVED":
      case "DISPATCHED":
        return "success";
      case "ON_HOLD":
      case "REJECTED":
        return "danger";
      case "UNDER_REVIEW":
        return "warning";
      default:
        return "info";
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E7E6E0] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#969892]">
            <TrendingUp size={14} className="text-[#205234]" />
            <span>Commercial Depot Intelligence</span>
            <span>·</span>
            <span>Central MP Wholesale Hub</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#242724]">
            B2B Sales & Revenue Performance
          </h1>
          <p className="mt-0.5 text-xs text-[#666864]">
            Live GMV monitoring, field salesman beat conversion, and retail store account ledgers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#E7E6E0] bg-white px-3 py-2 text-xs font-semibold text-[#242724] hover:bg-[#FAF9F6] transition-colors"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <Link
            href="/distributor/tally-export"
            className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#1E4B72] px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-[#183c5c] transition-colors"
          >
            <FileSpreadsheet size={13} />
            <span>Tally Export</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-[6px] border border-[#EDBCBC] bg-[#FBF0F0] p-4 text-xs text-[#8C2828] flex items-center justify-between">
          <p>{error}</p>
          <button
            onClick={() => loadData()}
            className="font-bold underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total B2B Revenue */}
        <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between text-[#666864]">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Total Booked GMV
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#EEF6F1] text-[#205234]">
              <TrendingUp size={15} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#242724]">
            {loading ? "..." : formatCurrency(metrics?.total_revenue || 0)}
          </p>
          <p className="mt-1 text-[11px] text-[#969892]">
            Across {metrics?.total_orders || 0} wholesale orders
          </p>
        </div>

        {/* Confirmed Dispatch Revenue */}
        <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between text-[#666864]">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Approved & Dispatched
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#EEF6F1] text-[#205234]">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#205234]">
            {loading ? "..." : formatCurrency(metrics?.confirmed_revenue || 0)}
          </p>
          <p className="mt-1 text-[11px] text-[#969892]">
            {metrics?.confirmed_orders_count || 0} orders ready for invoice billing
          </p>
        </div>

        {/* Pipeline Value (Holds / Reviews) */}
        <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between text-[#666864]">
            <span className="text-[#7A4E12] text-[11px] font-bold uppercase tracking-wider">
              Desk Review Pipeline
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#FCF6EC] text-[#7A4E12]">
              <Clock size={15} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#7A4E12]">
            {loading ? "..." : formatCurrency(metrics?.pending_revenue || 0)}
          </p>
          <p className="mt-1 text-[11px] text-[#969892]">
            {metrics?.pending_orders_count || 0} orders awaiting credit check
          </p>
        </div>

        {/* Average Order Value (AOV) */}
        <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between text-[#666864]">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Average Order Value
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#F4EFF0] text-[#79565D]">
              <DollarSign size={15} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#242724]">
            {loading ? "..." : formatCurrency(metrics?.avg_order_value || 0)}
          </p>
          <p className="mt-1 text-[11px] text-[#969892]">
            High-density Jabalpur FMCG mix
          </p>
        </div>
      </div>

      {/* Breakdown Row: Source & Top Spenders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channel Breakdown */}
        <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs lg:col-span-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#969892] mb-3">
            Sales Capture Channels
          </h2>
          <div className="space-y-3">
            {Object.entries(metrics?.source_breakdown || {}).map(([src, stat]) => (
              <div
                key={src}
                className="flex items-center justify-between p-3 rounded-[4px] border border-[#E7E6E0] bg-[#FAF9F6]"
              >
                <div>
                  <span className="font-semibold text-xs text-[#242724]">
                    {src === "SALESMAN"
                      ? "Field Salesman Beat"
                      : src === "AI_CHAT"
                      ? "AI Voice / Chat Order"
                      : src === "PARCHI_SCAN"
                      ? "Handwritten Slip OCR"
                      : "Direct Web Portal"}
                  </span>
                  <p className="text-[10px] text-[#969892]">{stat.count} orders booked</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-[#242724]">
                    {formatCurrency(stat.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0EFEA] flex justify-between items-center text-xs">
            <span className="text-[#666864]">Manage Beat Team</span>
            <Link
              href="/distributor/salesman"
              className="text-[#79565D] font-bold hover:underline inline-flex items-center gap-1"
            >
              <span>Salesmen Beats</span>
              <ChevronRight size={13} />
            </Link>
          </div>
        </div>

        {/* Top 5 Kirana Accounts */}
        <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#969892]">
              Top FMCG Retail Accounts by Volume
            </h2>
            <Link
              href="/distributor/retailers"
              className="text-xs font-semibold text-[#79565D] hover:underline"
            >
              View Full Network
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E7E6E0] bg-[#FAF9F6] text-[#666864] text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Kirana Store</th>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">City</th>
                  <th className="py-2.5 px-3 text-right">Orders</th>
                  <th className="py-2.5 px-3 text-right">Total Billing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EFEA]">
                {(metrics?.top_retailers || []).map((ret) => (
                  <tr key={ret.id} className="hover:bg-[#FAF9F6]">
                    <td className="py-2.5 px-3 font-semibold text-[#242724]">
                      {ret.shop_name}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[#666864]">
                      {ret.retailer_code}
                    </td>
                    <td className="py-2.5 px-3 text-[#666864]">{ret.city}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-[#242724]">
                      {ret.orders_count}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#205234]">
                      {formatCurrency(ret.total_spend)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Orders Transaction Log */}
      <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#242724]">
              Live Wholesale Orders Ledger
            </h2>
            <p className="text-[11px] text-[#666864]">
              Inspect billing statuses, credit check verifications, and dispatches.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#969892]"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order #, shop, city..."
                className="h-8 rounded-[4px] border border-[#E7E6E0] bg-white pl-8 pr-3 text-xs text-[#242724] placeholder-[#969892] focus:border-[#79565D] focus:outline-none w-56 sm:w-64"
              />
            </div>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 border-b border-[#E7E6E0] pb-2 text-xs">
          {[
            { key: "ALL", label: "All Orders" },
            { key: "SUBMITTED", label: "Submitted" },
            { key: "UNDER_REVIEW", label: "Under Review" },
            { key: "ON_HOLD", label: "Credit Hold" },
            { key: "APPROVED", label: "Approved" },
            { key: "DISPATCHED", label: "Dispatched" },
            { key: "REJECTED", label: "Rejected" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`rounded-[4px] px-2.5 py-1 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                statusFilter === tab.key
                  ? "bg-[#242724] text-white"
                  : "bg-[#FAF9F6] text-[#666864] hover:bg-[#F0EFEA] hover:text-[#242724]"
              }`}
            >
              <span>{tab.label}</span>
              {counts[tab.key] !== undefined && (
                <span
                  className={`rounded-full px-1.5 text-[10px] ${
                    statusFilter === tab.key
                      ? "bg-white/20 text-white"
                      : "bg-[#E7E6E0] text-[#666864]"
                  }`}
                >
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E7E6E0] bg-[#FAF9F6] text-[#666864] text-[10px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Order #</th>
                <th className="py-2.5 px-3">Retailer Store</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Items</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EFEA]">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#969892]">
                    No orders match your search or filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#FAF9F6]">
                    <td className="py-3 px-3 font-mono font-bold text-[#242724]">
                      {order.order_number}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-[#242724]">
                        {order.shop_name || "Direct Kirana"}
                      </p>
                      <p className="text-[10px] text-[#969892]">
                        {order.retailer_code} · {order.retailer_city}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-[#666864]">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#242724]">
                      {order.items_count} lines
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-[#242724]">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge variant={statusBadgeVariant(order.status) as any}>
                        {order.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href={`/order-desk`}
                        className="inline-flex items-center gap-1 rounded-[4px] border border-[#E7E6E0] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#79565D] hover:bg-[#FAF9F6] transition-colors"
                      >
                        <span>Inspect Desk</span>
                        <ArrowUpRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
