"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  RefreshCw,
  Store,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  ShieldAlert,
} from "lucide-react";

import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface OrderLineItem {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  quantity_unit: string;
  free_quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
}

interface OrderItem {
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
  lines: OrderLineItem[];
  credit: {
    credit_limit: number;
    current_outstanding: number;
    available_credit: number;
  } | null;
}

interface DeskStatusCounts {
  ALL: number;
  SUBMITTED: number;
  UNDER_REVIEW: number;
  ON_HOLD: number;
  APPROVED: number;
  REJECTED: number;
  DISPATCHED: number;
}

interface DeskListingResponse {
  items: OrderItem[];
  total: number;
  limit: number;
  offset: number;
  counts: DeskStatusCounts;
}

const PAGE_SIZE = 25;

const STATUS_TABS = [
  { label: "All Orders", value: "ALL" },
  { label: "Pending", value: "SUBMITTED" },
  { label: "Under Review", value: "UNDER_REVIEW" },
  { label: "Credit Holds", value: "ON_HOLD" },
  { label: "Confirmed", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];

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

function OrdersQueueContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Status filter from URL query param (e.g. ?status=ON_HOLD)
  const initialStatus = searchParams.get("status") || "ALL";
  const [activeTab, setActiveTab] = useState<string>(initialStatus);

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [counts, setCounts] = useState<DeskStatusCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Slide-over preview drawer
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);

  // Sync tab with URL search parameter if changed externally
  useEffect(() => {
    const paramStatus = searchParams.get("status") || "ALL";
    setActiveTab(paramStatus);
    setOffset(0);
  }, [searchParams]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadOrders = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        let url = `/orders/desk?limit=${PAGE_SIZE}&offset=${offset}`;
        if (activeTab && activeTab !== "ALL") {
          url += `&status=${encodeURIComponent(activeTab)}`;
        }
        if (debouncedSearch) {
          url += `&search=${encodeURIComponent(debouncedSearch)}`;
        }

        const res = await apiRequest<DeskListingResponse>(url);
        setOrders(res.items || []);
        setTotal(res.total || 0);
        setOffset(res.offset || 0);
        if (res.counts) setCounts(res.counts);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load orders queue from depot server."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTab, debouncedSearch, offset]
  );

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleTabChange = (newStatus: string) => {
    setActiveTab(newStatus);
    setOffset(0);
    if (newStatus === "ALL") {
      router.push("/order-desk/orders");
    } else {
      router.push(`/order-desk/orders?status=${newStatus}`);
    }
  };

  const handlePrevPage = () => {
    if (offset > 0) {
      setOffset(Math.max(0, offset - PAGE_SIZE));
    }
  };

  const handleNextPage = () => {
    if (offset + PAGE_SIZE < total) {
      setOffset(offset + PAGE_SIZE);
    }
  };

  const getTabCount = (tabValue: string) => {
    if (!counts) return null;
    return counts[tabValue as keyof DeskStatusCounts] ?? null;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E7E6E0] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#242724]">
              Orders Queue
            </h1>
            <Badge variant="outline" className="text-[10px]">
              {total} Orders Listed
            </Badge>
          </div>
          <p className="mt-1 text-xs text-[#666864]">
            Search, filter, inspect, and approve retailer orders with depot inventory validation.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadOrders(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#E7E6E0] bg-white px-3 py-1.5 text-xs font-semibold text-[#242724] hover:bg-[#F0EFEA] transition-colors shadow-2xs self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          <span>{refreshing ? "Syncing..." : "Refresh Queue"}</span>
        </button>
      </div>

      {/* Status Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Horizontal Status Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
          {STATUS_TABS.map((tab) => {
            const active = activeTab === tab.value;
            const count = getTabCount(tab.value);

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => handleTabChange(tab.value)}
                className={`flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? "bg-[#242724] text-white shadow-2xs"
                    : "border border-[#E7E6E0] bg-white text-[#666864] hover:bg-[#F0EFEA] hover:text-[#242724]"
                }`}
              >
                <span>{tab.label}</span>
                {count !== null && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums ${
                      active
                        ? "bg-white text-[#242724]"
                        : tab.value === "ON_HOLD"
                        ? "bg-[#FBF0F0] text-[#8C2828] border border-[#EDBCBC]"
                        : tab.value === "SUBMITTED"
                        ? "bg-[#FCF6EC] text-[#7A4E12] border border-[#EED7B3]"
                        : "bg-[#F0EFEA] text-[#666864]"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Field */}
        <div className="relative w-full md:w-72">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#969892]"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search order #, shop, code, phone..."
            className="w-full rounded-[4px] border border-[#E7E6E0] bg-white pl-8 pr-8 py-1.5 text-xs text-[#242724] placeholder:text-[#969892] focus:border-[#79565D] focus:outline-none"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#969892] hover:text-[#242724]"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-[4px] border border-[#EDBCBC] bg-[#FBF0F0] p-4 text-xs text-[#8C2828] flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => loadOrders(true)}
            className="font-semibold underline ml-3"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Table / Mobile Cards */}
      <div className="rounded-[6px] border border-[#E7E6E0] bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 rounded bg-[#F0EFEA] animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="p-16 text-center text-xs text-[#666864]">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#FAF9F6] text-[#969892] border border-[#E7E6E0] mb-2.5">
              <Receipt size={18} />
            </div>
            <p className="font-bold text-[#242724]">No Orders Found</p>
            <p className="mt-1 text-[11px] text-[#969892]">
              {debouncedSearch
                ? `No orders matching "${debouncedSearch}". Try a different keyword.`
                : `There are currently no orders in the ${activeTab.replace("_", " ")} queue.`}
            </p>
            {debouncedSearch && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="mt-3 text-xs font-semibold text-[#79565D] hover:underline"
              >
                Clear Search Filter
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#E7E6E0] bg-[#FAF9F6] text-[10px] font-bold uppercase tracking-wider text-[#969892]">
                  <tr>
                    <th className="px-5 py-2.5">Order / Source</th>
                    <th className="px-5 py-2.5">Kirana Retailer</th>
                    <th className="px-5 py-2.5 text-center">Items</th>
                    <th className="px-5 py-2.5 text-center">Credit Standing</th>
                    <th className="px-5 py-2.5 text-right">Total Amount</th>
                    <th className="px-5 py-2.5 text-center">Status</th>
                    <th className="px-5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EFEA]">
                  {orders.map((order) => {
                    const isCreditShort =
                      order.credit &&
                      order.total_amount > order.credit.available_credit;

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-[#FBFBFA] transition-colors"
                      >
                        <td className="px-5 py-3">
                          <Link
                            href={`/order-desk/orders/${order.id}`}
                            className="font-mono font-bold text-[#242724] hover:text-[#79565D] hover:underline"
                          >
                            {order.order_number}
                          </Link>
                          <div className="flex items-center gap-1.5 text-[10px] text-[#969892] mt-0.5">
                            <span>{formatDate(order.submitted_at || order.created_at)}</span>
                            <span>•</span>
                            <span className="font-semibold text-[#666864]">
                              {order.source}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5 font-bold text-[#242724]">
                            <Store size={13} className="text-[#79565D] shrink-0" />
                            <span className="truncate max-w-[170px]">
                              {order.shop_name || "Kirana Retailer"}
                            </span>
                          </div>
                          <p className="font-mono text-[10px] text-[#969892] mt-0.5">
                            {order.retailer_code || "Code Pending"}
                            {order.retailer_city && ` • ${order.retailer_city}`}
                          </p>
                        </td>

                        <td className="px-5 py-3 text-center">
                          <span className="font-mono font-bold text-[#242724]">
                            {order.items_count} SKUs
                          </span>
                        </td>

                        <td className="px-5 py-3 text-center">
                          {order.credit ? (
                            isCreditShort ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#8C2828] bg-[#FBF0F0] px-2 py-0.5 rounded-[3px] border border-[#EDBCBC]">
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

                        <td className="px-5 py-3 text-right font-mono font-bold text-[#242724] tabular-nums">
                          {formatCurrency(order.total_amount)}
                        </td>

                        <td className="px-5 py-3 text-center">
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

                        <td className="px-5 py-3 text-right space-x-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            title="Quick Preview"
                            className="p-1 text-[#969892] hover:text-[#242724] hover:bg-[#F0EFEA] rounded-[4px] transition-colors"
                          >
                            <Eye size={14} />
                          </button>
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

            {/* Mobile Card List View */}
            <div className="block md:hidden divide-y divide-[#F0EFEA]">
              {orders.map((order) => {
                const isCreditShort =
                  order.credit &&
                  order.total_amount > order.credit.available_credit;

                return (
                  <div key={order.id} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/order-desk/orders/${order.id}`}
                        className="font-mono font-bold text-xs text-[#242724] hover:text-[#79565D]"
                      >
                        {order.order_number}
                      </Link>
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
                    </div>

                    <div className="flex items-start justify-between text-xs">
                      <div>
                        <p className="font-bold text-[#242724]">
                          {order.shop_name || "Kirana Retailer"}
                        </p>
                        <p className="font-mono text-[10px] text-[#969892]">
                          {order.retailer_code} • {order.items_count} items
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-[#242724] tabular-nums">
                          {formatCurrency(order.total_amount)}
                        </p>
                        <p className="text-[10px] text-[#969892]">
                          {formatDate(order.submitted_at || order.created_at)}
                        </p>
                      </div>
                    </div>

                    {order.credit && isCreditShort && (
                      <div className="rounded-[3px] border border-[#EDBCBC] bg-[#FBF0F0] px-2 py-1 text-[10px] font-semibold text-[#8C2828] flex items-center gap-1">
                        <AlertTriangle size={11} />
                        <span>Credit Limit Exceeded ({formatCurrency(order.credit.available_credit)} avail)</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-[#F0EFEA]">
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="text-[11px] font-semibold text-[#666864] hover:text-[#242724]"
                      >
                        Preview Lines ({order.lines.length})
                      </button>
                      <Link
                        href={`/order-desk/orders/${order.id}`}
                        className="rounded-[4px] bg-[#79565D] px-3 py-1 text-xs font-semibold text-white hover:bg-[#67474E]"
                      >
                        Open Workstation &rarr;
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls Footer */}
            <div className="border-t border-[#E7E6E0] bg-[#FAF9F6] px-5 py-3 flex items-center justify-between text-xs text-[#666864]">
              <span className="tabular-nums">
                Showing{" "}
                <strong className="text-[#242724]">
                  {total > 0 ? offset + 1 : 0}
                </strong>{" "}
                to{" "}
                <strong className="text-[#242724]">
                  {Math.min(offset + PAGE_SIZE, total)}
                </strong>{" "}
                of <strong className="text-[#242724]">{total}</strong> orders
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={offset === 0 || loading}
                  className="rounded-[4px] border border-[#E7E6E0] bg-white p-1 text-[#666864] hover:bg-[#F0EFEA] hover:text-[#242724] disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={offset + PAGE_SIZE >= total || loading}
                  className="rounded-[4px] border border-[#E7E6E0] bg-white p-1 text-[#666864] hover:bg-[#F0EFEA] hover:text-[#242724] disabled:opacity-40 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Slide-over Preview Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-xs">
          <div className="w-full max-w-md h-full bg-white shadow-xl flex flex-col justify-between border-l border-[#E7E6E0]">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-[#E7E6E0] bg-[#FAF9F6] p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-[#242724]">
                      {selectedOrder.order_number}
                    </span>
                    <Badge
                      variant={
                        selectedOrder.status === "APPROVED"
                          ? "success"
                          : selectedOrder.status === "SUBMITTED"
                          ? "warning"
                          : selectedOrder.status === "UNDER_REVIEW"
                          ? "info"
                          : selectedOrder.status === "ON_HOLD"
                          ? "warning"
                          : selectedOrder.status === "REJECTED"
                          ? "danger"
                          : "default"
                      }
                    >
                      {selectedOrder.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-[#666864]">
                    Submitted {formatDate(selectedOrder.submitted_at || selectedOrder.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 text-[#969892] hover:text-[#242724] hover:bg-[#E7E6E0] rounded-[4px]"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Retailer Info */}
              <div className="border-b border-[#E7E6E0] p-4 text-xs bg-[#FCFBF8]">
                <div className="flex items-center gap-2 font-bold text-[#242724]">
                  <Store size={14} className="text-[#79565D]" />
                  <span>{selectedOrder.shop_name || "Kirana Retailer"}</span>
                </div>
                <p className="text-[11px] font-mono text-[#969892] mt-0.5">
                  Code: {selectedOrder.retailer_code || selectedOrder.retailer_id}
                </p>
                {selectedOrder.customer_note && (
                  <p className="mt-2 text-[11px] bg-white p-2 rounded-[4px] border border-[#E7E6E0] text-[#666864]">
                    <strong>Note:</strong> {selectedOrder.customer_note}
                  </p>
                )}
                {selectedOrder.desk_note && (
                  <p className="mt-1.5 text-[11px] bg-[#FCF6EC] p-2 rounded-[4px] border border-[#EED7B3] text-[#7A4E12]">
                    <strong>Desk Note:</strong> {selectedOrder.desk_note}
                  </p>
                )}
              </div>

              {/* Line Items List */}
              <div className="p-4 overflow-y-auto max-h-[50vh] divide-y divide-[#F0EFEA] text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#969892] block mb-2">
                  Line Items ({selectedOrder.lines.length})
                </span>
                {selectedOrder.lines.map((l, idx) => (
                  <div key={idx} className="py-2.5 flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-[#242724] truncate">
                        {l.product_name}
                      </p>
                      <p className="text-[11px] text-[#666864]">
                        {l.quantity} {l.quantity_unit} • SKU: {l.sku}
                        {l.free_quantity > 0 && ` (+${l.free_quantity} free)`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-bold text-[#242724] tabular-nums">
                        {formatCurrency(l.line_total)}
                      </p>
                      <p className="text-[10px] text-[#969892] tabular-nums">
                        @{formatCurrency(l.unit_price)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="border-t border-[#E7E6E0] bg-[#FAF9F6] p-4">
              <div className="flex justify-between items-baseline mb-4 text-xs font-bold">
                <span className="text-[#666864]">Order Subtotal</span>
                <span className="text-base font-mono text-[#242724] tabular-nums">
                  {formatCurrency(selectedOrder.total_amount)}
                </span>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/order-desk/orders/${selectedOrder.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-[4px] bg-[#79565D] py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#67474E] transition-colors"
                >
                  <span>Open Full Workstation</span>
                  <ExternalLink size={13} />
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="rounded-[4px] border border-[#E7E6E0] bg-white px-3 py-2.5 text-xs font-semibold text-[#666864] hover:bg-[#F0EFEA]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdersQueuePage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 max-w-7xl mx-auto">
          <div className="h-8 w-48 rounded bg-[#E7E6E0] animate-pulse mb-4" />
          <div className="h-64 rounded bg-[#E7E6E0] animate-pulse" />
        </div>
      }
    >
      <OrdersQueueContent />
    </Suspense>
  );
}
