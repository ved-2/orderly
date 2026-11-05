"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  Store,
  Wallet,
  ShieldCheck,
  Package,
  FileText,
  User,
  Truck,
  Pencil,
  Trash2,
  Plus,
  Save,
  X,
  Search,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

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
  units_per_case?: number;
  case_price?: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
  stock_on_hand?: number;
  stock_reserved?: number;
  available_stock?: number;
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
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

function OrderDetailContent() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

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

  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdReason, setHoldReason] = useState("");

  // Line item editing state
  const [isEditingLines, setIsEditingLines] = useState(false);
  const [draftLines, setDraftLines] = useState<
    {
      product_id: string;
      product_name: string;
      sku: string;
      quantity: number;
      quantity_unit: "CASE" | "PIECE";
      unit_price: number;
      available_stock?: number;
      units_per_case?: number;
    }[]
  >([]);

  // Add Product picker state
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [availableProducts, setAvailableProducts] = useState<
    {
      id: string;
      sku: string;
      name: string;
      units_per_case: number;
      price: number;
      stock_on_hand: number;
    }[]
  >([]);
  const [searchingProducts, setSearchingProducts] = useState(false);

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
        const p = await apiRequest<UserProfile>("/auth/me");
        if (isMounted) setProfile(p);
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

  // 2. Load order details
  const loadOrderDetail = useCallback(async () => {
    if (!params.orderId) return;
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
          : "Failed to load order review data from server."
      );
    } finally {
      setLoading(false);
    }
  }, [params.orderId]);

  useEffect(() => {
    if (profile && ALLOWED_ROLES.has(profile.role)) {
      loadOrderDetail();
    }
  }, [profile, loadOrderDetail]);

  // Actions
  const handleStartReview = async () => {
    if (!data?.order) return;
    try {
      setActionBusy(true);
      setActionError(null);
      await apiRequest(`/orders/desk/${data.order.id}/start-review`, {
        method: "POST",
      });
      setActionMessage("Order status updated to UNDER_REVIEW");
      await loadOrderDetail();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to start review."
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleApproveOrder = async () => {
    if (!data?.order) return;
    try {
      setActionBusy(true);
      setActionError(null);
      await apiRequest(`/orders/desk/${data.order.id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          desk_note: approveNote.trim() || undefined,
        }),
      });
      setShowApproveModal(false);
      setActionMessage("Order successfully APPROVED and stock committed.");
      await loadOrderDetail();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Approval failed."
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleRejectOrder = async () => {
    if (!data?.order) return;
    try {
      setActionBusy(true);
      setActionError(null);
      await apiRequest(`/orders/desk/${data.order.id}/reject`, {
        method: "POST",
        body: JSON.stringify({
          reason: rejectReason.trim(),
        }),
      });
      setShowRejectModal(false);
      setActionMessage("Order marked as REJECTED.");
      await loadOrderDetail();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Rejection failed."
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleHoldOrder = async () => {
    if (!data?.order) return;
    try {
      setActionBusy(true);
      setActionError(null);
      await apiRequest(`/orders/desk/${data.order.id}/hold`, {
        method: "POST",
        body: JSON.stringify({
          reason: holdReason.trim(),
        }),
      });
      setShowHoldModal(false);
      setActionMessage("Order placed on hold.");
      await loadOrderDetail();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to place on hold."
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleReleaseHold = async () => {
    if (!data?.order) return;
    try {
      setActionBusy(true);
      setActionError(null);
      await apiRequest(`/orders/desk/${data.order.id}/release-hold`, {
        method: "POST",
      });
      setActionMessage("Order released from hold and is now under review.");
      await loadOrderDetail();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to release hold."
      );
    } finally {
      setActionBusy(false);
    }
  };

  // Line item editing handlers
  const handleEnterEditMode = () => {
    if (!data?.items) return;
    setDraftLines(
      data.items.map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        sku: i.sku,
        quantity: i.quantity,
        quantity_unit: i.quantity_unit as "CASE" | "PIECE",
        unit_price: i.unit_price,
        available_stock: i.available_stock,
        units_per_case: i.units_per_case,
      }))
    );
    setIsEditingLines(true);
    setActionError(null);
  };

  const handleUpdateDraftQuantity = (idx: number, qty: number) => {
    setDraftLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, quantity: qty } : l))
    );
  };

  const handleUpdateDraftUnit = (idx: number, unit: "CASE" | "PIECE") => {
    setDraftLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, quantity_unit: unit } : l))
    );
  };

  const handleRemoveDraftLine = (idx: number) => {
    setDraftLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveLineChanges = async () => {
    if (!data?.order) return;
    if (draftLines.length === 0) {
      setActionError("An order must contain at least one line item.");
      return;
    }
    for (const l of draftLines) {
      if (l.quantity <= 0 || isNaN(l.quantity)) {
        setActionError(`Quantity for "${l.product_name}" must be greater than zero.`);
        return;
      }
    }

    try {
      setActionBusy(true);
      setActionError(null);
      const res = await apiRequest<OrderDetailResponse>(
        `/orders/desk/${data.order.id}/items`,
        {
          method: "PATCH",
          body: JSON.stringify({
            items: draftLines.map((l) => ({
              product_id: l.product_id,
              quantity: l.quantity,
              quantity_unit: l.quantity_unit,
            })),
          }),
        }
      );
      setData(res);
      setIsEditingLines(false);
      setActionMessage("Line items successfully recalculated and saved.");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to save line item changes."
      );
    } finally {
      setActionBusy(false);
    }
  };

  const searchCatalogueProducts = useCallback(async (query: string) => {
    try {
      setSearchingProducts(true);
      const res = await apiRequest<{ items: any[] }>(
        `/distributor/products?status=ACTIVE&search=${encodeURIComponent(query)}`
      );
      setAvailableProducts(
        (res.items || []).map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          units_per_case: p.units_per_case,
          price: p.price,
          stock_on_hand: p.stock_on_hand || 0,
        }))
      );
    } catch {
      // Non-blocking
    } finally {
      setSearchingProducts(false);
    }
  }, []);

  const handleAddProductToDraft = (prod: any) => {
    const exists = draftLines.find((l) => l.product_id === prod.id);
    if (exists) {
      setDraftLines((prev) =>
        prev.map((l) =>
          l.product_id === prod.id ? { ...l, quantity: l.quantity + 1 } : l
        )
      );
    } else {
      setDraftLines((prev) => [
        ...prev,
        {
          product_id: prod.id,
          product_name: prod.name,
          sku: prod.sku,
          quantity: 1,
          quantity_unit: "CASE",
          unit_price: prod.price,
          available_stock: prod.stock_on_hand,
          units_per_case: prod.units_per_case,
        },
      ]);
    }
    setShowAddProductModal(false);
  };

  if (authLoading || profileLoading || loading) {
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
          <Link
            href="/register"
            className="mt-4 inline-block rounded-[4px] bg-[#79565D] px-4 py-2 text-xs font-semibold text-white"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-[#F6F5F1] flex items-center justify-center p-4">
        <div className="mx-auto max-w-md w-full rounded-[6px] border border-[#EDBCBC] bg-[#FBF0F0] p-6 text-center">
          <h1 className="text-sm font-bold text-[#8C2828]">Order Not Found</h1>
          <p className="mt-1 text-xs text-[#8C2828] opacity-80">{error}</p>
          <Link
            href="/order-desk/orders"
            className="mt-4 inline-block rounded-[4px] bg-[#8C2828] px-4 py-2 text-xs font-semibold text-white"
          >
            Return to Queue
          </Link>
        </div>
      </main>
    );
  }

  const { order, retailer, credit, items, history } = data;
  const isCreditShort = credit && credit.available_credit < order.total_amount;

  return (
    <main className="min-h-screen bg-[#F6F5F1] text-[#242724]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-[#E7E6E0] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 h-14">
          <div className="flex items-center gap-3">
            <Link
              href="/order-desk/orders"
              className="flex items-center gap-1.5 text-xs font-semibold text-[#666864] hover:text-[#242724] transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Pending Queue</span>
            </Link>
            <span className="text-[#E7E6E0]">/</span>
            <span className="font-mono text-sm font-bold text-[#242724]">
              {order.order_number}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
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

            {(order.status === "SUBMITTED" || order.status === "UNDER_REVIEW" || order.status === "ON_HOLD") && (
              <div className="flex items-center gap-2 ml-2">
                {order.status === "SUBMITTED" && (
                  <button
                    type="button"
                    onClick={handleStartReview}
                    disabled={actionBusy}
                    className="rounded-[4px] border border-[#E7E6E0] bg-white px-3 py-1.5 text-xs font-semibold text-[#242724] hover:bg-[#F0EFEA] transition-colors"
                  >
                    Start Review
                  </button>
                )}
                {order.status === "ON_HOLD" ? (
                  <button
                    type="button"
                    onClick={handleReleaseHold}
                    disabled={actionBusy}
                    className="rounded-[4px] border border-[#EED7B3] bg-[#FCF6EC] px-3 py-1.5 text-xs font-bold text-[#7A4E12] hover:bg-[#F9EED9] transition-colors"
                  >
                    Release Hold
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setShowHoldModal(true);
                    }}
                    disabled={actionBusy}
                    className="rounded-[4px] border border-[#EED7B3] bg-white px-3 py-1.5 text-xs font-semibold text-[#7A4E12] hover:bg-[#FCF6EC] transition-colors"
                  >
                    Hold
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setShowRejectModal(true);
                  }}
                  disabled={actionBusy}
                  className="rounded-[4px] border border-[#EDBCBC] bg-white px-3 py-1.5 text-xs font-semibold text-[#8C2828] hover:bg-[#FBF0F0] transition-colors"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setShowApproveModal(true);
                  }}
                  disabled={actionBusy}
                  className="rounded-[4px] bg-[#205234] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#183F28] transition-colors shadow-2xs"
                >
                  Approve Order
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Notifications */}
      {actionMessage && (
        <div className="border-b border-[#C3DEC9] bg-[#EEF6F1] px-6 py-2.5 text-center text-xs font-semibold text-[#205234]">
          {actionMessage}
        </div>
      )}
      {actionError && (
        <div className="border-b border-[#EDBCBC] bg-[#FBF0F0] px-6 py-2.5 text-center text-xs font-semibold text-[#8C2828]">
          {actionError}
        </div>
      )}
      {order.desk_note && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-4">
          <div className="rounded-[4px] border border-[#EED7B3] bg-[#FCF6EC] p-3 text-xs text-[#7A4E12] flex items-start gap-2">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">Desk Note / Reason:</strong> {order.desk_note}
            </div>
          </div>
        </div>
      )}

      {/* Main Review Workspace */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main 2-Column: Ordered Lines Table & Timeline */}
          <div className="space-y-6 lg:col-span-2">
            {/* Ordered Items Table */}
            <div className="rounded-[6px] border border-[#E7E6E0] bg-white shadow-2xs overflow-hidden">
              {isEditingLines ? (
                <div className="border-b border-[#E7E6E0] bg-[#FCF6EC] px-4 sm:px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Pencil size={15} className="text-[#7A4E12]" />
                    <div>
                      <h2 className="text-sm font-bold text-[#7A4E12]">
                        Editing Order Line Items ({draftLines.length})
                      </h2>
                      <p className="text-[11px] text-[#666864]">
                        Adjust quantities, toggle units, or add/remove products. Pricing & schemes will be recalculated.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingLines(false);
                        setActionError(null);
                      }}
                      disabled={actionBusy}
                      className="rounded-[4px] border border-[#E7E6E0] bg-white px-2.5 py-1 text-xs font-semibold text-[#666864] hover:bg-[#F0EFEA]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveLineChanges}
                      disabled={actionBusy}
                      className="inline-flex items-center gap-1 rounded-[4px] bg-[#79565D] px-3.5 py-1 text-xs font-bold text-white hover:bg-[#67474E] shadow-2xs disabled:opacity-50 transition-colors"
                    >
                      <Save size={12} />
                      <span>{actionBusy ? "Recalculating..." : "Save Changes"}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-b border-[#E7E6E0] bg-[#FAF9F6] px-4 sm:px-6 py-3.5 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-[#242724]">
                      Order Items Breakdown ({items.length})
                    </h2>
                    <p className="mt-0.5 text-[11px] text-[#666864]">
                      Source: <strong className="text-[#242724]">{order.source}</strong> · Placed {formatDate(order.created_at)}
                    </p>
                  </div>
                  {(order.status === "SUBMITTED" || order.status === "UNDER_REVIEW") && (
                    <button
                      type="button"
                      onClick={handleEnterEditMode}
                      className="inline-flex items-center gap-1 rounded-[4px] border border-[#E7E6E0] bg-white px-2.5 py-1 text-xs font-semibold text-[#242724] hover:border-[#79565D] hover:text-[#79565D] transition-colors"
                    >
                      <Pencil size={12} />
                      <span>Edit Line Items</span>
                    </button>
                  )}
                </div>
              )}

              {isEditingLines ? (
                /* Editable Lines Table */
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#E7E6E0] bg-[#FAF9F6] text-[10px] font-bold uppercase tracking-wider text-[#969892]">
                      <tr>
                        <th className="px-4 py-2.5">Product / SKU</th>
                        <th className="px-4 py-2.5 text-center w-28">Quantity</th>
                        <th className="px-4 py-2.5 text-center w-28">Unit</th>
                        <th className="px-4 py-2.5 text-center">Depot Stock</th>
                        <th className="px-4 py-2.5 text-right w-16">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0EFEA]">
                      {draftLines.map((line, idx) => (
                        <tr key={`${line.product_id}-${idx}`} className="hover:bg-[#FBFBFA]">
                          <td className="px-4 py-3">
                            <p className="font-bold text-[#242724]">{line.product_name}</p>
                            <p className="font-mono text-[11px] text-[#969892]">SKU: {line.sku}</p>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={line.quantity}
                              onChange={(e) =>
                                handleUpdateDraftQuantity(idx, parseFloat(e.target.value) || 0)
                              }
                              className="w-20 text-center rounded-[3px] border border-[#E7E6E0] py-1 text-xs font-mono font-bold text-[#242724] focus:border-[#79565D] focus:outline-none tabular-nums"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="inline-flex rounded-[3px] border border-[#E7E6E0] p-0.5 bg-[#FAF9F6]">
                              <button
                                type="button"
                                onClick={() => handleUpdateDraftUnit(idx, "CASE")}
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-[2px] transition-colors ${
                                  line.quantity_unit === "CASE"
                                    ? "bg-[#242724] text-white"
                                    : "text-[#666864] hover:text-[#242724]"
                                }`}
                              >
                                CASE
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateDraftUnit(idx, "PIECE")}
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-[2px] transition-colors ${
                                  line.quantity_unit === "PIECE"
                                    ? "bg-[#242724] text-white"
                                    : "text-[#666864] hover:text-[#242724]"
                                }`}
                              >
                                PIECE
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {line.available_stock !== undefined ? (
                              <Badge
                                variant={
                                  line.available_stock >= line.quantity ? "success" : "danger"
                                }
                              >
                                {line.available_stock} {line.quantity_unit}s avail
                              </Badge>
                            ) : (
                              <span className="text-[#969892]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveDraftLine(idx)}
                              title="Remove item"
                              className="p-1 text-[#969892] hover:text-[#8C2828] hover:bg-[#FBF0F0] rounded-[3px] transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Add Product Line Button */}
                  <div className="p-3 border-t border-[#E7E6E0] bg-[#FAF9F6] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddProductModal(true);
                        searchCatalogueProducts("");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#E7E6E0] bg-white px-3 py-1.5 text-xs font-semibold text-[#242724] hover:border-[#79565D] hover:text-[#79565D] transition-colors"
                    >
                      <Plus size={13} />
                      <span>Add Product SKU</span>
                    </button>
                    <span className="text-[11px] text-[#969892]">
                      Prices, trade schemes, and GST will be recalculated by the backend on save.
                    </span>
                  </div>
                </div>
              ) : (
                /* Read-Only Review Table */
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#E7E6E0] bg-[#FAF9F6] text-[10px] font-bold uppercase tracking-wider text-[#969892]">
                      <tr>
                        <th className="px-4 py-2.5">Product / SKU</th>
                        <th className="px-4 py-2.5 text-center">Ordered</th>
                        <th className="px-4 py-2.5 text-center">Depot Stock</th>
                        <th className="px-4 py-2.5 text-center">Free Scheme</th>
                        <th className="px-4 py-2.5 text-right">Unit Rate</th>
                        <th className="px-4 py-2.5 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0EFEA]">
                      {items.map((item) => (
                        <tr key={item.id} className="hover:bg-[#FBFBFA]">
                          <td className="px-4 py-3">
                            <p className="font-bold text-[#242724]">{item.product_name}</p>
                            <p className="font-mono text-[11px] text-[#969892]">SKU: {item.sku}</p>
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-[#242724]">
                            <p>{item.quantity} {item.quantity_unit}</p>
                            {item.quantity_unit === "CASE" && item.units_per_case && item.units_per_case > 1 && (
                              <p className="text-[10px] text-[#666864] font-normal">
                                ({item.quantity * item.units_per_case} pcs)
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.available_stock !== undefined ? (
                              <div>
                                <Badge
                                  variant={
                                    item.available_stock >= item.quantity + item.free_quantity
                                      ? "success"
                                      : "danger"
                                  }
                                >
                                  {item.available_stock} {item.quantity_unit}s avail
                                </Badge>
                                {item.stock_on_hand !== undefined && (
                                  <p className="text-[10px] text-[#969892] mt-0.5 tabular-nums">
                                    {item.stock_on_hand} depot stock
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-[#969892]">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.free_quantity > 0 ? (
                              <Badge variant="success">
                                +{item.free_quantity} {item.quantity_unit} bonus
                              </Badge>
                            ) : (
                              <span className="text-[#969892]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {item.quantity_unit === "CASE" && item.units_per_case && item.units_per_case > 1 ? (
                              <div>
                                <p className="font-bold text-[#242724] tabular-nums">
                                  {formatCurrency(item.unit_price * item.units_per_case)} / cs
                                </p>
                                <p className="text-[10px] text-[#969892] font-normal tabular-nums">
                                  ({formatCurrency(item.unit_price)} / pc · {item.units_per_case} pcs/cs)
                                </p>
                              </div>
                            ) : (
                              <p className="text-[#242724] tabular-nums">
                                {formatCurrency(item.unit_price)} / pc
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-[#242724] tabular-nums">
                            {formatCurrency(item.line_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Financial Summary */}
              <div className="border-t border-[#E7E6E0] bg-[#FAF9F6] px-4 sm:px-6 py-4">
                <div className="ml-auto max-w-xs space-y-2 text-xs">
                  <div className="flex justify-between text-[#666864]">
                    <span>Subtotal</span>
                    <span className="font-mono font-semibold text-[#242724] tabular-nums">
                      {formatCurrency(order.subtotal)}
                    </span>
                  </div>
                  {order.discount_amount > 0 && (
                    <div className="flex justify-between text-[#205234]">
                      <span>Scheme Promo Discount</span>
                      <span className="font-mono font-bold tabular-nums">
                        -{formatCurrency(order.discount_amount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-[#666864]">
                    <span>Tax (GST)</span>
                    <span className="font-mono font-semibold text-[#242724] tabular-nums">
                      {formatCurrency(order.tax_amount)}
                    </span>
                  </div>
                  <div className="border-t border-[#E7E6E0] pt-2 flex justify-between text-sm font-bold text-[#242724]">
                    <span>Grand Total</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(order.total_amount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Note if present */}
            {order.customer_note && (
              <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-4 shadow-2xs">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#969892]">
                  Retailer Delivery Instructions
                </h3>
                <p className="mt-1 text-xs text-[#242724] italic">
                  &ldquo;{order.customer_note}&rdquo;
                </p>
              </div>
            )}

            {/* Desk Note / Rejection Reason if present */}
            {order.desk_note && (
              <div
                className={`rounded-[6px] border p-4 shadow-2xs ${
                  order.status === "REJECTED"
                    ? "border-[#EDBCBC] bg-[#FBF0F0]"
                    : "border-[#E7E6E0] bg-[#FAF9F6]"
                }`}
              >
                <h3
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    order.status === "REJECTED"
                      ? "text-[#8C2828]"
                      : "text-[#666864]"
                  }`}
                >
                  {order.status === "REJECTED"
                    ? "Order Rejection Reason"
                    : "Order Desk Note"}
                </h3>
                <p
                  className={`mt-1 text-xs ${
                    order.status === "REJECTED"
                      ? "text-[#8C2828] font-semibold"
                      : "text-[#242724]"
                  }`}
                >
                  {order.desk_note}
                </p>
              </div>
            )}

            {/* Status History Audit Trail */}
            <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#969892]">
                Order Audit Trail
              </h3>
              <p className="mt-0.5 text-xs text-[#666864]">
                Immutable timeline of state transitions and desk operator approvals.
              </p>

              <div className="mt-4 flow-root">
                <ul className="-mb-6">
                  {history.map((h, idx) => (
                    <li key={h.id}>
                      <div className="relative pb-6">
                        {idx !== history.length - 1 && (
                          <span
                            className="absolute left-3 top-3 -ml-px h-full w-0.5 bg-[#E7E6E0]"
                            aria-hidden="true"
                          />
                        )}
                        <div className="relative flex items-start space-x-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#E7E6E0] bg-white text-[10px] font-bold font-mono text-[#242724]">
                            {idx + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between text-xs">
                              <p className="font-bold text-[#242724]">
                                {h.new_status.replace("_", " ")}
                                {h.previous_status && (
                                  <span className="font-normal text-[#969892]">
                                    {" "}(from {h.previous_status.replace("_", " ")})
                                  </span>
                                )}
                              </p>
                              <span className="text-[11px] text-[#969892] tabular-nums">
                                {formatDate(h.created_at)}
                              </span>
                            </div>
                            {h.note && (
                              <p className="mt-0.5 text-xs text-[#666864]">
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

          {/* Right 1-Column: Retailer & Credit Info */}
          <div className="space-y-4">
            {/* Retailer Card */}
            <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#969892]">
                  Retailer Profile
                </h3>
                {retailer && (
                  <Badge variant="outline" className="text-[10px]">
                    {retailer.registration_status}
                  </Badge>
                )}
              </div>

              {retailer ? (
                <div className="mt-3 space-y-2.5 text-xs">
                  <div>
                    <p className="font-bold text-sm text-[#242724]">
                      {retailer.shop_name}
                    </p>
                    <p className="font-mono text-[11px] text-[#969892]">
                      Code: {retailer.retailer_code}
                    </p>
                  </div>

                  <div className="border-t border-[#F0EFEA] pt-2">
                    <p className="text-[11px] text-[#969892]">Proprietor</p>
                    <p className="font-semibold text-[#242724]">
                      {retailer.owner_name}
                    </p>
                    <p className="text-[11px] text-[#666864] font-mono">{retailer.phone}</p>
                  </div>

                  <div className="border-t border-[#F0EFEA] pt-2">
                    <p className="text-[11px] text-[#969892]">Delivery Address</p>
                    <p className="text-xs text-[#242724] leading-relaxed">
                      {retailer.address}, {retailer.city}, {retailer.state} - {retailer.pincode}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs text-[#666864]">
                  Retailer details not available.
                </p>
              )}
            </div>

            {/* Credit Account Health */}
            <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#969892]">
                Credit Status & Risk
              </h3>

              {credit ? (
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#666864]">Total Credit Limit</span>
                    <span className="font-mono font-bold text-[#242724] tabular-nums">
                      {formatCurrency(credit.credit_limit)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-[#666864]">Current Outstanding</span>
                    <span className="font-mono font-bold text-[#242724] tabular-nums">
                      {formatCurrency(credit.current_outstanding)}
                    </span>
                  </div>

                  <div className="flex justify-between border-t border-[#F0EFEA] pt-2">
                    <span className="text-[#666864]">Available Credit</span>
                    <span
                      className={`font-mono font-bold tabular-nums ${
                        isCreditShort ? "text-[#8C2828]" : "text-[#205234]"
                      }`}
                    >
                      {formatCurrency(credit.available_credit)}
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px] text-[#969892]">
                    <span>Payment Terms</span>
                    <span>{credit.payment_terms_days} days Net</span>
                  </div>

                  {isCreditShort && (
                    <div className="mt-3 rounded-[4px] border border-[#EDBCBC] bg-[#FBF0F0] p-2.5 text-[11px] text-[#8C2828] leading-relaxed">
                      <strong>Credit Exception:</strong> Available credit ({formatCurrency(credit.available_credit)}) is lower than this order value ({formatCurrency(order.total_amount)}).
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-xs text-[#666864]">
                  No active credit account on record.
                </p>
              )}
            </div>

            {/* Operational Policy Reminder */}
            <div className="rounded-[6px] border border-[#E7E6E0] bg-[#FAF9F6] p-4 text-xs text-[#666864]">
              <h4 className="font-bold text-[10px] uppercase tracking-wider text-[#969892]">
                Operator Approval Checklist
              </h4>
              <ul className="mt-2 space-y-1.5 list-disc list-inside">
                <li>Depot case inventory checked</li>
                <li>Trade promo multipliers validated</li>
                <li>Credit exposure evaluated</li>
                <li>Pick-list ready for loading</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Confirm Order Approval */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-[6px] border border-[#E7E6E0] bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#242724]">
              Confirm Order Approval
            </h3>
            <p className="mt-1 text-xs text-[#666864]">
              Order <strong className="font-mono text-[#242724]">{order.order_number}</strong> for {retailer?.shop_name || "Retailer"}.
            </p>

            <div className="mt-4 border-y border-[#E7E6E0] py-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#666864]">Order Grand Total:</span>
                <span className="font-mono font-bold text-[#242724] tabular-nums">
                  {formatCurrency(order.total_amount)}
                </span>
              </div>
              {credit && (
                <div className="flex justify-between">
                  <span className="text-[#666864]">Available Credit:</span>
                  <span className="font-mono font-bold text-[#242724] tabular-nums">
                    {formatCurrency(credit.available_credit)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#666864]">Line Items to Reserve:</span>
                <span className="font-semibold text-[#242724]">
                  {items.length} SKUs ({items.reduce((acc, i) => acc + i.quantity + i.free_quantity, 0)} units)
                </span>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-[#242724]">
                Staff Approval Note (Optional)
              </label>
              <input
                type="text"
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder="e.g. Stock confirmed at Jabalpur Depot, ready for morning truck"
                className="mt-1.5 w-full rounded-[4px] border border-[#E7E6E0] px-3 py-2 text-xs text-[#242724] focus:border-[#79565D] focus:outline-none"
              />
            </div>

            <div className="mt-3 rounded-[4px] border border-[#EED7B3] bg-[#FCF6EC] p-3 text-[11px] text-[#7A4E12]">
              Approving will immediately commit warehouse inventory and post a debit to the retailer&apos;s ledger.
            </div>

            {actionError && (
              <p className="mt-3 text-xs font-semibold text-[#8C2828]">
                {actionError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowApproveModal(false);
                  setActionError(null);
                }}
                disabled={actionBusy}
                className="rounded-[4px] border border-[#E7E6E0] bg-white px-4 py-2 text-xs font-semibold text-[#666864] hover:bg-[#F0EFEA]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveOrder}
                disabled={actionBusy}
                className="rounded-[4px] bg-[#205234] px-4 py-2 text-xs font-bold text-white hover:bg-[#183F28] disabled:opacity-50 transition-colors shadow-2xs"
              >
                {actionBusy ? "Approving..." : "Confirm & Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Order Rejection */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-[6px] border border-[#EDBCBC] bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#8C2828]">
              Reject Order
            </h3>
            <p className="mt-1 text-xs text-[#666864]">
              Order <strong className="font-mono text-[#242724]">{order.order_number}</strong> will be marked as REJECTED.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-[#242724]">
                Reason for Rejection (Mandatory)
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="State the reason (e.g. Insufficient depot stock, credit limit breached, shop unverified)"
                className="mt-1.5 w-full rounded-[4px] border border-[#E7E6E0] p-2.5 text-xs text-[#242724] focus:border-[#8C2828] focus:outline-none"
              />
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
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
                  className="rounded-[3px] border border-[#E7E6E0] bg-[#FAF9F6] px-2 py-1 text-[11px] text-[#666864] hover:bg-[#F0EFEA] hover:text-[#242724]"
                >
                  {quickReason}
                </button>
              ))}
            </div>

            {actionError && (
              <p className="mt-3 text-xs font-semibold text-[#8C2828]">
                {actionError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setActionError(null);
                }}
                disabled={actionBusy}
                className="rounded-[4px] border border-[#E7E6E0] bg-white px-4 py-2 text-xs font-semibold text-[#666864] hover:bg-[#F0EFEA]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectOrder}
                disabled={actionBusy || rejectReason.trim().length < 3}
                className="rounded-[4px] bg-[#8C2828] px-4 py-2 text-xs font-bold text-white hover:bg-[#681C1C] disabled:opacity-40 transition-colors shadow-2xs"
              >
                {actionBusy ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Order Hold */}
      {showHoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-[6px] border border-[#EED7B3] bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#7A4E12]">
              Place Order On Hold
            </h3>
            <p className="mt-1 text-xs text-[#666864]">
              Order <strong className="font-mono text-[#242724]">{order.order_number}</strong> will be moved to <strong className="text-[#7A4E12]">ON_HOLD</strong> status.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-[#242724]">
                Reason for Hold (Mandatory)
              </label>
              <textarea
                rows={3}
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                placeholder="Specify reason (e.g. Credit limit breach, waiting for warehouse delivery, shop address unconfirmed)"
                className="mt-1.5 w-full rounded-[4px] border border-[#E7E6E0] p-2.5 text-xs text-[#242724] focus:border-[#7A4E12] focus:outline-none"
              />
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {[
                "Credit limit breached — awaiting payment",
                "Depot stock low — expecting truck delivery",
                "Price or scheme confirmation needed",
                "Kirana address verification pending",
              ].map((quickReason) => (
                <button
                  key={quickReason}
                  type="button"
                  onClick={() => setHoldReason(quickReason)}
                  className="rounded-[3px] border border-[#E7E6E0] bg-[#FAF9F6] px-2 py-1 text-[11px] text-[#666864] hover:bg-[#F0EFEA] hover:text-[#242724]"
                >
                  {quickReason}
                </button>
              ))}
            </div>

            {actionError && (
              <p className="mt-3 text-xs font-semibold text-[#8C2828]">
                {actionError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowHoldModal(false);
                  setActionError(null);
                }}
                disabled={actionBusy}
                className="rounded-[4px] border border-[#E7E6E0] bg-white px-4 py-2 text-xs font-semibold text-[#666864] hover:bg-[#F0EFEA]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleHoldOrder}
                disabled={actionBusy || holdReason.trim().length < 3}
                className="rounded-[4px] bg-[#7A4E12] px-4 py-2 text-xs font-bold text-white hover:bg-[#5C3A0D] disabled:opacity-40 transition-colors shadow-2xs"
              >
                {actionBusy ? "Saving..." : "Confirm Hold"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Product to Order */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E6E0]">
              <div>
                <h3 className="text-sm font-bold text-[#242724]">
                  Add Product SKU to Order
                </h3>
                <p className="text-[11px] text-[#666864] mt-0.5">
                  Select an active catalogue SKU to add to this order review draft.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                className="p-1 text-[#969892] hover:text-[#242724] rounded-[4px]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative mt-3">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#969892]"
              />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  searchCatalogueProducts(e.target.value);
                }}
                placeholder="Search products by SKU, title, category..."
                className="w-full rounded-[4px] border border-[#E7E6E0] bg-[#FAF9F6] pl-8 pr-3 py-1.5 text-xs text-[#242724] focus:border-[#79565D] focus:outline-none"
              />
            </div>

            {/* Products List */}
            <div className="mt-3 overflow-y-auto flex-1 divide-y divide-[#F0EFEA] min-h-[220px]">
              {searchingProducts ? (
                <div className="p-6 text-center text-xs text-[#969892]">
                  Searching catalogue...
                </div>
              ) : availableProducts.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#969892]">
                  No matching active products found in depot master.
                </div>
              ) : (
                availableProducts.map((p) => (
                  <div
                    key={p.id}
                    className="py-2.5 px-2 flex items-center justify-between hover:bg-[#FAF9F6] rounded-[4px] transition-colors"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-xs font-bold text-[#242724] truncate">
                        {p.name}
                      </p>
                      <p className="text-[11px] font-mono text-[#969892] mt-0.5">
                        SKU: {p.sku} • {p.units_per_case} pcs/case • Base: {formatCurrency(p.price)}/pc
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <Badge
                        variant={p.stock_on_hand > 0 ? "success" : "danger"}
                      >
                        {p.stock_on_hand} in stock
                      </Badge>
                      <button
                        type="button"
                        onClick={() => handleAddProductToDraft(p)}
                        className="rounded-[3px] bg-[#79565D] px-2.5 py-1 text-xs font-bold text-white hover:bg-[#67474E] transition-colors"
                      >
                        Add to Order
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-[#E7E6E0] flex justify-end">
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                className="rounded-[4px] border border-[#E7E6E0] bg-white px-3 py-1.5 text-xs font-semibold text-[#666864] hover:bg-[#F0EFEA]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F6F5F1] p-8">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs text-[#666864]">
              Loading order review details...
            </p>
          </div>
        </main>
      }
    >
      <OrderDetailContent />
    </Suspense>
  );
}
