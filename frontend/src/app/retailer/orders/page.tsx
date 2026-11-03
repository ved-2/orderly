"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";

interface OrderLine {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  quantity_unit: "CASE" | "PIECE";
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function RetailerOrdersPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [orders, setOrders] = useState<RetailerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOrders = useCallback(async () => {
    try {
      const response = await apiRequest<OrdersResponse>("/orders");
      setOrders(response.items);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load your orders.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  function handleRetry() {
    setIsLoading(true);
    setError("");
    void fetchOrders();
  }

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/register");
      return;
    }

    // The request updates loading state only after its asynchronous response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchOrders();
  }, [user, loading, router, fetchOrders]);

  if (loading || (isLoading && orders.length === 0 && !error)) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <p className="text-sm text-neutral-500">Loading your orders...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 pb-28 sm:px-6 md:pb-8">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">Retailer / My Orders</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
            My orders
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            View your order drafts and their current status.
          </p>
        </div>
        <Link
          href="/retailer/catalogue"
          className="border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          Browse catalogue
        </Link>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-5 border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-2 font-semibold underline"
          >
            Try again
          </button>
        </div>
      )}

      {isLoading && orders.length > 0 && (
        <p className="mb-4 text-sm text-neutral-500">Refreshing orders...</p>
      )}

      {!error && orders.length === 0 ? (
        <section className="border border-neutral-200 bg-white px-6 py-16 text-center">
          <h2 className="font-semibold text-neutral-950">No orders yet</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Your submitted order drafts will appear here.
          </p>
          <Link
            href="/retailer/catalogue"
            className="mt-6 inline-block bg-neutral-900 px-5 py-3 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Browse products
          </Link>
        </section>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <article
              key={order.id}
              className="border border-neutral-200 bg-white"
            >
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 p-4 sm:p-5">
                <div>
                  <h2 className="font-semibold text-neutral-950">
                    {order.order_number}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    Created {formatDate(order.created_at)}
                  </p>
                </div>
                <span className="border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-700">
                  {order.status.replaceAll("_", " ")}
                </span>
              </header>

              <div className="divide-y divide-neutral-100">
                {order.lines.map((line) => (
                  <div
                    key={`${order.id}-${line.product_id}-${line.sku}`}
                    className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-900">
                        {line.product_name}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {line.sku} · {line.quantity} {line.quantity_unit}
                        {Number(line.free_quantity) > 0 &&
                          ` · ${line.free_quantity} free`}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-neutral-800">
                      {formatCurrency(Number(line.line_total))}
                    </p>
                  </div>
                ))}
              </div>

              {order.customer_note && (
                <p className="border-t border-neutral-100 px-4 py-3 text-sm text-neutral-600 sm:px-5">
                  <span className="font-medium text-neutral-800">Note:</span>{" "}
                  {order.customer_note}
                </p>
              )}

              <footer className="flex flex-wrap justify-end gap-x-6 gap-y-2 border-t border-neutral-100 bg-neutral-50 px-4 py-4 text-sm sm:px-5">
                <span className="text-neutral-600">
                  Subtotal: {formatCurrency(Number(order.subtotal))}
                </span>
                <span className="font-semibold text-neutral-950">
                  Total: {formatCurrency(Number(order.total_amount))}
                </span>
              </footer>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
