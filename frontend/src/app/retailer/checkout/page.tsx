"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Package,
  ShieldCheck,
  Store,
  Truck,
  ShoppingBag,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";
import { clearCart, getCart, type CartItem } from "@/lib/cart";
import { Badge } from "@/components/ui/badge";
import { ProductThumbnail } from "@/components/ui/product-thumbnail";

interface RetailerProfile {
  retailer_id: string | null;
  shop_name?: string;
}

interface OrderDraftResponse {
  id: string;
  order_number: string;
  status: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  created_at: string;
}

interface OrderSubmissionResponse {
  id: string;
  order_number: string;
  status: string;
  submitted_at: string;
  total_amount: number;
  message: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function RetailerCheckoutPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [retailerId, setRetailerId] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string>("");
  const [items, setItems] = useState<CartItem[]>([]);
  const [customerNote, setCustomerNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderDraftResponse | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/register");
      return;
    }

    async function loadCheckout() {
      setIsLoading(true);
      setError("");

      try {
        const profile = await apiRequest<RetailerProfile>("/auth/me");
        setRetailerId(profile.retailer_id);
        if (profile.shop_name) setShopName(profile.shop_name);
        setItems(getCart());
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load checkout."
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadCheckout();
  }, [loading, user, router]);

  const subtotal = items.reduce((total, item) => {
    const multiplier =
      item.quantity_unit === "CASE" ? item.units_per_case : 1;
    return total + item.price * item.quantity * multiplier;
  }, 0);

  const totalPacks = items.reduce((total, item) => {
    const multiplier =
      item.quantity_unit === "CASE" ? item.units_per_case : 1;
    return total + item.quantity * multiplier;
  }, 0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!retailerId) {
      setError("No verified kirana retailer account is linked to this login.");
      return;
    }

