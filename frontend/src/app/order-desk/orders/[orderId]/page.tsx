"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";

interface OrderData {
  id: string;
  order_number: string;
  retailer_id: string;
  status: string;
  source: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  customer_note?: string | null;
  desk_note?: string | null;
  created_at: string;
  submitted_at?: string | null;
  approved_at?: string | null;
  dispatched_at?: string | null;
}

interface RetailerData {
  id: string;
  retailer_code: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  registration_status: string;
  is_active: boolean;
}

interface CreditData {
  credit_limit: number;
  current_outstanding: number;
  available_credit: number;
  payment_terms_days: number;
}

interface OrderItemData {
  id: string;
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

interface OrderHistoryData {
  id: string;
  previous_status: string | null;
  new_status: string;
  note: string | null;
  created_at: string;
}

interface OrderDetailResponse {
  order: OrderData;
  retailer: RetailerData | null;
  credit: CreditData | null;
  items: OrderItemData[];
  history: OrderHistoryData[];
}

interface UserProfile {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
}

const ALLOWED_ROLES = new Set(["ORDER_DESK", "DISTRIBUTOR_ADMIN"]);

export default function OrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [data, setData] = useState<OrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveNote, setApproveNote] = useState("");

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // 1. Authenticate user and verify staff role
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setProfileLoading(false);
      return;
    }

    let isMounted = true;
    async function fetchProfile() {
      try {
        const userProfile = await apiRequest<UserProfile>("/auth/me");
        if (isMounted) setProfile(userProfile);
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

  // 2. Fetch complete order detail
  const loadOrder = useCallback(async () => {
    if (!params?.orderId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<OrderDetailResponse>(
        `/orders/desk/${params.orderId}`
      );
      setData(res);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load order from server."
      );
    } finally {
      setLoading(false);
    }
  }, [params?.orderId]);

  useEffect(() => {
    if (profile && ALLOWED_ROLES.has(profile.role)) {
      loadOrder();
    }
  }, [profile, loadOrder]);

  // 3. Action: Start Review
  const handleStartReview = async () => {
    if (!params?.orderId) return;
    setActionBusy(true);
    setActionMessage(null);
    setActionError(null);
    try {
      await apiRequest(`/orders/desk/${params.orderId}/start-review`, {
        method: "POST",
      });
      setActionMessage("Order status updated to UNDER REVIEW.");
      await loadOrder();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to start review."
      );
    } finally {
      setActionBusy(false);
    }
  };

  // 4. Action: Approve Order
  const handleApproveOrder = async () => {
    if (!params?.orderId) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await apiRequest<{ message: string; warehouse_name?: string }>(
        `/orders/desk/${params.orderId}/approve`,
        {
          method: "POST",
          body: JSON.stringify({
            desk_note: approveNote.trim() || null,
          }),
        }
      );
      setActionMessage(res.message || "Order approved successfully. Stock reserved.");
      setShowApproveModal(false);
      setApproveNote("");
      await loadOrder();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Approval failed."
      );
    } finally {
      setActionBusy(false);
    }
  };

  // 5. Action: Reject Order
  const handleRejectOrder = async () => {
    if (!params?.orderId) return;
    if (rejectReason.trim().length < 3) {
      setActionError("Please provide a rejection reason (minimum 3 characters).");
      return;
    }
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await apiRequest<{ message: string }>(
        `/orders/desk/${params.orderId}/reject`,
        {
          method: "POST",
          body: JSON.stringify({
            reason: rejectReason.trim(),
          }),
        }
      );
      setActionMessage(res.message || "Order has been rejected.");
      setShowRejectModal(false);
      setRejectReason("");
      await loadOrder();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Rejection failed."
      );
    } finally {
      setActionBusy(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  const formatDate = (isoString?: string | null) => {
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

  if (authLoading || profileLoading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm text-gray-500">Authenticating staff session...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-md border border-gray-200 bg-white p-6">
          <h1 className="text-lg font-semibold text-gray-950">
            Sign In Required
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Please sign in to access this order.
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

  if (!profile || !ALLOWED_ROLES.has(profile.role)) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-md border border-amber-200 bg-white p-6">
          <h1 className="text-lg font-semibold text-gray-950">
            Access Restricted
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Only Order Desk staff and Administrators can review orders.
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

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm text-gray-500">Loading order review details...</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-xl border border-red-200 bg-white p-6">
          <h1 className="text-lg font-semibold text-red-950">
            Order Not Found
          </h1>
          <p className="mt-2 text-sm text-red-700">
            {error || "Could not retrieve the requested order."}
          </p>
          <div className="mt-6">
            <Link
              href="/order-desk/orders"
              className="inline-block border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              &larr; Return to Pending Queue
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { order, retailer, credit, items, history } = data;
  const isCreditShort =
    credit && credit.available_credit < order.total_amount;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/order-desk/orders"
              className="text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-900"
            >
              &larr; Pending Queue
            </Link>
            <span className="text-gray-300">/</span>
            <span className="font-mono text-sm font-semibold text-gray-950">
              {order.order_number}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                order.status === "SUBMITTED"
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : order.status === "UNDER_REVIEW"
                  ? "border-blue-300 bg-blue-50 text-blue-800"
                  : order.status === "APPROVED"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : order.status === "REJECTED"
                  ? "border-red-300 bg-red-50 text-red-800"
                  : "border-gray-300 bg-gray-50 text-gray-800"
              }`}
            >
              {order.status.replace("_", " ")}
            </span>

            {(order.status === "SUBMITTED" || order.status === "UNDER_REVIEW") && (
              <div className="flex items-center gap-2">
                {order.status === "SUBMITTED" && (
                  <button
                    type="button"
                    onClick={handleStartReview}
                    disabled={actionBusy}
                    className="border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Start Review
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setShowRejectModal(true);
                  }}
                  disabled={actionBusy}
                  className="border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Reject Order
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setShowApproveModal(true);
                  }}
                  disabled={actionBusy}
                  className="border border-emerald-700 bg-emerald-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  Approve Order
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {actionMessage && (
        <div className="border-b border-emerald-200 bg-emerald-50 px-6 py-3 text-center text-xs font-medium text-emerald-900">
          {actionMessage}
        </div>
      )}
      {actionError && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-center text-xs font-medium text-red-900">
          {actionError}
        </div>
      )}

      {/* Main Review Workspace */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main 2-Column Section: Items, Totals & Timeline */}
          <div className="space-y-6 lg:col-span-2">
            {/* Ordered Items Table */}
            <div className="border border-gray-200 bg-white">
              <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-950">
                    Order Items ({items.length})
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Source: {order.source} | Placed on {formatDate(order.created_at)}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="px-6 py-3">Product / SKU</th>
                      <th className="px-6 py-3 text-center">Ordered</th>
                      <th className="px-6 py-3 text-center">Free Scheme</th>
                      <th className="px-6 py-3 text-right">Unit Price</th>
                      <th className="px-6 py-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-950">
                            {item.product_name}
                          </p>
                          <p className="font-mono text-xs text-gray-500">
                            SKU: {item.sku}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center font-mono text-sm text-gray-900">
                          {item.quantity} {item.quantity_unit}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {item.free_quantity > 0 ? (
                            <span className="border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                              +{item.free_quantity} {item.quantity_unit} free
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-sm text-gray-700">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-medium text-gray-950">
                          {formatCurrency(item.line_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary */}
              <div className="border-t border-gray-200 bg-gray-50/50 px-6 py-4">
                <div className="ml-auto max-w-xs space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatCurrency(order.subtotal)}</span>
                  </div>
                  {order.discount_amount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Scheme Discount</span>
                      <span className="font-mono">-{formatCurrency(order.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>Tax (GST)</span>
                    <span className="font-mono">{formatCurrency(order.tax_amount)}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-2 flex justify-between text-base font-semibold text-gray-950">
                    <span>Grand Total</span>
                    <span className="font-mono">{formatCurrency(order.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Desk Note / Rejection Reason (if present) */}
            {order.desk_note && (
              <div
                className={`border p-5 ${
                  order.status === "REJECTED"
                    ? "border-red-200 bg-red-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <h3
                  className={`text-xs font-semibold uppercase tracking-wider ${
                    order.status === "REJECTED"
                      ? "text-red-800"
                      : "text-gray-700"
                  }`}
                >
                  {order.status === "REJECTED"
                    ? "Order Rejection Reason"
                    : "Order Desk Note"}
                </h3>
                <p
                  className={`mt-2 text-sm ${
                    order.status === "REJECTED"
                      ? "text-red-900 font-medium"
                      : "text-gray-800"
                  }`}
                >
                  {order.desk_note}
                </p>
              </div>
            )}

            {/* Customer Note (if present) */}
            {order.customer_note && (
              <div className="border border-gray-200 bg-white p-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Retailer Delivery Instructions
                </h3>
                <p className="mt-2 text-sm text-gray-800 italic">
                  &ldquo;{order.customer_note}&rdquo;
                </p>
              </div>
            )}

            {/* Status History Audit Trail */}
            <div className="border border-gray-200 bg-white p-6">
              <h3 className="text-base font-semibold text-gray-950">
                Order Audit Trail
              </h3>
              <p className="mt-0.5 text-xs text-gray-500">
                Immutable record of status transitions and operator actions.
              </p>

              <div className="mt-6 flow-root">
                <ul className="-mb-8">
                  {history.map((h, idx) => (
                    <li key={h.id}>
                      <div className="relative pb-8">
                        {idx !== history.length - 1 && (
                          <span
                            className="absolute left-3 top-3 -ml-px h-full w-0.5 bg-gray-200"
                            aria-hidden="true"
                          />
                        )}
                        <div className="relative flex items-start space-x-3">
                          <div className="flex h-6 w-6 items-center justify-center border border-gray-300 bg-white text-xs font-medium text-gray-700">
                            {idx + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between text-xs">
                              <p className="font-semibold text-gray-900">
                                {h.new_status.replace("_", " ")}
                                {h.previous_status && (
                                  <span className="font-normal text-gray-500">
                                    {" "}
                                    (from {h.previous_status.replace("_", " ")})
                                  </span>
                                )}
                              </p>
                              <span className="text-gray-500">
                                {formatDate(h.created_at)}
                              </span>
                            </div>
                            {h.note && (
                              <p className="mt-1 text-xs text-gray-600">
                                {h.note}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Right 1-Column Section: Retailer & Credit Info */}
          <div className="space-y-6">
            {/* Retailer Info Card */}
            <div className="border border-gray-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-950">
                  Retailer Profile
                </h3>
                {retailer && (
                  <span className="border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700">
                    {retailer.registration_status}
                  </span>
                )}
              </div>

              {retailer ? (
                <div className="mt-4 space-y-3 text-sm">
                  <div>
                    <p className="font-semibold text-gray-950">
                      {retailer.shop_name}
                    </p>
                    <p className="font-mono text-xs text-gray-500">
                      Code: {retailer.retailer_code}
                    </p>
                  </div>

                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-xs text-gray-500">Proprietor</p>
                    <p className="font-medium text-gray-900">
                      {retailer.owner_name}
                    </p>
                    <p className="text-xs text-gray-600">{retailer.phone}</p>
                  </div>

                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-xs text-gray-500">Delivery Address</p>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {retailer.address}, {retailer.city}, {retailer.state} -{" "}
                      {retailer.pincode}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-xs text-gray-500">
                  Retailer details not available.
                </p>
              )}
            </div>

            {/* Credit Account Health */}
            <div className="border border-gray-200 bg-white p-6">
              <h3 className="text-base font-semibold text-gray-950">
                Credit Status
              </h3>
              <p className="mt-0.5 text-xs text-gray-500">
                Kirana credit limit & outstanding balance.
              </p>

              {credit ? (
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 text-xs">Credit Limit</span>
                    <span className="font-mono font-medium text-gray-900">
                      {formatCurrency(credit.credit_limit)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-500 text-xs">Current Outstanding</span>
                    <span className="font-mono font-medium text-gray-900">
                      {formatCurrency(credit.current_outstanding)}
                    </span>
                  </div>

                  <div className="flex justify-between border-t border-gray-100 pt-2">
                    <span className="text-gray-500 text-xs">Available Credit</span>
                    <span
                      className={`font-mono font-semibold ${
                        isCreditShort ? "text-amber-700" : "text-emerald-700"
                      }`}
                    >
                      {formatCurrency(credit.available_credit)}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Payment Window</span>
                    <span>{credit.payment_terms_days} days</span>
                  </div>

                  {isCreditShort && (
                    <div className="mt-3 border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                      Notice: Available credit ({formatCurrency(credit.available_credit)}) is lower than order value ({formatCurrency(order.total_amount)}).
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-xs text-gray-500">
                  No active credit account on record.
                </p>
              )}
            </div>

            {/* Operational Policy Reminder */}
            <div className="border border-gray-200 bg-gray-50 p-5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                Approval Checklist
              </h4>
              <ul className="mt-3 space-y-2 text-xs text-gray-600 list-disc list-inside">
                <li>Verify product stock across active warehouses.</li>
                <li>Ensure free scheme quantities match active rules.</li>
                <li>Check retailer credit exposure prior to approval.</li>
                <li>Stock is committed only upon approval.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      {/* Modal: Confirm Order Approval */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4">
          <div className="w-full max-w-lg border border-gray-300 bg-white p-6 shadow-md">
            <h3 className="text-lg font-semibold text-gray-950">
              Confirm Order Approval
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Order {order.order_number} for {retailer?.shop_name || "Retailer"}.
            </p>

            <div className="mt-4 border-t border-b border-gray-100 py-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Order Grand Total:</span>
                <span className="font-mono font-medium text-gray-950">
                  {formatCurrency(order.total_amount)}
                </span>
              </div>
              {credit && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Kirana Available Credit:</span>
                  <span className="font-mono font-medium text-gray-950">
                    {formatCurrency(credit.available_credit)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Line Items to Reserve:</span>
                <span className="font-medium text-gray-950">
                  {items.length} SKUs ({items.reduce((acc, i) => acc + i.quantity + i.free_quantity, 0)} units)
                </span>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-700">
                Staff Note (Optional)
              </label>
              <input
                type="text"
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder="e.g. Verified stock for dispatch"
                className="mt-1 w-full border border-gray-300 px-3 py-2 text-xs text-gray-900 outline-none focus:border-gray-900"
              />
            </div>

            <div className="mt-3 bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              Approving will immediately commit inventory reservations and debit the retailer&apos;s credit balance.
            </div>

            {actionError && (
              <p className="mt-3 text-xs font-medium text-red-600">
                {actionError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowApproveModal(false);
                  setActionError(null);
                }}
                disabled={actionBusy}
                className="border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveOrder}
                disabled={actionBusy}
                className="bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {actionBusy ? "Approving..." : "Confirm & Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Order Rejection */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4">
          <div className="w-full max-w-lg border border-red-200 bg-white p-6 shadow-md">
            <h3 className="text-lg font-semibold text-gray-950">
              Reject Order
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Order {order.order_number} will be marked as REJECTED.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-700">
                Reason for Rejection (Mandatory)
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="State the reason (e.g. Insufficient stock, retailer account suspended, price mismatch)"
                className="mt-1 w-full border border-gray-300 p-2.5 text-xs text-gray-900 outline-none focus:border-gray-900"
              />
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                "Insufficient warehouse stock",
                "Retailer credit limit exceeded",
                "Shop account unverified",
                "Discontinued SKU ordered",
              ].map((quickReason) => (
                <button
                  key={quickReason}
                  type="button"
                  onClick={() => setRejectReason(quickReason)}
                  className="border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-100"
                >
                  {quickReason}
                </button>
              ))}
            </div>

            {actionError && (
              <p className="mt-3 text-xs font-medium text-red-600">
                {actionError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setActionError(null);
                }}
                disabled={actionBusy}
                className="border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectOrder}
                disabled={actionBusy || rejectReason.trim().length < 3}
                className="bg-red-700 px-4 py-2 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-40"
              >
                {actionBusy ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
