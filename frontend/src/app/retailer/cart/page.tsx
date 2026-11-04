"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  Package,
  ShieldCheck,
} from "lucide-react";

import {
  clearCart,
  getCart,
  removeFromCart,
  updateCartQuantity,
  type CartItem,
} from "@/lib/cart";
import { Badge } from "@/components/ui/badge";
import { ProductThumbnail } from "@/components/ui/product-thumbnail";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function RetailerCartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(getCart());
    setHydrated(true);

    const syncCart = () => setItems(getCart());

    window.addEventListener("orderly-cart-updated", syncCart);
    window.addEventListener("storage", syncCart);

    return () => {
      window.removeEventListener("orderly-cart-updated", syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, []);

  const subtotal = useMemo(
    () =>
      items.reduce((total, item) => {
        const multiplier =
          item.quantity_unit === "CASE" ? item.units_per_case : 1;
        return total + item.price * item.quantity * multiplier;
      }, 0),
    [items]
  );

  const totalUnits = useMemo(
    () =>
      items.reduce(
        (total, item) =>
          total +
          item.quantity *
            (item.quantity_unit === "CASE" ? item.units_per_case : 1),
        0
      ),
    [items]
  );

  function handleQuantityChange(item: CartItem, value: number) {
    if (!Number.isInteger(value) || value < 1) {
      setError("Please enter a valid positive quantity.");
      return;
    }

    try {
      updateCartQuantity(item.product_id, item.quantity_unit, value);
      setItems(getCart());
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update quantity."
      );
    }
  }

  function handleRemove(item: CartItem) {
    removeFromCart(item.product_id, item.quantity_unit);
    setItems(getCart());
    setError("");
  }

  function handleClearCart() {
    clearCart();
    setItems([]);
    setError("");
  }

  if (!hydrated) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
        <div className="h-8 w-48 animate-pulse rounded bg-[#E7E6E0]" />
        <div className="mt-6 h-64 animate-pulse rounded bg-[#E7E6E0]" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#E7E6E0] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#666864]">
            <Link
              href="/retailer/catalogue"
              className="inline-flex items-center gap-1 hover:text-[#242724] transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Back to Catalogue</span>
            </Link>
            <span>/</span>
            <span className="text-[#242724]">Cart</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#242724]">
            Order Basket
          </h1>
          <p className="mt-0.5 text-xs text-[#666864]">
            Review line items and wholesale pack quantities before routing to the Order Desk.
          </p>
        </div>

        {items.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClearCart}
              className="text-xs font-semibold text-[#8C2828] hover:text-[#681C1C] transition-colors"
            >
              Clear Basket
            </button>
            <Link
              href="/retailer/catalogue"
              className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#E7E6E0] bg-white px-3 py-1.5 text-xs font-semibold text-[#242724] hover:bg-[#F0EFEA] transition-colors"
            >
              <Plus size={13} />
              Add More Items
            </Link>
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-[4px] border border-[#EDBCBC] bg-[#FBF0F0] px-4 py-3 text-xs font-medium text-[#8C2828]"
        >
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-[6px] border border-[#E7E6E0] bg-white px-6 py-20 text-center shadow-2xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F4EFF0] text-[#79565D]">
            <ShoppingCart size={26} />
          </div>
          <h2 className="mt-4 text-base font-bold text-[#242724]">
            Your order basket is empty
          </h2>
          <p className="mt-1 max-w-sm mx-auto text-xs text-[#666864]">
            Browse the Jabalpur FMCG depot catalogue to add brand cases, staple packs, and promotional scheme items.
          </p>
          <Link
            href="/retailer/catalogue"
            className="mt-6 inline-flex items-center gap-2 rounded-[4px] bg-[#79565D] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#67474E] transition-colors shadow-2xs"
          >
            <Package size={14} />
            Browse Wholesale Catalogue
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
          {/* Cart Lines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#969892]">
                {items.length} {items.length === 1 ? "Line Item" : "Line Items"}
              </span>
              <span className="text-xs text-[#666864]">
                Depot: <strong className="text-[#242724]">Jabalpur Central</strong>
              </span>
            </div>

            <div className="divide-y divide-[#E7E6E0] rounded-[6px] border border-[#E7E6E0] bg-white shadow-2xs overflow-hidden">
              {items.map((item) => {
                const isCase = item.quantity_unit === "CASE";
                const multiplier = isCase ? item.units_per_case : 1;
                const caseRate = item.price * item.units_per_case;
                const lineTotal = item.price * item.quantity * multiplier;

                return (
                  <article
                    key={`${item.product_id}-${item.quantity_unit}`}
                    className="p-4 sm:p-5 transition-colors hover:bg-[#FBFBFA]"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      {/* Product Thumbnail + Information */}
                      <div className="flex items-start gap-3.5 min-w-0">
                        <ProductThumbnail
                          name={item.name}
                          brandName={item.brand_name}
                          imageUrl={item.image_url}
                          size="md"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px]">
                              {item.brand_name}
                            </Badge>
                            <span className="font-mono text-[10px] text-[#969892]">
                              {item.sku}
                            </span>
                          </div>

                          <h2 className="mt-1 font-bold text-sm text-[#242724] truncate">
                            {item.name}
                          </h2>

                          <p className="mt-0.5 text-xs text-[#666864]">
                            {item.pack_size} {item.pack_unit} per pack
                            {isCase && (
                              <span className="text-[#969892]">
                                {" · "}{item.units_per_case} packs / case
                              </span>
                            )}
                          </p>

                          {/* Unit Rates */}
                          <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-xs font-bold text-[#242724] tabular-nums">
                              {isCase ? formatCurrency(caseRate) : formatCurrency(item.price)}
                              <span className="text-[11px] font-normal text-[#666864]">
                                {isCase ? " / case" : " / pack"}
                              </span>
                            </span>
                            {isCase && (
                              <span className="text-[11px] text-[#969892] tabular-nums">
                                ({formatCurrency(item.price)} / pack)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quantity Stepper & Line Total */}
                      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-4 border-t border-[#F0EFEA] pt-3 sm:border-0 sm:pt-0">
                        {/* Stepper */}
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() =>
                              handleQuantityChange(item, item.quantity - 1)
                            }
                            disabled={item.quantity <= 1}
                            className="flex h-8 w-8 items-center justify-center rounded-l-[4px] border border-[#E7E6E0] bg-[#F6F5F1] text-[#242724] hover:bg-[#EAE8E1] disabled:opacity-40 transition-colors"
                            title="Decrease quantity"
                          >
                            <Minus size={13} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleQuantityChange(item, Number(e.target.value))
                            }
                            className="h-8 w-14 border-y border-[#E7E6E0] bg-white text-center font-mono text-xs font-bold text-[#242724] focus:outline-none focus:ring-1 focus:ring-[#79565D]"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleQuantityChange(item, item.quantity + 1)
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-r-[4px] border border-[#E7E6E0] bg-[#F6F5F1] text-[#242724] hover:bg-[#EAE8E1] transition-colors"
                            title="Increase quantity"
                          >
                            <Plus size={13} />
                          </button>
                          <span className="ml-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#666864]">
                            {item.quantity_unit}
                          </span>
                        </div>

                        {/* Line Total */}
                        <div className="text-right min-w-[90px]">
                          <p className="text-[10px] uppercase font-bold tracking-wider text-[#969892]">
                            Line Total
                          </p>
                          <p className="text-sm font-bold text-[#242724] tabular-nums">
                            {formatCurrency(lineTotal)}
                          </p>
                        </div>

                        {/* Remove Action */}
                        <button
                          type="button"
                          onClick={() => handleRemove(item)}
                          className="flex h-8 w-8 items-center justify-center rounded-[4px] text-[#969892] hover:bg-[#FBF0F0] hover:text-[#8C2828] transition-colors"
                          title="Remove item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {isCase && (
                      <p className="mt-2.5 text-[11px] text-[#969892]">
                        Total: <span className="font-semibold text-[#666864] tabular-nums">{item.quantity * item.units_per_case} individual packs</span> will be reserved from depot stock.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </div>

          {/* Aside Order Summary */}
          <aside className="space-y-4">
            <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#969892]">
                Order Summary
              </h2>

              <div className="mt-4 space-y-2.5 text-xs">
                <div className="flex justify-between text-[#666864]">
                  <span>Total Cart Lines</span>
                  <span className="font-mono font-semibold text-[#242724]">
                    {items.length}
                  </span>
                </div>

                <div className="flex justify-between text-[#666864]">
                  <span>Total Units / Packs</span>
                  <span className="font-mono font-semibold text-[#242724] tabular-nums">
                    {totalUnits}
                  </span>
                </div>

                <div className="border-t border-[#E7E6E0] pt-2.5 flex justify-between text-xs text-[#666864]">
                  <span>Estimated Subtotal</span>
                  <span className="font-mono font-semibold text-[#242724] tabular-nums">
                    {formatCurrency(subtotal)}
                  </span>
                </div>

                <div className="border-t border-[#E7E6E0] pt-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-bold text-[#242724]">
                      Estimated Total
                    </span>
                    <span className="text-base font-bold text-[#242724] tabular-nums font-mono">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Order desk note */}
              <div className="mt-4 rounded-[4px] border border-[#E7E6E0] bg-[#F6F5F1] p-3 text-[11px] leading-relaxed text-[#666864]">
                <div className="flex items-center gap-1.5 font-semibold text-[#242724] mb-1">
                  <ShieldCheck size={14} className="text-[#79565D]" />
                  <span>Depot Verification</span>
                </div>
                GST, active trade schemes (e.g. 10+1 free), and Kirana credit eligibility will be applied when reviewed by the Order Desk.
              </div>

              {/* Checkout Button */}
              <Link
                href="/retailer/checkout"
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-[4px] bg-[#79565D] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#67474E] transition-colors"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
