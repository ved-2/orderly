"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Package,
  RotateCw,
  ShoppingBag,
  ArrowRight,
  Receipt,
  Truck,
  Search,
  X,
  PhoneCall,
  Check,
  ChevronRight,
  FileText,
  Calendar,
  AlertTriangle,
  ClipboardCheck,
  MessageCircle,
  CheckSquare,
  Minus,
  Plus,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";
import { addToCart, type QuantityUnit, type CartItem } from "@/lib/cart";
import { Badge } from "@/components/ui/badge";
import { ProductThumbnail } from "@/components/ui/product-thumbnail";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface OrderLine {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  quantity_unit: QuantityUnit;
  units_per_case?: number;
  free_quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
}

interface RetailerOrder {
  id: string;
  order_number: string;
  status: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  customer_note: string | null;
  created_at: string;
  submitted_at: string | null;
  lines: OrderLine[];
}

interface OrdersResponse {
  items: RetailerOrder[];
  total: number;
}

interface CatalogueProduct {
  id: string;
  sku: string;
  name: string;
  brand_name: string;
  pack_size: number;
  pack_unit: string;
  units_per_case: number;
  price: number | null;
  gst_included: boolean | null;
  quantity_available: number;
}

interface CatalogueResponse {
  items: CatalogueProduct[];
  total: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateShort(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

type OrderTab = "ALL" | "PENDING" | "ON_THE_WAY" | "DELIVERED";

function matchesTab(status: string, tab: OrderTab): boolean {
  const s = status.toUpperCase();
  if (tab === "ALL") return true;
  if (tab === "PENDING") {
    return s === "SUBMITTED" || s === "PENDING" || s === "DRAFT" || s === "HOLD";
  }
  if (tab === "ON_THE_WAY") {
    return s === "APPROVED" || s === "PROCESSING" || s === "DISPATCHED";
  }
  if (tab === "DELIVERED") {
    return s === "DELIVERED";
  }
  return true;
}

function getStatusDetails(status: string): {
  label: string;
  badgeVariant: "default" | "success" | "warning" | "danger" | "info" | "accent";
  icon: React.ElementType;
  step: number; // 1 to 4
  explanation: string;
} {
  const s = status.toUpperCase();
  switch (s) {
    case "DELIVERED":
      return {
        label: "Delivered",
        badgeVariant: "success",
        icon: CheckCircle2,
        step: 4,
        explanation: "This order has been safely delivered to your kirana store.",
      };
    case "DISPATCHED":
      return {
        label: "On the Way (Dispatched)",
        badgeVariant: "info",
        icon: Truck,
        step: 3,
        explanation: "Your order is out on the Jabalpur depot delivery route.",
      };
    case "APPROVED":
    case "PROCESSING":
      return {
        label: "Approved by Depot",
        badgeVariant: "info",
        icon: CheckCircle2,
        step: 2,
        explanation: "Order Desk has approved your order. Packed and queued for dispatch.",
      };
    case "SUBMITTED":
    case "PENDING":
    case "DRAFT":
      return {
        label: "Pending Review",
        badgeVariant: "warning",
        icon: Clock,
        step: 1,
        explanation: "Submitted to Jabalpur Order Desk. Awaiting verification.",
      };
    case "HOLD":
      return {
        label: "On Hold",
        badgeVariant: "warning",
        icon: AlertTriangle,
        step: 1,
        explanation:
          "Order is currently on hold by Order Desk for credit limit or inventory check. Call depot desk at +91 761 240 8890.",
      };
    case "REJECTED":
    case "CANCELLED":
      return {
        label: "Cancelled / Rejected",
        badgeVariant: "danger",
        icon: XCircle,
        step: 0,
        explanation:
          "This order was cancelled or rejected by Order Desk. Please review items and place a fresh order.",
      };
    default:
      return {
        label: s.replace("_", " "),
        badgeVariant: "default",
        icon: Package,
        step: 1,
        explanation: "Order status updated.",
      };
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function RetailerOrdersPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [orders, setOrders] = useState<RetailerOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<RetailerOrder | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<OrderTab>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [reorderFeedback, setReorderFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<"items" | "checklist">("items");
  const [receivingMap, setReceivingMap] = useState<Record<string, Record<string, number>>>({});
  const [savedVerification, setSavedVerification] = useState<Record<string, string>>({});

  useEffect(() => {
    document.title = "My Orders & Delivery Checklist | Orderly";
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("orderly_delivery_receiving");
      if (saved) {
        setReceivingMap(JSON.parse(saved));
      }
      const savedVer = localStorage.getItem("orderly_saved_verifications");
      if (savedVer) {
        setSavedVerification(JSON.parse(savedVer));
      }
    } catch {}
  }, []);

  const saveReceivingState = (orderId: string, updated: Record<string, number>) => {
    setReceivingMap((prev) => {
      const next = { ...prev, [orderId]: updated };
      try {
        localStorage.setItem("orderly_delivery_receiving", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const getLineReceived = (orderId: string, lineKey: string, defaultQty: number) => {
    return receivingMap[orderId]?.[lineKey] ?? defaultQty;
  };

  const updateLineReceived = (orderId: string, lineKey: string, delta: number, maxQty: number) => {
    const current = getLineReceived(orderId, lineKey, maxQty);
    const nextVal = Math.max(0, current + delta);
    const orderLines = receivingMap[orderId] || {};
    saveReceivingState(orderId, { ...orderLines, [lineKey]: nextVal });
  };

  const markAllLinesFull = (order: RetailerOrder) => {
    const updated: Record<string, number> = {};
    order.lines.forEach((l, idx) => {
      const key = `${l.product_id}-${idx}`;
      const totalExpected = l.quantity + (Number(l.free_quantity) || 0);
      updated[key] = totalExpected;
    });
    saveReceivingState(order.id, updated);
  };

  const handleSaveVerification = (orderId: string) => {
    const nowStr = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    setSavedVerification((prev) => {
      const next = { ...prev, [orderId]: nowStr };
      try {
        localStorage.setItem("orderly_saved_verifications", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  /* Fetch orders */
  const fetchOrders = useCallback(async () => {
    try {
      const response = await apiRequest<OrdersResponse>("/orders");
      const list = response.items || [];
      setOrders(list);
      if (list.length > 0 && !selectedOrder) {
        setSelectedOrder(list[0]);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load your orders."
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrder]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/register");
      return;
    }
    void fetchOrders();
  }, [user, loading, router, fetchOrders]);

  /* Filter and search pipeline */
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Tab filter
      if (!matchesTab(o.status, activeTab)) return false;

      // Search query filter (order number or product name)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNumber = o.order_number.toLowerCase().includes(q);
        const matchesProduct = o.lines.some((l) =>
          l.product_name.toLowerCase().includes(q) || l.sku.toLowerCase().includes(q)
        );
        if (!matchesNumber && !matchesProduct) return false;
      }

      return true;
    });
  }, [orders, activeTab, searchQuery]);

  // Keep selected order in sync
  useEffect(() => {
    if (filteredOrders.length > 0) {
      if (!selectedOrder || !filteredOrders.some((o) => o.id === selectedOrder.id)) {
        setSelectedOrder(filteredOrders[0]);
      }
    } else {
      setSelectedOrder(null);
    }
  }, [filteredOrders, selectedOrder]);

  /* Reorder Handler: Creates new cart, checks live stock, never auto-submits */
  async function handleReorder(order: RetailerOrder) {
    setReorderingId(order.id);
    setReorderFeedback(null);
    try {
      // 1. Fetch live catalogue to recheck prices and stock
      const catalogueRes = await apiRequest<CatalogueResponse>(
        "/products/catalogue?page=1&page_size=100"
      );
      const catMap = new Map<string, CatalogueProduct>();
      catalogueRes.items.forEach((p) => {
        catMap.set(String(p.id), p);
        catMap.set(p.sku.toLowerCase(), p);
      });

      let addedCount = 0;
      let outOfStockCount = 0;

      // 2. Add each available line into the cart with live stock
      order.lines.forEach((line) => {
        const catProduct =
          catMap.get(String(line.product_id)) || catMap.get(line.sku.toLowerCase());

        if (catProduct && catProduct.quantity_available > 0 && catProduct.price !== null) {
          const qtyToAdd = Math.min(
            line.quantity,
            Math.floor(catProduct.quantity_available / catProduct.units_per_case) || 1
          );

          addToCart({
            product_id: String(catProduct.id),
            sku: catProduct.sku,
            name: catProduct.name,
            brand_name: catProduct.brand_name || "Depot Brand",
            pack_size: catProduct.pack_size,
            pack_unit: catProduct.pack_unit,
            units_per_case: catProduct.units_per_case,
            price: Number(catProduct.price),
            gst_included: Boolean(catProduct.gst_included),
            quantity_available: Number(catProduct.quantity_available),
            quantity: Math.max(1, qtyToAdd),
            quantity_unit: line.quantity_unit || "CASE",
          });
          addedCount++;
        } else {
          outOfStockCount++;
        }
      });

      if (addedCount > 0) {
        setReorderFeedback({
          message: `${addedCount} items added to your basket with current wholesale rates.${
            outOfStockCount > 0 ? ` (${outOfStockCount} unavailable items skipped)` : ""
          } Reviewing cart...`,
          type: "success",
        });
        setTimeout(() => {
          router.push("/retailer/cart");
        }, 1200);
      } else {
        setReorderFeedback({
          message: "All items from this order are currently out of stock at the depot.",
          type: "error",
        });
      }
    } catch (err) {
      setReorderFeedback({
        message: err instanceof Error ? err.message : "Unable to prepare repeat order.",
        type: "error",
      });
    } finally {
      setReorderingId(null);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Order Detail View Component (Shared Desktop & Mobile Sheet)      */
  /* ---------------------------------------------------------------- */

  const renderOrderDetails = (order: RetailerOrder, isModal = false) => {
    const statusInfo = getStatusDetails(order.status);
    const StatusIcon = statusInfo.icon;
    const isDelivered = order.status.toUpperCase() === "DELIVERED";
    const isHold = order.status.toUpperCase() === "HOLD";
    const isCancelled =
      order.status.toUpperCase() === "REJECTED" || order.status.toUpperCase() === "CANCELLED";

    return (
      <div className="space-y-4 sm:space-y-5">
        {/* Detail Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E7E6E0] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base sm:text-lg font-bold text-[#242724]">
                {order.order_number}
              </span>
              <Badge variant={statusInfo.badgeVariant} className="text-[10px] py-0.5">
                <StatusIcon size={12} className="mr-1" />
                {statusInfo.label}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-[#666864] flex items-center gap-1.5">
              <Calendar size={12} />
              Placed on {formatDate(order.created_at)}
            </p>
          </div>

          {/* Reorder Button */}
          {!isCancelled && (
            <button
              onClick={() => handleReorder(order)}
              disabled={reorderingId === order.id}
              className="inline-flex items-center gap-2 rounded-[4px] bg-[#79565D] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#67474E] active:scale-95 transition-all min-h-[44px]"
            >
              <RotateCw
                size={14}
                className={reorderingId === order.id ? "animate-spin" : ""}
              />
              <span>Repeat Order</span>
            </button>
          )}
        </div>

        {/* Short Order Progress Indicator */}
        <div className="rounded-[6px] border border-[#E7E6E0] bg-[#FAF9F6] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#969892] mb-3">
            Dispatch Progress
          </p>

          <div className="grid grid-cols-4 gap-2 relative">
            {[
              { num: 1, title: "Submitted", desc: "Order Desk" },
              { num: 2, title: "Approved", desc: "Credit & Pack" },
              { num: 3, title: "On Route", desc: "Depot Van" },
              { num: 4, title: "Delivered", desc: "Kirana Shop" },
            ].map((st) => {
              const isPast = statusInfo.step >= st.num && !isCancelled && !isHold;
              const isCurrent = statusInfo.step === st.num && !isCancelled && !isHold;

              return (
                <div key={st.num} className="text-center relative">
                  <div
                    className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      isPast
                        ? "bg-[#205234] text-white"
                        : isCurrent
                        ? "bg-[#79565D] text-white ring-2 ring-[#79565D]/30"
                        : "bg-[#E7E6E0] text-[#969892]"
                    }`}
                  >
                    {isPast ? <Check size={14} /> : st.num}
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-[#242724] leading-tight">
                    {st.title}
                  </p>
                  <p className="text-[9px] text-[#969892] hidden sm:block">
                    {st.desc}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#E7E6E0] flex items-center gap-2 text-xs text-[#666864]">
            <StatusIcon size={14} className="shrink-0 text-[#79565D]" />
            <span>{statusInfo.explanation}</span>
          </div>
        </div>

        {/* Hold or Cancelled Warning Card */}
        {(isHold || isCancelled) && (
          <div
            className={`rounded-[6px] border p-4 text-xs ${
              isHold
                ? "border-[#EED7B3] bg-[#FCF6EC] text-[#7A4E12]"
                : "border-[#EDBCBC] bg-[#FBF0F0] text-[#8C2828]"
            }`}
          >
            <div className="flex items-center gap-2 font-bold mb-1">
              <AlertCircle size={16} />
              <span>{isHold ? "Action Required: Order On Hold" : "Order Not Processed"}</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {isHold
                ? "Your order exceeded available credit or contains constrained stock lines. Our Jabalpur Order Desk is reviewing it. Contact your assigned representative or call depot support."
                : "This order was cancelled by the distributor. You can place a routine reorder from your catalogue anytime."}
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <a
                href="tel:+917612408890"
                className="inline-flex items-center gap-1.5 rounded-[4px] bg-white border px-3 py-1.5 text-xs font-bold shadow-2xs hover:bg-[#F0EFEA] transition-colors"
              >
                <PhoneCall size={12} />
                <span>Call Jabalpur Order Desk (+91 761 240 8890)</span>
              </a>
            </div>
          </div>
        )}

        {/* Detail Tabs: Invoice vs Delivery Checklist */}
        <div className="flex items-center gap-2 border-b border-[#E7E6E0] pb-2">
          <button
            type="button"
            onClick={() => setDetailTab("items")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              detailTab === "items"
                ? "bg-[#242724] text-white shadow-xs"
                : "text-[#666864] hover:bg-[#F0EFEA]"
            }`}
          >
            <FileText size={13} />
            <span>Bill & Invoiced Items</span>
          </button>

          <button
            type="button"
            onClick={() => setDetailTab("checklist")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              detailTab === "checklist"
                ? "bg-[#79565D] text-white shadow-xs"
                : "text-[#666864] hover:bg-[#F0EFEA]"
            }`}
          >
            <ClipboardCheck size={14} />
            <span>Delivery Checklist (सामान मिला या बाकी?)</span>
            {(() => {
              let totalExp = 0;
              let totalRec = 0;
              order.lines.forEach((l, idx) => {
                const key = `${l.product_id}-${idx}`;
                const exp = l.quantity + (Number(l.free_quantity) || 0);
                totalExp += exp;
                totalRec += getLineReceived(order.id, key, exp);
              });
              const diff = totalExp - totalRec;
              if (diff > 0) {
                return (
                  <span className="rounded-full bg-[#8E281F] px-1.5 py-0.2 text-[10px] text-white font-bold ml-1">
                    {diff} बाकी
                  </span>
                );
              }
              return (
                <span className="rounded-full bg-[#205234] px-1.5 py-0.2 text-[10px] text-white font-bold ml-1">
                  ✓
                </span>
              );
            })()}
          </button>
        </div>

        {detailTab === "checklist" ? (
          /* Delivery Receiving Checklist View */
          <div className="space-y-4">
            {(() => {
              let totalExp = 0;
              let totalRec = 0;
              const shortages: { name: string; ordered: number; received: number; short: number; unit: string }[] = [];

              order.lines.forEach((l, idx) => {
                const key = `${l.product_id}-${idx}`;
                const exp = l.quantity + (Number(l.free_quantity) || 0);
                const rec = getLineReceived(order.id, key, exp);
                totalExp += exp;
                totalRec += rec;
                if (rec < exp) {
                  shortages.push({
                    name: l.product_name,
                    ordered: exp,
                    received: rec,
                    short: exp - rec,
                    unit: l.quantity_unit,
                  });
                }
              });

              const isShort = shortages.length > 0;
              const verifiedAt = savedVerification[order.id];

              const waMsg =
                `Namaste Orderly Distributor ji, Order #${order.order_number} delivery check me discrepancy mili hai:\n` +
                shortages
                  .map(
                    (s) =>
                      `• ${s.name}: ${s.short} ${s.unit} बाकी (आया: ${s.received}/${s.ordered})`
                  )
                  .join("\n") +
                `\nKripya balance stock next delivery me send karein.`;
              const waUrl = `https://wa.me/917612408890?text=${encodeURIComponent(waMsg)}`;

              return (
                <div className="space-y-3">
                  {/* Summary Bar */}
                  <div className="rounded-[6px] border border-[#E7E6E0] bg-[#FAF9F6] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#242724]">
                          Inward Stock Verification
                        </span>
                        {verifiedAt && (
                          <span className="rounded bg-[#D7EAD9] px-2 py-0.5 text-[10px] font-bold text-[#1E452B]">
                            Verified {verifiedAt}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-[#666864]">
                        Ordered: <strong className="text-[#242724]">{totalExp}</strong> items | Received:{" "}
                        <strong className="text-[#205234]">{totalRec}</strong> items | Remaining/Short:{" "}
                        <strong className={isShort ? "text-[#8E281F]" : "text-[#205234]"}>
                          {Math.max(0, totalExp - totalRec)}
                        </strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => markAllLinesFull(order)}
                        className="rounded-[4px] border border-[#D5D4CE] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#242724] hover:bg-[#F0EFEA] transition shadow-2xs"
                      >
                        Sabhi Samaan Mil Gaya (Mark Full)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveVerification(order.id)}
                        className="rounded-[4px] bg-[#242724] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#3C3F3C] transition shadow-2xs"
                      >
                        Save Verification
                      </button>
                    </div>
                  </div>

                  {/* Discrepancy Alert & WhatsApp Report */}
                  {isShort && (
                    <div className="rounded-[6px] border border-[#EDBCBC] bg-[#FDF5F5] p-3 text-xs text-[#8E281F] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="shrink-0" />
                        <span>
                          <strong>Short Delivery:</strong> {shortages.length} items me stock kam mila hai. Distributor ko turant report karein.
                        </span>
                      </div>
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1EBE5D] transition shrink-0 shadow-2xs"
                      >
                        <MessageCircle size={14} />
                        <span>Report Shortage on WhatsApp</span>
                      </a>
                    </div>
                  )}

                  {/* Checklist Table */}
                  <div className="rounded-[6px] border border-[#E7E6E0] bg-white overflow-hidden shadow-2xs">
                    <div className="bg-[#FAF9F6] px-4 py-2.5 border-b border-[#E7E6E0] flex items-center justify-between text-xs font-semibold text-[#666864]">
                      <span>Product & Details</span>
                      <span>Kitna Aaya / Kitna Baki</span>
                    </div>

                    <div className="divide-y divide-[#F0EFEA]">
                      {order.lines.map((line, idx) => {
                        const key = `${line.product_id}-${idx}`;
                        const expected = line.quantity + (Number(line.free_quantity) || 0);
                        const rec = getLineReceived(order.id, key, expected);
                        const isLineShort = rec < expected;
                        const isLineZero = rec === 0;

                        return (
                          <div
                            key={key}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 text-xs hover:bg-[#FAF9F6] transition"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <ProductThumbnail
                                name={line.product_name}
                                size="sm"
                                className="w-10 h-10 shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="font-semibold text-[#242724] truncate">
                                  {line.product_name}
                                </p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#666864]">
                                  <span className="font-mono text-[#969892]">{line.sku}</span>
                                  <span>·</span>
                                  <span>
                                    Ordered: <strong className="text-[#242724]">{line.quantity} {line.quantity_unit}</strong>
                                  </span>
                                  {Number(line.free_quantity) > 0 && (
                                    <span className="rounded bg-[#D7EAD9] px-1.5 py-0.2 text-[10px] font-bold text-[#1E452B]">
                                      +{line.free_quantity} Free
                                    </span>
                                  )}
                                  <span>·</span>
                                  <span className="font-bold text-[#242724]">
                                    Total Expected: {expected} {line.quantity_unit}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Stepper & Status Badge */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                              <div className="flex items-center rounded-lg border border-[#D5D4CE] bg-white p-0.5 shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => updateLineReceived(order.id, key, -1, expected)}
                                  className="flex h-7 w-7 items-center justify-center rounded text-[#666864] hover:bg-[#F0EFEA] active:scale-95 transition"
                                >
                                  <Minus size={13} />
                                </button>
                                <span className="w-9 text-center font-bold text-sm text-[#242724] tabular-nums">
                                  {rec}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateLineReceived(order.id, key, 1, expected)}
                                  className="flex h-7 w-7 items-center justify-center rounded text-[#666864] hover:bg-[#F0EFEA] active:scale-95 transition"
                                >
                                  <Plus size={13} />
                                </button>
                              </div>

                              <div className="min-w-[110px] text-right">
                                {isLineZero ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FBF0F0] px-2.5 py-0.5 text-[11px] font-bold text-[#8C2828]">
                                    बिल्कुल नहीं आया
                                  </span>
                                ) : isLineShort ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FCF6EC] px-2.5 py-0.5 text-[11px] font-bold text-[#7A4E12]">
                                    ⚠️ {expected - rec} {line.quantity_unit} बाकी
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF6F1] px-2.5 py-0.5 text-[11px] font-bold text-[#205234]">
                                    <Check size={11} /> पूरा आ गया
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          /* Product Items Table (Billed View) */
          <div className="rounded-[6px] border border-[#E7E6E0] bg-white overflow-hidden shadow-2xs">
            <div className="bg-[#FAF9F6] px-4 py-2.5 border-b border-[#E7E6E0] flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-[#969892]">
                Order Items ({order.lines.length})
              </span>
              <span className="font-mono text-[11px] text-[#666864]">
                {order.lines.reduce((acc, l) => acc + l.quantity, 0)} Total Cases
              </span>
            </div>

            <div className="divide-y divide-[#F0EFEA]">
              {order.lines.map((line, idx) => (
                <div
                  key={`${line.product_id}-${idx}`}
                  className="flex items-center justify-between gap-3 p-3 sm:p-4 text-xs hover:bg-[#FAF9F6] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ProductThumbnail
                      name={line.product_name}
                      size="sm"
                      className="w-10 h-10 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-[#242724] truncate">
                        {line.product_name}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#666864]">
                        <span className="font-mono text-[#969892]">{line.sku}</span>
                        <span>·</span>
                        <span className="font-semibold text-[#242724]">
                          {line.quantity} {line.quantity_unit}
                          {line.units_per_case ? ` (${line.units_per_case * line.quantity} pcs)` : ""}
                        </span>
                        {Number(line.free_quantity) > 0 && (
                          <Badge variant="success" className="text-[9px] py-0 px-1.5">
                            +{line.free_quantity} Free Scheme Bonus
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 font-mono">
                    <p className="font-bold text-sm text-[#242724] tabular-nums">
                      {formatCurrency(Number(line.line_total))}
                    </p>
                    <p className="text-[10px] text-[#969892]">
                      @{formatCurrency(Number(line.unit_price))} / unit
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Customer Remark Note */}
            {order.customer_note && (
              <div className="bg-[#FAF9F6] border-t border-[#E7E6E0] p-3 text-xs text-[#666864]">
                <strong className="text-[#242724]">Customer Note:</strong> {order.customer_note}
              </div>
            )}

            {/* Financial Summary Breakdown */}
            <div className="bg-[#FAF9F6] border-t border-[#E7E6E0] p-4 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-[#666864]">
                <span>Subtotal:</span>
                <span className="tabular-nums">{formatCurrency(Number(order.subtotal))}</span>
              </div>
              {Number(order.discount_amount) > 0 && (
                <div className="flex justify-between text-[#205234] font-semibold">
                  <span>Scheme Rebate / Discount:</span>
                  <span className="tabular-nums">-{formatCurrency(Number(order.discount_amount))}</span>
                </div>
              )}
              <div className="flex justify-between text-[#666864]">
                <span>GST & Taxes:</span>
                <span className="tabular-nums">{formatCurrency(Number(order.tax_amount))}</span>
              </div>
              <div className="pt-2 border-t border-[#E7E6E0] flex justify-between text-sm sm:text-base font-bold text-[#242724]">
                <span className="font-sans">Total Invoiced Amount:</span>
                <span className="tabular-nums">{formatCurrency(Number(order.total_amount))}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Loading State                                                    */
  /* ---------------------------------------------------------------- */

  if (loading || (isLoading && orders.length === 0 && !error)) {
    return (
      <div className="w-full px-4 py-5 sm:px-6 space-y-5">
        <div className="h-8 w-44 animate-pulse rounded bg-[#E7E6E0]" />
        <div className="h-12 w-full animate-pulse rounded bg-[#E7E6E0]" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded bg-[#E7E6E0]" />
          ))}
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Main Component Render                                            */
  /* ---------------------------------------------------------------- */

  return (
    <div className="w-full px-4 py-4 sm:px-6 space-y-5 pb-28 md:pb-12">

      {/* ── 1. Header ──────────────────────────────────────────── */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E7E6E0] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#242724]">
            My Orders
          </h1>
          <p className="mt-0.5 text-xs text-[#666864]">
            Your purchases, all in one place.
          </p>
        </div>

        
      </section>

      {/* ── 2. Search & Simple Tabs Filter ─────────────────────── */}
      <section className="space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#969892] pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by order number (e.g. ORD-1044) or product name..."
            className="w-full rounded-[6px] border border-[#E7E6E0] bg-white py-2.5 sm:py-3 pl-10 pr-10 text-xs sm:text-sm text-[#242724] placeholder:text-[#969892] shadow-2xs outline-none focus:border-[#79565D] focus:ring-1 focus:ring-[#79565D]/20 transition-all min-h-[44px]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#969892] hover:text-[#242724]"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Simple 4 Filter Pills */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-0.5">
          {(
            [
              { key: "ALL", label: "All Orders" },
              { key: "PENDING", label: "Pending" },
              { key: "ON_THE_WAY", label: "On the Way" },
              { key: "DELIVERED", label: "Delivered" },
            ] as const
          ).map((tab) => {
            const count = orders.filter((o) => matchesTab(o.status, tab.key)).length;
            const active = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 rounded-[6px] border px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all min-h-[44px] ${
                  active
                    ? "bg-[#242724] text-white border-[#242724] shadow-2xs"
                    : "bg-white text-[#666864] border-[#E7E6E0] hover:bg-[#F0EFEA] hover:text-[#242724]"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums ${
                    active ? "bg-white/20 text-white" : "bg-[#F0EFEA] text-[#969892]"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Feedback Toast */}
      {reorderFeedback && (
        <div
          className={`flex items-center gap-2 rounded-[6px] border p-3.5 text-xs font-bold shadow-sm ${
            reorderFeedback.type === "success"
              ? "border-[#C3DEC9] bg-[#EEF6F1] text-[#205234]"
              : "border-[#EDBCBC] bg-[#FBF0F0] text-[#8C2828]"
          }`}
        >
          {reorderFeedback.type === "success" ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{reorderFeedback.message}</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-[6px] border border-[#EDBCBC] bg-[#FBF0F0] p-4 text-xs font-medium text-[#8C2828] flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => {
              setError("");
              void fetchOrders();
            }}
            className="font-bold uppercase tracking-wider underline ml-3"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── 3. Orders Master-Detail Workstation (Desktop: 2 Columns, Mobile: Stacked) ── */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-12 text-center shadow-2xs">
          <ShoppingBag size={32} className="mx-auto text-[#969892] mb-2" />
          <h3 className="text-sm font-bold text-[#242724]">No orders found</h3>
          <p className="mt-1 text-xs text-[#666864]">
            {searchQuery
              ? `No purchase matches "${searchQuery}".`
              : activeTab !== "ALL"
              ? `No orders currently in "${activeTab.replace("_", " ")}" status.`
              : "You have not placed any orders yet."}
          </p>
          <Link
            href="/retailer/catalogue"
            className="mt-4 inline-flex items-center gap-1.5 rounded-[4px] bg-[#79565D] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white"
          >
            <Package size={14} />
            Browse Catalogue
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

          {/* ── Left Column: Orders Cards List (12 cols on mobile, 5 cols on desktop) ── */}
          <div className="lg:col-span-5 space-y-3">
            {filteredOrders.map((order) => {
              const statusInfo = getStatusDetails(order.status);
              const StatusIcon = statusInfo.icon;
              const isSelected = selectedOrder?.id === order.id;
              const totalItems = order.lines.length;
              const totalCases = order.lines.reduce((acc, l) => acc + l.quantity, 0);
              const isDelivered = order.status.toUpperCase() === "DELIVERED";

              return (
                <article
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`cursor-pointer rounded-[6px] border bg-white p-4 shadow-2xs transition-all duration-150 hover:border-[#79565D] ${
                    isSelected
                      ? "border-[#79565D] ring-1 ring-[#79565D]/20 shadow-xs"
                      : "border-[#E7E6E0]"
                  }`}
                >
                  {/* Top: Order # & Status Badge */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-sm font-bold text-[#242724]">
                      {order.order_number}
                    </span>
                    <Badge variant={statusInfo.badgeVariant} className="text-[10px] py-0.5">
                      <StatusIcon size={12} className="mr-1" />
                      {statusInfo.label}
                    </Badge>
                  </div>

                  {/* Order Date */}
                  <p className="text-[11px] text-[#666864] mb-3">
                    Placed {formatDateShort(order.created_at)} &bull; Jabalpur Depot
                  </p>

                  {/* Product Thumbnail Preview Strip */}
                  <div className="flex items-center gap-2 mb-3 bg-[#FAF9F6] p-2 rounded-[4px] border border-[#F0EFEA]">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {order.lines.slice(0, 3).map((l, i) => (
                        <ProductThumbnail
                          key={i}
                          name={l.product_name}
                          size="sm"
                          className="w-8 h-8 rounded-[3px] shrink-0"
                        />
                      ))}
                    </div>
                    <div className="text-[11px] text-[#666864] truncate">
                      <strong className="text-[#242724]">{totalItems}</strong> {totalItems === 1 ? "item" : "items"} ({totalCases} cs)
                    </div>
                  </div>

                  {/* Short Order Progress Indicator */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[10px] text-[#969892] mb-1">
                      <span>Status Flow:</span>
                      <span className="font-semibold text-[#242724]">{statusInfo.label}</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#F0EFEA] rounded-full overflow-hidden flex">
                      {[1, 2, 3, 4].map((stepNum) => (
                        <div
                          key={stepNum}
                          className={`flex-1 border-r border-white last:border-0 ${
                            statusInfo.step >= stepNum ? "bg-[#205234]" : "bg-[#F0EFEA]"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Amount & Actions */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-[#F0EFEA]">
                    <div>
                      <p className="text-[10px] text-[#969892] uppercase font-bold">Total Invoiced</p>
                      <p className="font-mono text-base font-bold text-[#242724] tabular-nums">
                        {formatCurrency(Number(order.total_amount))}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isDelivered && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleReorder(order);
                          }}
                          disabled={reorderingId === order.id}
                          className="inline-flex items-center gap-1 rounded-[4px] border border-[#E7E6E0] bg-white px-2.5 py-1.5 text-xs font-bold text-[#242724] hover:border-[#79565D] hover:text-[#79565D] transition-colors min-h-[44px]"
                          title="Reorder items into cart"
                        >
                          <RotateCw
                            size={12}
                            className={reorderingId === order.id ? "animate-spin" : ""}
                          />
                          <span>Reorder</span>
                        </button>
                      )}

                      {/* On Mobile: Click opens full details modal */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(order);
                          setMobileDetailOpen(true);
                        }}
                        className="lg:hidden inline-flex items-center gap-1 rounded-[4px] bg-[#242724] px-3 py-1.5 text-xs font-bold text-white min-h-[44px]"
                      >
                        <span>Details</span>
                        <ChevronRight size={13} />
                      </button>

                      {/* On Desktop: Indicators for selected */}
                      <span className="hidden lg:inline-flex items-center gap-0.5 text-xs font-semibold text-[#79565D]">
                        {isSelected ? "Viewing" : "View"}
                        <ChevronRight size={13} />
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* ── Right Column: Selected Order Details (Desktop Sticky Panel, 7 cols) ── */}
          <div className="hidden lg:block lg:col-span-7 sticky top-20">
            {selectedOrder ? (
              <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs">
                {renderOrderDetails(selectedOrder)}
              </div>
            ) : (
              <div className="rounded-[6px] border border-dashed border-[#E7E6E0] bg-white p-12 text-center text-xs text-[#969892]">
                Select an order to view breakdown and delivery items.
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── Mobile Order Details Modal Sheet ───────────────────── */}
      {mobileDetailOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs lg:hidden">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Order details for ${selectedOrder.order_number}`}
            className="w-full max-w-2xl rounded-[8px] bg-white p-4 shadow-xl sm:p-5 max-h-[calc(100dvh-2rem)] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-[#E7E6E0] pb-3 mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#242724]">
                Order Details
              </span>
              <button
                type="button"
                onClick={() => setMobileDetailOpen(false)}
                aria-label="Close order details"
                className="p-1.5 rounded-[4px] text-[#666864] hover:bg-[#F0EFEA] min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            {renderOrderDetails(selectedOrder, true)}

            <div className="mt-5 pt-3 border-t border-[#E7E6E0]">
              <button
                type="button"
                onClick={() => setMobileDetailOpen(false)}
                className="w-full rounded-[4px] bg-[#242724] py-2.5 text-xs font-bold uppercase tracking-wider text-white min-h-[44px]"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
