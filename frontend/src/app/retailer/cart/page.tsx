
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  clearCart,
  getCart,
  removeFromCart,
  updateCartQuantity,
  type CartItem,
} from "@/lib/cart";

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

  function handleQuantityChange(item: CartItem, value: string) {
    const quantity = Number(value);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("Enter a valid positive whole-number quantity.");
      return;
    }

    try {
      updateCartQuantity(
        item.product_id,
        item.quantity_unit,
        quantity
      );
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
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <p className="text-sm text-gray-500">Loading your cart...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">Retailer / Cart</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950">
            Your cart
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Review your products and quantities before placing an order.
          </p>
        </div>

        <Link
          href="/retailer/catalogue"
          className="border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          Continue shopping
        </Link>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <section className="border border-gray-200 bg-white px-6 py-16 text-center">
          <h2 className="text-lg font-semibold text-gray-900">
            Your cart is empty
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Browse the catalogue and add products to start an order.
          </p>
          <Link
            href="/retailer/catalogue"
            className="mt-6 inline-block bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-800"
          >
            Browse catalogue
          </Link>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
          <section className="min-w-0">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">
                {items.length} cart lines
              </p>

              <button
                type="button"
                onClick={handleClearCart}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Clear cart
              </button>
            </div>

            <div className="divide-y divide-gray-200 border border-gray-200 bg-white">
              {items.map((item) => {
                const multiplier =
                  item.quantity_unit === "CASE"
                    ? item.units_per_case
                    : 1;

                const lineTotal =
                  item.price * item.quantity * multiplier;

                return (
                  <article
                    key={`${item.product_id}-${item.quantity_unit}`}
                    className="p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          {item.brand_name} · {item.sku}
                        </p>

                        <h2 className="mt-1 font-semibold text-gray-900">
                          {item.name}
                        </h2>

                        <p className="mt-1 text-sm text-gray-500">
                          {item.pack_size} {item.pack_unit} per pack
                          {" · "}
                          {item.units_per_case} packs per case
                        </p>

                        <p className="mt-2 text-sm text-gray-700">
                          ₹{item.price.toFixed(2)} per pack
                        </p>
                      </div>

                      <div className="flex flex-wrap items-end gap-4 sm:items-start">
                        <div>
                          <label
                            htmlFor={`quantity-${item.product_id}-${item.quantity_unit}`}
                            className="mb-1 block text-xs text-gray-500"
                          >
                            Quantity ({item.quantity_unit})
                          </label>

                          <input
                            id={`quantity-${item.product_id}-${item.quantity_unit}`}
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(event) =>
                              handleQuantityChange(item, event.target.value)
                            }
                            className="w-24 border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
                          />
                        </div>

                        <div className="min-w-24">
                          <p className="text-xs text-gray-500">Line total</p>
                          <p className="mt-1 font-semibold text-gray-950">
                            ₹{lineTotal.toFixed(2)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemove(item)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-gray-500">
                      {item.quantity_available} individual packs currently
                      available in the cart snapshot.
                    </p>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="h-fit border border-gray-200 bg-white p-5">
            <h2 className="font-semibold text-gray-950">
              Order summary
            </h2>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Total cart lines</span>
                <span>{items.length}</span>
              </div>

              <div className="flex justify-between text-gray-600">
                <span>Total individual packs</span>
                <span>{totalUnits}</span>
              </div>

              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between font-semibold text-gray-950">
                  <span>Estimated total</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-gray-500">
              Final pricing, GST, applicable schemes, credit eligibility
              and stock will be recalculated by the server before order
              submission.
            </p>

            <Link
              href="/retailer/checkout"
              className="mt-5 block w-full bg-gray-900 px-4 py-3 text-center text-sm font-medium text-white hover:bg-gray-800"
            >
              Proceed to checkout
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}
