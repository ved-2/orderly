"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";
import { clearCart, getCart, type CartItem } from "@/lib/cart";

interface RetailerProfile {
  retailer_id: string | null;
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

export default function RetailerCheckoutPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [retailerId, setRetailerId] = useState<string | null>(null);
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
        setItems(getCart());
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load checkout.",
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!retailerId) {
      setError("No retailer account is linked to this user.");
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
        },
      );

      clearCart();
      setItems([]);
      setOrder(createdOrder);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit your order.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading || isLoading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-sm text-gray-500">Loading checkout...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <p className="text-sm text-gray-500">Retailer / Checkout</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950">
          Review your order
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Prices, stock and schemes are verified by the server when you submit.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {!retailerId && !order && items.length > 0 && (
        <div
          role="alert"
          className="mb-5 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          No retailer account is linked to this user. Please complete retailer
          registration before placing an order.
        </div>
      )}

      {order ? (
        <section className="border border-green-200 bg-white p-5 sm:p-6">
          <p className="text-sm font-medium text-green-700">
            Order draft created
          </p>
          <h2 className="mt-2 text-xl font-semibold text-gray-950">
            {order.order_number}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Status: {order.status}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Server-calculated total: ₹{Number(order.total_amount).toFixed(2)}
          </p>
          <Link
            href="/retailer/catalogue"
            className="mt-6 inline-block bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-800"
          >
            Continue shopping
          </Link>
        </section>
      ) : items.length === 0 ? (
        <section className="border border-gray-200 bg-white px-6 py-12 text-center">
          <h2 className="font-semibold text-gray-950">Your cart is empty</h2>
          <p className="mt-2 text-sm text-gray-500">
            Add products to your cart before checking out.
          </p>
          <Link
            href="/retailer/catalogue"
            className="mt-6 inline-block bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-800"
          >
            Browse catalogue
          </Link>
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="divide-y divide-gray-200 border border-gray-200 bg-white">
            {items.map((item) => {
              const multiplier =
                item.quantity_unit === "CASE" ? item.units_per_case : 1;
              const lineTotal = item.price * item.quantity * multiplier;

              return (
                <article
                  key={`${item.product_id}-${item.quantity_unit}`}
                  className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5"
                >
                  <div>
                    <p className="text-xs text-gray-500">
                      {item.brand_name} · {item.sku}
                    </p>
                    <h2 className="mt-1 font-medium text-gray-950">
                      {item.name}
                    </h2>
                    <p className="mt-1 text-sm text-gray-600">
                      {item.quantity} {item.quantity_unit.toLowerCase()}
                      {item.quantity > 1 ? "s" : ""}
                    </p>
                  </div>
                  <p className="font-semibold text-gray-950">
                    ₹{lineTotal.toFixed(2)}
                  </p>
                </article>
              );
            })}
          </section>

          <section className="border border-gray-200 bg-white p-4 sm:p-5">
            <label
              htmlFor="customer-note"
              className="block text-sm font-medium text-gray-800"
            >
              Note for the distributor (optional)
            </label>
            <textarea
              id="customer-note"
              value={customerNote}
              onChange={(event) => setCustomerNote(event.target.value)}
              maxLength={1000}
              rows={4}
              className="mt-2 w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
              placeholder="Add delivery or order instructions"
            />
          </section>

          <section className="border border-gray-200 bg-white p-4 sm:p-5">
            <div className="flex justify-between font-semibold text-gray-950">
              <span>Cart estimate</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              This is a cart snapshot only. The server recalculates the final
              price, tax, schemes and stock for the order.
            </p>
            <button
              type="submit"
              disabled={!retailerId || isSubmitting}
              className="mt-5 w-full bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isSubmitting ? "Submitting order..." : "Submit order"}
            </button>
          </section>
        </form>
      )}
    </main>
  );
}
