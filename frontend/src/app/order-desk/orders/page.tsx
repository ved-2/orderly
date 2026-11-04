"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Filter,
  Inbox,
  RefreshCw,
  Search,
  Store,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  X,
  ExternalLink,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
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

interface PendingOrder {
  id: string;
  order_number: string;
  retailer_id: string;
  shop_name?: string | null;
  retailer_code?: string | null;
  status: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  customer_note?: string | null;
  created_at: string;
  submitted_at: string | null;
  lines: OrderLineItem[];
}

interface PendingOrdersResponse {
  items: PendingOrder[];
  total: number;
  limit: number;
  offset: number;
}

interface UserProfile {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
}

const ALLOWED_ROLES = new Set(["ORDER_DESK", "DISTRIBUTOR_ADMIN"]);
const PAGE_SIZE = 25;

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

export default function PendingOrdersPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Slide-over preview drawer
  const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null);

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
          setError(
            err instanceof Error ? err.message : "Authentication error"
          );
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

  const loadOrders = useCallback(async (currentOffset: number) => {
    try {
      setOrdersLoading(true);
      setError(null);
      const res = await apiRequest<PendingOrdersResponse>(
        `/orders/desk/pending?limit=${PAGE_SIZE}&offset=${currentOffset}`
      );
      setOrders(res.items || []);
      setTotal(res.total || 0);
      setOffset(res.offset || 0);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load pending orders from server."
      );
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile && ALLOWED_ROLES.has(profile.role)) {
      loadOrders(offset);
    }
  }, [profile, offset, loadOrders]);

  const handlePrevPage = () => {
    if (offset > 0) {
      const prev = Math.max(0, offset - PAGE_SIZE);
      setOffset(prev);
    }
  };

  const handleNextPage = () => {
    if (offset + PAGE_SIZE < total) {
      setOffset(offset + PAGE_SIZE);
    }
  };

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(
      (o) =>
        o.order_number.toLowerCase().includes(q) ||
        (o.shop_name && o.shop_name.toLowerCase().includes(q)) ||
        (o.retailer_code && o.retailer_code.toLowerCase().includes(q))
    );
  }, [orders, searchQuery]);

  if (authLoading || profileLoading) {
    return (
      <main className="min-h-screen bg-[#F6F5F1] p-8">
        <div className="mx-auto max-w-7xl">
          <div className="h-8 w-48 animate-pulse rounded bg-[#E7E6E0]" />
          <div className="mt-6 h-96 animate-pulse rounded bg-[#E7E6E0]" />
        </div>
      </main>
    );
  }

  if (!user || !profile || !ALLOWED_ROLES.has(profile.role)) {
    return (
      <main className="min-h-screen bg-[#F6F5F1] flex items-center justify-center p-4">
        <div className="mx-auto max-w-md w-full rounded-[6px] border border-[#E7E6E0] bg-white p-6 text-center shadow-2xs">
          <h1 className="text-base font-bold text-[#242724]">
            Order Desk Authorization Required
          </h1>
          <p className="mt-1 text-xs text-[#666864]">
            Please sign in with a verified Order Desk account.
          </p>
          <Link
            href="/register"
            className="mt-5 inline-block rounded-[4px] bg-[#79565D] px-4 py-2 text-xs font-semibold text-white"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  const startRecord = total === 0 ? 0 : offset + 1;
  const endRecord = Math.min(offset + PAGE_SIZE, total);

  return (
    <main className="min-h-screen bg-[#F6F5F1] text-[#242724]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-[#E7E6E0] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 h-14">
          <div className="flex items-center gap-3">
            <Link
              href="/order-desk"
              className="flex items-center gap-1.5 text-xs font-semibold text-[#666864] hover:text-[#242724] transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Desk Hub</span>
            </Link>
            <span className="text-[#E7E6E0]">/</span>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm text-[#242724]">
                Incoming Orders Queue
              </h1>
              <Badge variant="accent" className="text-[10px]">
                {total} Awaiting
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => loadOrders(offset)}
              disabled={ordersLoading}
              className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#E7E6E0] bg-white px-3 py-1.5 text-xs font-semibold text-[#242724] hover:bg-[#F0EFEA] disabled:opacity-50 transition-colors"
            >
              <RefreshCw
                size={12}
                className={ordersLoading ? "animate-spin" : ""}
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-[4px] border border-[#EDBCBC] bg-[#FBF0F0] p-4 text-xs font-medium text-[#8C2828]"
          >
            {error}
          </div>
        )}

        {/* Search & Stats Bar */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#969892]"
            />
            <input
              type="text"
              placeholder="Search by order #, shop name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-[4px] border border-[#E7E6E0] bg-white pl-9 pr-3 py-1.5 text-xs text-[#242724] placeholder-[#969892] focus:border-[#79565D] focus:outline-none"
            />
          </div>

          <div className="text-xs text-[#666864] flex items-center gap-2">
            <span>
              Showing <strong className="text-[#242724] tabular-nums">{startRecord}–{endRecord}</strong> of <strong className="text-[#242724] tabular-nums">{total}</strong>
            </span>
          </div>
        </div>

        {/* High-density Data Table */}
        <div className="rounded-[6px] border border-[#E7E6E0] bg-white shadow-2xs overflow-hidden">
          {ordersLoading && orders.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#666864]">
              <RefreshCw size={18} className="animate-spin mx-auto text-[#79565D] mb-2" />
              Loading order queue...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF6F1] text-[#205234]">
                <CheckCircle2 size={22} />
              </div>
              <h2 className="mt-3 text-sm font-bold text-[#242724]">
                Queue is clear
              </h2>
              <p className="mt-1 text-xs text-[#666864]">
                {searchQuery
                  ? "No orders match your filter criteria."
                  : "All submitted orders have been processed and dispatched."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#E7E6E0] bg-[#FAF9F6] text-[10px] font-bold uppercase tracking-wider text-[#969892]">
                  <tr>
                    <th className="px-4 py-2.5">Order Number</th>
                    <th className="px-4 py-2.5">Submitted (IST)</th>
                    <th className="px-4 py-2.5">Kirana Retailer</th>
                    <th className="px-4 py-2.5 text-center">Lines & Packs</th>
                    <th className="px-4 py-2.5 text-right">Order Total</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EFEA]">
                  {filteredOrders.map((ord) => {
                    const totalQty = ord.lines.reduce(
                      (acc, l) => acc + l.quantity,
                      0
                    );
                    const freeQty = ord.lines.reduce(
                      (acc, l) => acc + l.free_quantity,
                      0
                    );

                    return (
                      <tr
                        key={ord.id}
                        onClick={() => setSelectedOrder(ord)}
                        className={`cursor-pointer transition-colors hover:bg-[#FBFBFA] ${
                          selectedOrder?.id === ord.id ? "bg-[#F4EFF0]/50" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-mono font-bold text-[#242724]">
                          {ord.order_number}
                        </td>
                        <td className="px-4 py-3 text-[#666864] tabular-nums whitespace-nowrap">
                          {formatDate(ord.submitted_at || ord.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          {ord.shop_name ? (
                            <div>
                              <p className="font-bold text-[#242724]">
                                {ord.shop_name}
                              </p>
                              <p className="font-mono text-[10px] text-[#969892]">
                                {ord.retailer_code || ord.retailer_id.slice(0, 8)}
                              </p>
                            </div>
                          ) : (
                            <span className="font-mono text-[#666864]">
                              {ord.retailer_id.slice(0, 8)}...
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className="font-semibold text-[#242724]">
                            {ord.lines.length} lines
                          </span>
                          <span className="text-[#969892]"> ({totalQty} units)</span>
                          {freeQty > 0 && (
                            <Badge variant="success" className="ml-1.5 text-[9px] py-0 px-1">
                              +{freeQty} free
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[#242724] tabular-nums whitespace-nowrap">
                          {formatCurrency(ord.total_amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="warning">
                            {ord.status}
                          </Badge>
                        </td>
                        <td
                          className="px-4 py-3 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            href={`/order-desk/orders/${ord.id}`}
                            className="inline-flex items-center gap-1 rounded-[4px] bg-[#79565D] px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-[#67474E] transition-colors"
                          >
                            <span>Verify & Process</span>
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

          {/* Pagination Footer */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-[#E7E6E0] bg-[#FAF9F6] px-4 py-3 text-xs">
              <span className="text-[#666864]">
                Page {Math.floor(offset / PAGE_SIZE) + 1} of{" "}
                {Math.ceil(total / PAGE_SIZE)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={offset === 0 || ordersLoading}
                  className="inline-flex items-center gap-1 rounded-[4px] border border-[#E7E6E0] bg-white px-2.5 py-1 text-xs font-semibold text-[#242724] hover:bg-[#F0EFEA] disabled:opacity-40"
                >
                  <ChevronLeft size={13} />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={offset + PAGE_SIZE >= total || ordersLoading}
                  className="inline-flex items-center gap-1 rounded-[4px] border border-[#E7E6E0] bg-white px-2.5 py-1 text-xs font-semibold text-[#242724] hover:bg-[#F0EFEA] disabled:opacity-40"
                >
                  <span>Next</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Slide-over Order Quick Preview Drawer */}
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
                    <Badge variant="warning">{selectedOrder.status}</Badge>
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
                        {l.quantity} {l.quantity_unit} · SKU: {l.sku}
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
    </main>
  );
}
