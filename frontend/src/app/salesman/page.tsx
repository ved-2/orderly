"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";
import {
  CachedCatalogueItem,
  QueuedOrder,
  clearOfflineQueue,
  getCachedCatalogue,
  getOfflineQueue,
  queueOfflineOrder,
  removeOfflineOrder,
  saveCachedCatalogue,
} from "@/lib/offline-store";

interface RetailerOption {
  id: string;
  retailer_code: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
  credit_limit: number;
  current_outstanding: number;
  available_credit: number;
  payment_terms_days: number;
  pending_orders_count: number;
}

interface SalesmanOrder {
  id: string;
  order_number: string;
  retailer_id: string;
  shop_name: string;
  retailer_code: string;
  status: string;
  total_amount: number;
  items_count: number;
  created_at: string;
  submitted_at: string | null;
}

interface UserProfile {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
}

const ALLOWED_ROLES = new Set(["SALESMAN", "DISTRIBUTOR_ADMIN"]);

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatTime(isoString: string): string {
  if (!isoString) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(isoString));
}

export default function SalesmanPortalPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Network State
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueue, setOfflineQueue] = useState<QueuedOrder[]>([]);
  const [syncing, setSyncing] = useState(false);

  // Main UI State
  const [activeTab, setActiveTab] = useState<"ORDERING" | "HISTORY">("ORDERING");
  const [retailers, setRetailers] = useState<RetailerOption[]>([]);
  const [selectedRetailer, setSelectedRetailer] = useState<RetailerOption | null>(null);
  const [retailerSearch, setRetailerSearch] = useState("");

  // Catalogue & Cart State
  const [catalogue, setCatalogue] = useState<CachedCatalogueItem[]>([]);
  const [catalogueSearch, setCatalogueSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});
  const [customerNote, setCustomerNote] = useState("");
  const [showReviewModal, setShowReviewModal] = useState(false);

  // History State
  const [orderHistory, setOrderHistory] = useState<SalesmanOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // 1. Online / Offline Listener
  useEffect(() => {
    setIsOnline(navigator.onLine);
    setOfflineQueue(getOfflineQueue());

    const handleOnline = () => {
      setIsOnline(true);
      void syncPendingQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // 2. Authenticate user
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
          setError(err instanceof Error ? err.message : "Authentication error");
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

  // 3. Load retailers, catalogue, and history
  const loadPortalData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Try reading cached catalogue first for instantaneous rendering
      const cached = getCachedCatalogue();
      if (cached.items.length > 0) {
        setCatalogue(cached.items);
      }

      if (navigator.onLine) {
        const [retailersRes, catalogueRes, historyRes] = await Promise.all([
          apiRequest<{ items: RetailerOption[]; total: number }>("/salesman/retailers"),
          apiRequest<{ items: CachedCatalogueItem[]; total: number }>("/salesman/catalogue"),
          apiRequest<{ items: SalesmanOrder[]; total: number }>("/salesman/orders"),
        ]);

        setRetailers(retailersRes.items || []);
        if (retailersRes.items && retailersRes.items.length > 0 && !selectedRetailer) {
          setSelectedRetailer(retailersRes.items[0]);
        }

        const freshCatalogue = catalogueRes.items || [];
        setCatalogue(freshCatalogue);
        saveCachedCatalogue(freshCatalogue);

        setOrderHistory(historyRes.items || []);
      }
    } catch (err) {
      // If offline or network error, fallback to cached data
      const cached = getCachedCatalogue();
      if (cached.items.length > 0) {
        setCatalogue(cached.items);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load catalogue.");
      }
    } finally {
      setLoading(false);
      setOfflineQueue(getOfflineQueue());
    }
  }, [selectedRetailer]);

  useEffect(() => {
    if (profile && ALLOWED_ROLES.has(profile.role)) {
      void loadPortalData();
    }
  }, [profile, loadPortalData]);

  // 4. Quantity Adjustments
  const handleQuantityChange = (productId: string, delta: number) => {
    setCartQuantities((prev) => {
      const current = prev[productId] || 0;
      const updated = Math.max(0, current + delta);
      if (updated === 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: updated };
    });
  };

  const handleQuantityInput = (productId: string, val: string) => {
    const num = parseInt(val, 10);
    setCartQuantities((prev) => {
      if (isNaN(num) || num <= 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: num };
    });
  };

  // Cart Totals
  const cartEntries = Object.entries(cartQuantities);
  const totalCases = cartEntries.reduce((acc, [, qty]) => acc + qty, 0);

  const estimatedSubtotal = cartEntries.reduce((acc, [prodId, qty]) => {
    const prod = catalogue.find((p) => p.id === prodId);
    const casePrice = prod ? prod.price * prod.units_per_case : 0;
    return acc + casePrice * qty;
  }, 0);

  // 5. Submit Order (Online or Offline Queue)
  const handleSubmitOrder = async () => {
    if (!selectedRetailer || cartEntries.length === 0) return;
    setSubmittingOrder(true);
    setError(null);

    const idempotencyKey = `sls_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const orderPayload = {
      retailer_id: selectedRetailer.id,
      items: cartEntries.map(([productId, quantity]) => ({
        product_id: productId,
        quantity,
        quantity_unit: "CASE" as const,
      })),
      customer_note: customerNote || null,
      idempotency_key: idempotencyKey,
    };

    if (!navigator.onLine) {
      // Save directly to offline queue
      const queuedItem: QueuedOrder = {
        idempotency_key: idempotencyKey,
        retailer_id: selectedRetailer.id,
        shop_name: selectedRetailer.shop_name,
        items: cartEntries.map(([productId, quantity]) => {
          const prod = catalogue.find((p) => p.id === productId);
          return {
            product_id: productId,
            product_name: prod ? prod.name : "SKU",
            sku: prod ? prod.sku : "",
            quantity,
            quantity_unit: "CASE",
            price: prod ? prod.price * prod.units_per_case : 0,
          };
        }),
        customer_note: customerNote || null,
        estimated_total: estimatedSubtotal,
        queued_at: new Date().toISOString(),
      };

      queueOfflineOrder(queuedItem);
      setOfflineQueue(getOfflineQueue());
      setCartQuantities({});
      setCustomerNote("");
      setShowReviewModal(false);
      setSubmittingOrder(false);
      setFeedback("Order saved to Offline Queue. Will sync when connected.");
      setTimeout(() => setFeedback(null), 4000);
      return;
    }

    // Online submission
    try {
      const res = await apiRequest<{ order_number: string; message: string }>(
        "/salesman/orders",
        {
          method: "POST",
          body: JSON.stringify(orderPayload),
        }
      );

      setCartQuantities({});
      setCustomerNote("");
      setShowReviewModal(false);
      setFeedback(`Order ${res.order_number} submitted to Order Desk!`);
      setTimeout(() => setFeedback(null), 4000);
      void loadPortalData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place order.");
    } finally {
      setSubmittingOrder(false);
    }
  };

  // 6. Sync pending offline queue
  const syncPendingQueue = async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0 || syncing) return;
    setSyncing(true);
    setError(null);

    try {
      const payload = {
        orders: queue.map((q) => ({
          retailer_id: q.retailer_id,
          items: q.items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            quantity_unit: i.quantity_unit,
          })),
          customer_note: q.customer_note,
          idempotency_key: q.idempotency_key,
        })),
      };

      const res = await apiRequest<{
        synced_count: number;
        failed_count: number;
        synced: Array<{ order_number: string }>;
      }>("/salesman/orders/sync", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      clearOfflineQueue();
      setOfflineQueue([]);
      setFeedback(`Synced ${res.synced_count} offline orders successfully!`);
      setTimeout(() => setFeedback(null), 4000);
      void loadPortalData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync offline orders.");
    } finally {
      setSyncing(false);
    }
  };

  if (authLoading || profileLoading) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 text-xs text-gray-500">
        Authenticating salesman session...
      </main>
    );
  }

  if (!profile || !ALLOWED_ROLES.has(profile.role)) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-md border border-gray-200 bg-white p-6">
          <h1 className="text-base font-semibold text-gray-950">Access Restricted</h1>
          <p className="mt-2 text-xs text-gray-600">
            Only authorized Salesmen and Distributor Administrators can access the field portal.
          </p>
          <div className="mt-4">
            <Link
              href="/"
              className="bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white inline-block"
            >
              Return Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Filter Categories
  const categories = ["ALL", ...Array.from(new Set(catalogue.map((p) => p.category)))];

  // Filter Products
  const filteredCatalogue = catalogue.filter((p) => {
    const matchesCat = selectedCategory === "ALL" || p.category === selectedCategory;
    const term = catalogueSearch.toLowerCase();
    const matchesSearch =
      !term ||
      p.sku.toLowerCase().includes(term) ||
      p.name.toLowerCase().includes(term) ||
      p.brand_name.toLowerCase().includes(term);
    return matchesCat && matchesSearch;
  });

  // Filter Retailers
  const filteredRetailers = retailers.filter((r) => {
    const term = retailerSearch.toLowerCase();
    return (
      !term ||
      r.shop_name.toLowerCase().includes(term) ||
      r.retailer_code.toLowerCase().includes(term) ||
      r.owner_name.toLowerCase().includes(term)
    );
  });

  return (
    <main className="min-h-screen bg-[#F6F5F1] text-[#242724] pb-28">
      {/* 1. Mobile Header & Sync Bar */}
      <header className="sticky top-0 z-30 border-b border-[#E7E6E0] bg-white px-4 py-2.5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold tracking-wider uppercase text-gray-400">
              Orderly FMCG
            </span>
            <h1 className="text-sm font-bold text-gray-950">Field Sales Portal</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Pill */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                isOnline
                  ? "border border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border border-amber-300 bg-amber-50 text-amber-900"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isOnline ? "bg-emerald-600" : "bg-amber-600"
                }`}
              />
              {isOnline ? "Online" : "Offline"}
            </span>

            {/* Offline Queue Badge & Sync Button */}
            {offlineQueue.length > 0 && (
              <button
                onClick={syncPendingQueue}
                disabled={!isOnline || syncing}
                className="bg-amber-700 px-2.5 py-0.5 text-[11px] font-bold text-white hover:bg-amber-800 disabled:opacity-50"
              >
                {syncing ? "Syncing..." : `Sync (${offlineQueue.length})`}
              </button>
            )}

            <button
              onClick={async () => {
                await logout();
                router.replace("/register");
              }}
              className="border border-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600 hover:bg-gray-100"
            >
              Exit
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="mt-2.5 flex border-t border-gray-100 pt-2 text-xs">
          <button
            onClick={() => setActiveTab("ORDERING")}
            className={`flex-1 py-1 text-center font-semibold border-b-2 transition-colors ${
              activeTab === "ORDERING"
                ? "border-gray-900 text-gray-950"
                : "border-transparent text-gray-500"
            }`}
          >
            Beat Book & Order
          </button>
          <button
            onClick={() => setActiveTab("HISTORY")}
            className={`flex-1 py-1 text-center font-semibold border-b-2 transition-colors ${
              activeTab === "HISTORY"
                ? "border-gray-900 text-gray-950"
                : "border-transparent text-gray-500"
            }`}
          >
            Today&apos;s Booked Orders ({orderHistory.length})
          </button>
        </div>
      </header>

      {/* Notifications */}
      {feedback && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs font-semibold text-emerald-900">
          {feedback}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs font-semibold text-red-900">
          {error}
        </div>
      )}

      {/* TAB 1: ORDERING FLOW */}
      {activeTab === "ORDERING" && (
        <div className="p-3 space-y-3 max-w-2xl mx-auto">
          {/* STEP 1: RETAILER SELECTOR */}
          <div className="border border-gray-200 bg-white p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                1. Select Kirana Store
              </span>
              {selectedRetailer && (
                <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 border border-emerald-200">
                  Credit: {formatCurrency(selectedRetailer.available_credit)} Avail
                </span>
              )}
            </div>

            <div className="mt-2">
              <select
                value={selectedRetailer?.id || ""}
                onChange={(e) => {
                  const match = retailers.find((r) => r.id === e.target.value);
                  if (match) setSelectedRetailer(match);
                }}
                className="w-full border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-900 outline-none focus:border-gray-900"
              >
                {retailers.length === 0 ? (
                  <option value="">No Kirana stores available offline</option>
                ) : (
                  retailers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.shop_name} ({r.retailer_code}) - {r.owner_name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {selectedRetailer && (
              <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-600">
                <div>
                  <p className="font-medium text-gray-900">{selectedRetailer.address}</p>
                  <p className="text-gray-500">
                    Terms: {selectedRetailer.payment_terms_days} days &bull; Outstanding:{" "}
                    {formatCurrency(selectedRetailer.current_outstanding)}
                  </p>
                </div>
                {selectedRetailer.phone && (
                  <a
                    href={`tel:${selectedRetailer.phone}`}
                    className="border border-gray-300 bg-gray-50 px-2 py-1 text-[11px] font-semibold text-gray-800"
                  >
                    Call Shop
                  </a>
                )}
              </div>
            )}
          </div>

          {/* STEP 2: CATALOGUE SEARCH & SPEED ORDERING */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search SKU or Brand..."
                value={catalogueSearch}
                onChange={(e) => setCatalogueSearch(e.target.value)}
                className="flex-1 border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 outline-none focus:border-gray-900"
              />
            </div>

            {/* Category horizontal scrolling chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 whitespace-nowrap font-medium border text-[11px] ${
                    selectedCategory === cat
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {cat === "ALL" ? "All Products" : cat}
                </button>
              ))}
            </div>

            {/* Product List Cards */}
            <div className="space-y-2">
              {filteredCatalogue.length === 0 ? (
                <div className="border border-gray-200 bg-white p-6 text-center text-xs text-gray-500">
                  No SKUs match your search.
                </div>
              ) : (
                filteredCatalogue.map((p) => {
                  const currentQty = cartQuantities[p.id] || 0;
                  const firstScheme = p.schemes[0];

                  return (
                    <div
                      key={p.id}
                      className="border border-gray-200 bg-white p-3 shadow-2xs flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-bold text-gray-400">
                              {p.sku}
                            </span>
                            <span className="text-[10px] font-semibold text-gray-500">
                              &bull; {p.brand_name}
                            </span>
                          </div>
                          <h3 className="text-xs font-bold text-gray-950 mt-0.5">
                            {p.name}
                          </h3>
                          <p className="text-[11px] text-gray-500">
                            {p.pack_size} {p.pack_unit} &bull; {p.units_per_case} pcs/cs
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="font-mono text-sm font-bold text-gray-950">
                            {formatCurrency(p.price * p.units_per_case)}
                          </p>
                          <p className="text-[10px] text-gray-500 font-mono">
                            {formatCurrency(p.price)}/pc &bull; {p.units_per_case} pcs/cs
                          </p>
                        </div>
                      </div>

                      {/* Trade Scheme Callout */}
                      {firstScheme && (
                        <div className="border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] text-blue-900 font-medium">
                          <strong>Offer:</strong>{" "}
                          {firstScheme.scheme_type === "BUY_X_GET_Y" ? (
                            <span>
                              Buy {firstScheme.buy_quantity} cs &rarr; Get{" "}
                              <strong>{firstScheme.reward_quantity} Free</strong>
                            </span>
                          ) : (
                            <span>
                              Min {firstScheme.min_quantity} cs &rarr;{" "}
                              <strong>
                                {firstScheme.discount_type === "PERCENTAGE"
                                  ? `${firstScheme.discount_value}% Off`
                                  : `₹${firstScheme.discount_value} Off`}
                              </strong>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Quantity Stepper */}
                      <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                        <span className="text-[11px] text-gray-500">
                          Stock: {p.quantity_available} cs
                        </span>

                        <div className="flex items-center border border-gray-300">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(p.id, -1)}
                            className="px-2.5 py-1 text-xs font-bold bg-gray-50 text-gray-700 hover:bg-gray-100 border-r border-gray-200"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={currentQty === 0 ? "" : currentQty}
                            onChange={(e) => handleQuantityInput(p.id, e.target.value)}
                            placeholder="0"
                            className="w-12 text-center font-mono font-bold text-xs outline-none bg-white py-1"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(p.id, 1)}
                            className="px-2.5 py-1 text-xs font-bold bg-gray-50 text-gray-700 hover:bg-gray-100 border-l border-gray-200"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TODAY'S BOOKED ORDERS */}
      {activeTab === "HISTORY" && (
        <div className="p-3 space-y-3 max-w-2xl mx-auto">
          {/* Queued Offline Orders */}
          {offlineQueue.length > 0 && (
            <div className="border border-amber-300 bg-amber-50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Orders Queued Offline ({offlineQueue.length})
                </p>
                <button
                  onClick={syncPendingQueue}
                  disabled={!isOnline || syncing}
                  className="bg-amber-800 text-white px-2 py-0.5 text-[11px] font-bold disabled:opacity-50"
                >
                  {syncing ? "Syncing..." : "Sync All Now"}
                </button>
              </div>
              <div className="divide-y divide-amber-200 text-xs">
                {offlineQueue.map((q) => (
                  <div key={q.idempotency_key} className="py-2 flex justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{q.shop_name}</p>
                      <p className="text-[11px] text-gray-600">
                        {q.items.length} SKUs &bull; Queued {formatTime(q.queued_at)}
                      </p>
                    </div>
                    <div className="text-right font-mono font-bold text-gray-900">
                      {formatCurrency(q.estimated_total)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submitted Orders */}
          <div className="border border-gray-200 bg-white">
            <div className="p-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-600">
                Submitted Beat Orders
              </h2>
            </div>
            {orderHistory.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">
                No orders booked today yet.
              </div>
            ) : (
              <div className="divide-y divide-gray-200 text-xs">
                {orderHistory.map((o) => (
                  <div key={o.id} className="p-3 flex justify-between items-center">
                    <div>
                      <span className="font-mono font-bold text-gray-950">
                        {o.order_number}
                      </span>
                      <p className="font-semibold text-gray-800 mt-0.5">
                        {o.shop_name} ({o.retailer_code})
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {o.items_count} items &bull; Placed {formatTime(o.created_at)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-mono font-bold text-gray-950">
                        {formatCurrency(o.total_amount)}
                      </p>
                      <span
                        className={`inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          o.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                            : "bg-gray-100 text-gray-800 border border-gray-200"
                        }`}
                      >
                        {o.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FLOATING ACTION CART BAR */}
      {activeTab === "ORDERING" && totalCases > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-300 bg-white p-3 shadow-lg max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-500">
                {selectedRetailer?.shop_name || "Kirana"}
              </span>
              <p className="text-sm font-bold text-gray-950 font-mono">
                {totalCases} Cases &bull; ~{formatCurrency(estimatedSubtotal)}
              </p>
            </div>

            <button
              onClick={() => setShowReviewModal(true)}
              className="bg-gray-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-gray-800"
            >
              Review & Submit &rarr;
            </button>
          </div>
        </div>
      )}

      {/* REVIEW & SUBMIT MODAL */}
      {showReviewModal && selectedRetailer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md border border-gray-300 bg-white p-5 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div>
                <h2 className="text-sm font-bold text-gray-950">Confirm Order</h2>
                <p className="text-xs text-gray-600">{selectedRetailer.shop_name}</p>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="text-gray-400 font-mono text-sm hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 space-y-3 text-xs">
              {/* Line Items List */}
              <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto border border-gray-200 p-2">
                {cartEntries.map(([productId, quantity]) => {
                  const p = catalogue.find((item) => item.id === productId);
                  if (!p) return null;
                  return (
                    <div key={productId} className="py-1.5 flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-gray-900">{p.name}</p>
                        <p className="text-[11px] text-gray-500 font-mono">
                          {quantity} cs ({quantity * p.units_per_case} pcs) &times; {formatCurrency(p.price * p.units_per_case)}/cs
                        </p>
                      </div>
                      <div className="font-mono font-bold text-gray-950">
                        {formatCurrency(p.price * p.units_per_case * quantity)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Delivery Note */}
              <div>
                <label className="block font-medium text-gray-700">
                  Delivery / Beat Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Deliver before 2 PM, Kirana requested urgent stock"
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  className="mt-1 w-full border border-gray-300 px-3 py-1.5 text-xs text-gray-900 outline-none focus:border-gray-900"
                />
              </div>

              {/* Total Summary */}
              <div className="p-3 border border-gray-200 bg-gray-50 space-y-1">
                <div className="flex justify-between font-bold text-sm text-gray-950">
                  <span>Estimated Total:</span>
                  <span className="font-mono">{formatCurrency(estimatedSubtotal)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>Available Credit:</span>
                  <span className="font-mono text-emerald-800">
                    {formatCurrency(selectedRetailer.available_credit)}
                  </span>
                </div>
              </div>

              {/* Mode Notice */}
              <p className="text-[11px] text-gray-500">
                {isOnline
                  ? "Order will be submitted directly to Order Desk for immediate review."
                  : "Device is offline. Order will be queued locally and synced when connection returns."}
              </p>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitOrder}
                  disabled={submittingOrder}
                  className="bg-gray-900 px-5 py-2 text-xs font-bold text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {submittingOrder
                    ? "Placing Order..."
                    : isOnline
                    ? "Place Order Now"
                    : "Save to Offline Queue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
