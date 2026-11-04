"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";

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
const PAGE_SIZE = 20;

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

  // 1. Authenticate and verify role
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

  // 2. Load pending orders
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

  const formatDate = (isoString: string | null) => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Auth loading state
  if (authLoading || profileLoading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm text-gray-500">Authenticating staff session...</p>
        </div>
      </main>
    );
  }

  // Unauthenticated
  if (!user) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-md border border-gray-200 bg-white p-6">
          <h1 className="text-lg font-semibold text-gray-950">
            Sign In Required
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Please sign in to access the pending orders queue.
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

  // Unauthorized role
  if (!profile || !ALLOWED_ROLES.has(profile.role)) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-md border border-amber-200 bg-white p-6">
          <h1 className="text-lg font-semibold text-gray-950">
            Access Restricted
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            You do not have permission to view the Order Desk queue.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => logout()}
              className="bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  }

  const startRecord = total === 0 ? 0 : offset + 1;
  const endRecord = Math.min(offset + PAGE_SIZE, total);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/order-desk"
              className="text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-900"
            >
              &larr; Order Desk
            </Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-semibold text-gray-950">
              Pending Orders Queue
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => loadOrders(offset)}
              disabled={ordersLoading}
              className="border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {ordersLoading ? "Refreshing..." : "Refresh Queue"}
            </button>
            <span className="border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700">
              {total} Pending
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {error && (
          <div className="mb-6 border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">
              Error loading orders: {error}
            </p>
          </div>
        )}

        <div className="border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-950">
                Submitted Orders Awaiting Review
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Sorted by submission timestamp (oldest first).
              </p>
            </div>
            <div className="text-xs text-gray-500">
              Showing {startRecord} - {endRecord} of {total}
            </div>
          </div>

          {ordersLoading && orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Loading pending orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-medium text-gray-900">
                Queue is clear
              </p>
              <p className="mt-1 text-xs text-gray-500">
                There are currently no submitted orders awaiting review.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Order Number</th>
                    <th className="px-6 py-3">Submitted At</th>
                    <th className="px-6 py-3">Retailer Reference</th>
                    <th className="px-6 py-3 text-center">Items</th>
                    <th className="px-6 py-3 text-right">Order Total</th>
                    <th className="px-6 py-3 text-center">Status</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((ord) => {
                    const totalQty = ord.lines.reduce(
                      (acc, line) => acc + line.quantity,
                      0
                    );
                    const freeQty = ord.lines.reduce(
                      (acc, line) => acc + line.free_quantity,
                      0
                    );

                    return (
                      <tr
                        key={ord.id}
                        className="transition-colors hover:bg-gray-50/75"
                      >
                        <td className="px-6 py-4 font-mono font-medium text-gray-950">
                          {ord.order_number}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-600">
                          {formatDate(ord.submitted_at || ord.created_at)}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-700">
                          {ord.shop_name ? (
                            <div>
                              <p className="font-medium text-gray-900">
                                {ord.shop_name}
                              </p>
                              <p className="text-gray-500">
                                {ord.retailer_code || ord.retailer_id.slice(0, 8)}
                              </p>
                            </div>
                          ) : (
                            <span className="font-mono text-gray-600">
                              {ord.retailer_id.slice(0, 8)}...
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center text-xs text-gray-700">
                          <span>
                            {ord.lines.length} lines ({totalQty} units)
                          </span>
                          {freeQty > 0 && (
                            <span className="ml-1.5 text-green-700 font-medium">
                              +{freeQty} free
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-medium text-gray-950">
                          {formatCurrency(ord.total_amount)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-block border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            {ord.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/order-desk/orders/${ord.id}`}
                            className="inline-block border border-gray-900 bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                          >
                            Review &rarr;
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
            <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Showing {startRecord} - {endRecord} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={offset === 0 || ordersLoading}
                  className="border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={offset + PAGE_SIZE >= total || ordersLoading}
                  className="border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