    if (items.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    const requestKey = idempotencyKey || crypto.randomUUID();
    setIdempotencyKey(requestKey);

    try {
      const createdOrder = await apiRequest<OrderDraftResponse>(
        "/orders/drafts",
        {
          method: "POST",
          body: JSON.stringify({
            retailer_id: retailerId,
            idempotency_key: requestKey,
            customer_note: customerNote.trim() || null,
            items: items.map((item) => ({
              product_id: item.product_id,
              quantity: item.quantity,
              quantity_unit: item.quantity_unit,
            })),
          }),
        }
      );

      if (createdOrder.status !== "DRAFT") {
        throw new Error("Unexpected order status received from server.");
      }

      const submittedOrder = await apiRequest<OrderSubmissionResponse>(
        `/orders/${createdOrder.id}/submit`,
        {
          method: "POST",
        }
      );

      if (submittedOrder.status !== "SUBMITTED") {
        throw new Error("Order submission could not be confirmed.");
      }

      clearCart();
      setItems([]);
      setOrder({
        ...createdOrder,
        status: submittedOrder.status,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit your order to the distributor."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading || isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <div className="h-8 w-48 animate-pulse rounded bg-[#E7E6E0]" />
        <div className="mt-6 h-64 animate-pulse rounded bg-[#E7E6E0]" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 border-b border-[#E7E6E0] pb-5">
        <div className="flex items-center gap-2 text-xs font-medium text-[#666864]">
          <Link
            href="/retailer/cart"
            className="inline-flex items-center gap-1 hover:text-[#242724] transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Return to Basket</span>
          </Link>
          <span>/</span>
          <span className="text-[#242724]">Checkout</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#242724]">
          Order Confirmation & Review
        </h1>
        <p className="mt-0.5 text-xs text-[#666864]">
          Verify item lines, packing cases, and delivery remarks before final transmission to the Jabalpur distributor depot.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-[4px] border border-[#EDBCBC] bg-[#FBF0F0] px-4 py-3 text-xs font-medium text-[#8C2828]"
        >
          {error}
        </div>
      )}

      {!retailerId && !order && items.length > 0 && (
        <div
          role="alert"
          className="mb-5 rounded-[4px] border border-[#EED7B3] bg-[#FCF6EC] px-4 py-3 text-xs font-medium text-[#7A4E12]"
        >
          No active retailer account is linked to this user. Please complete retailer registration or wait for distributor verification before submitting.
        </div>
      )}

      {order ? (
        /* Order Placed Success View */
        <div className="rounded-[6px] border border-[#C3DEC9] bg-white p-6 sm:p-8 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF6F1] text-[#205234]">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#205234]">
                Order Successfully Dispatched
              </p>
              <h2 className="text-xl font-bold font-mono tracking-tight text-[#242724]">
                {order.order_number}
              </h2>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 border-y border-[#E7E6E0] py-4 text-xs">
            <div>
              <span className="text-[#969892]">Queue Status</span>
              <p className="mt-0.5 font-bold text-[#205234]">
                SUBMITTED · READY FOR DESK
              </p>
            </div>
            <div>
              <span className="text-[#969892]">Assigned Depot</span>
              <p className="mt-0.5 font-semibold text-[#242724]">
                Jabalpur Central FMCG Depot
              </p>
            </div>
            <div>
              <span className="text-[#969892]">Recalculated Order Total</span>
              <p className="mt-0.5 font-bold font-mono text-[#242724] tabular-nums text-sm">
                {formatCurrency(Number(order.total_amount))}
              </p>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-[#666864]">
            Your order draft has been logged into the Order Desk workstation queue. The distributor will check warehouse stock reserves, apply applicable brand schemes, and schedule truck dispatch.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/retailer/orders"
              className="inline-flex items-center gap-2 rounded-[4px] bg-[#242724] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#383B38] transition-colors shadow-2xs"
            >
              <ShoppingBag size={14} />
              View in My Orders
            </Link>
            <Link
              href="/retailer/catalogue"
              className="inline-flex items-center gap-2 rounded-[4px] border border-[#E7E6E0] bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#242724] hover:bg-[#F0EFEA] transition-colors"
            >
              <Package size={14} />
              Continue Shopping
            </Link>
          </div>
        </div>
      ) : items.length === 0 ? (
        /* Empty Checkout */
        <div className="rounded-[6px] border border-[#E7E6E0] bg-white px-6 py-16 text-center shadow-2xs">
          <h2 className="text-base font-bold text-[#242724]">No items to checkout</h2>
          <p className="mt-1 text-xs text-[#666864]">
            Your basket is currently empty. Add products from the catalogue first.
          </p>
          <Link
            href="/retailer/catalogue"
            className="mt-5 inline-flex items-center gap-2 rounded-[4px] bg-[#79565D] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#67474E] transition-colors"
          >
            <Package size={14} />
            Browse Catalogue
          </Link>
        </div>
      ) : (
        /* Checkout Form & Review */
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main Review Column */}
          <div className="space-y-4">
            {/* Depot & Retailer Banner */}
            <div className="flex items-center justify-between rounded-[4px] border border-[#E7E6E0] bg-[#F4EFF0] px-4 py-3 text-xs">
              <div className="flex items-center gap-2 text-[#67474E]">
                <Store size={15} />
                <span className="font-semibold">
                  {shopName || "Kirana Account"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#67474E]">
                <Truck size={13} />
                <span>Delivery: Depot Delivery Truck</span>
              </div>
            </div>

            {/* Line Items Card */}
            <div className="rounded-[6px] border border-[#E7E6E0] bg-white shadow-2xs overflow-hidden">
              <div className="border-b border-[#E7E6E0] bg-[#FAF9F6] px-4 py-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#969892]">
                  Order Items ({items.length})
                </span>
              </div>

              <div className="divide-y divide-[#E7E6E0]">
                {items.map((item) => {
                  const isCase = item.quantity_unit === "CASE";
                  const multiplier = isCase ? item.units_per_case : 1;
                  const caseRate = item.price * item.units_per_case;
                  const lineTotal = item.price * item.quantity * multiplier;

                  return (
                    <article
                      key={`${item.product_id}-${item.quantity_unit}`}
                      className="p-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ProductThumbnail
                          name={item.name}
                          brandName={item.brand_name}
                          imageUrl={item.image_url}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold text-[#969892] uppercase">
                            {item.brand_name} · {item.sku}
                          </p>
                          <h3 className="font-bold text-xs text-[#242724] truncate">
                            {item.name}
                          </h3>
                          <p className="text-[11px] text-[#666864]">
                            {item.quantity} {item.quantity_unit}
                            {isCase && (
                              <span className="text-[#969892]">
                                {" "}({item.quantity * item.units_per_case} packs)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-bold text-xs text-[#242724] tabular-nums">
                          {formatCurrency(lineTotal)}
                        </p>
                        <p className="text-[10px] text-[#969892] tabular-nums">
                          {isCase ? `${formatCurrency(caseRate)}/cs` : `${formatCurrency(item.price)}/pc`}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            {/* Delivery Instructions */}
            <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-4 shadow-2xs">
              <label
                htmlFor="customer-note"
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#242724]"
              >
                <FileText size={13} className="text-[#79565D]" />
                <span>Delivery or Invoice Remarks (Optional)</span>
              </label>
              <textarea
                id="customer-note"
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                maxLength={1000}
                rows={3}
                className="mt-2 w-full rounded-[4px] border border-[#E7E6E0] bg-[#FBFBFA] px-3 py-2 text-xs text-[#242724] placeholder-[#969892] focus:border-[#79565D] focus:bg-white focus:outline-none"
                placeholder="e.g., Deliver before 2 PM, unload near grocery counter, urgent salt restock..."
              />
            </div>
          </div>

          {/* Right Summary Sidebar */}
          <aside className="space-y-4">
            <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#969892]">
                Order Total Estimate
              </h2>

              <div className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between text-[#666864]">
                  <span>Total Packs</span>
                  <span className="font-mono font-semibold text-[#242724] tabular-nums">
                    {totalPacks}
                  </span>
                </div>
                <div className="flex justify-between text-[#666864]">
                  <span>Subtotal</span>
                  <span className="font-mono font-semibold text-[#242724] tabular-nums">
                    {formatCurrency(subtotal)}
                  </span>
                </div>

                <div className="border-t border-[#E7E6E0] pt-2.5">
                  <div className="flex justify-between items-baseline font-bold text-[#242724]">
                    <span>Estimated Total</span>
                    <span className="text-base font-mono tabular-nums">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-[4px] border border-[#E7E6E0] bg-[#F6F5F1] p-3 text-[11px] leading-relaxed text-[#666864]">
                <div className="flex items-center gap-1 font-semibold text-[#242724] mb-1">
                  <Clock size={13} className="text-[#79565D]" />
                  <span>Desk Review</span>
                </div>
                Trade discounts, 10+1 free bottle promotions, and credit clearance will be computed directly by the Order Desk.
              </div>

              <button
                type="submit"
                disabled={!retailerId || isSubmitting}
                className="mt-5 w-full rounded-[4px] bg-[#79565D] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#67474E] disabled:cursor-not-allowed disabled:bg-[#D5D3CB] transition-colors"
              >
                {isSubmitting ? "Submitting to Depot..." : "Confirm & Send Order"}
              </button>
            </div>
          </aside>
        </form>
      )}
    </div>
  );
}
