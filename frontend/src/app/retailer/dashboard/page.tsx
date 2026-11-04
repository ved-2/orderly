"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Truck,
  Wallet,
  ArrowRight,
  Mic,
  MessageSquareText,
  Camera,
  Coffee,
  Apple,
  Droplets,
  Sparkles,
  Cookie,
  Wheat,
  ShoppingBag,
  Plus,
  Package,
  ChevronRight,
  ChevronLeft,
  Check,
  Clock,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";
import { addToCart } from "@/lib/cart";
import { Badge } from "@/components/ui/badge";
import { ProductThumbnail } from "@/components/ui/product-thumbnail";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface UserProfile {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  retailer_id: string | null;
  retailer_registration_status: string | null;
}

interface RetailerOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  lines: Array<{
    product_id: string;
    product_name: string;
    sku: string;
    quantity: number;
    quantity_unit: string;
    unit_price: number;
  }>;
}

interface OrdersResponse {
  items: RetailerOrder[];
  total: number;
}

interface CreditRetailer {
  id: string;
  shop_name: string;
  owner_name: string;
  retailer_code: string;
  phone: string;
}

interface CreditSummary {
  credit_limit: number;
  current_outstanding: number;
  available_credit: number;
  utilization_percentage: number;
  payment_terms_days: number;
  account_status: string;
  retailer: CreditRetailer;
}

interface LedgerResponse {
  summary: CreditSummary;
}

interface CatalogueProduct {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string;
  brand_id: string;
  brand_name: string;
  pack_size: number;
  pack_unit: string;
  units_per_case: number;
  hsn_code: string | null;
  gst_rate: number | null;
  price: number | null;
  gst_included: boolean | null;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  is_in_stock: boolean;
}

interface CatalogueResponse {
  items: CatalogueProduct[];
  total: number;
  page: number;
  page_size: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Beverages: Coffee,
  "Dairy & Beverages": Coffee,
  Snacks: Cookie,
  "Biscuits & Snacks": Cookie,
  Staples: Wheat,
  "Atta & Staples": Wheat,
  "Personal Care": Sparkles,
  "Home Care": Droplets,
  "Health & Wellness": Apple,
  Confectionery: Cookie,
};

function getCategoryIcon(category: string): React.ElementType {
  return CATEGORY_ICONS[category] || Package;
}

const QUICK_SEARCH_CHIPS = ["Tea & Coffee", "Salt", "Spices", "Biscuits", "Atta"];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function RetailerDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [creditSummary, setCreditSummary] = useState<CreditSummary | null>(null);
  const [orders, setOrders] = useState<RetailerOrder[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueProduct[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());

  const categoryScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/register");
      return;
    }

    let cancelled = false;

    async function loadData() {
      try {
        const result = await apiRequest<UserProfile>("/auth/me");
        if (cancelled) return;

        if (result.role !== "RETAILER" || !result.retailer_id) {
          router.replace("/register");
          return;
        }

        setProfile(result);

        // Parallel fetches
        const [creditRes, ordersRes, catRes] = await Promise.allSettled([
          apiRequest<LedgerResponse>("/retailer/credit/ledger?limit=1"),
          apiRequest<OrdersResponse>("/orders"),
          apiRequest<CatalogueResponse>("/products/catalogue?page=1&page_size=100"),
        ]);

        if (cancelled) return;

        if (creditRes.status === "fulfilled" && creditRes.value.summary) {
          setCreditSummary(creditRes.value.summary);
        }
        if (ordersRes.status === "fulfilled") {
          setOrders(ordersRes.value.items);
        }
        if (catRes.status === "fulfilled") {
          setCatalogue(
            catRes.value.items.map((p) => ({
              ...p,
              is_in_stock: Number(p.quantity_available) > 0,
            }))
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load retailer dashboard."
          );
        }
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [user, loading, router]);

  /* Derived data */
  const retailerName =
    creditSummary?.retailer?.owner_name ||
    creditSummary?.retailer?.shop_name ||
    "";
  const shopName = creditSummary?.retailer?.shop_name || "";

  const deliveryOrders = useMemo(
    () => orders.filter((o) => o.status === "APPROVED" || o.status === "DISPATCHED"),
    [orders]
  );

  const categories = useMemo(() => {
    const cats = new Set<string>();
    catalogue.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [catalogue]);

  // Build "Buy Again" list from past order line items, deduped by product name
  const buyAgainProducts = useMemo(() => {
    const seen = new Map<
      string,
      {
        product_name: string;
        sku: string;
        quantity_unit: string;
        unit_price: number;
        product_id: string;
      }
    >();
    for (const order of orders) {
      if (!order.lines) continue;
      for (const line of order.lines) {
        if (!seen.has(line.product_name)) {
          seen.set(line.product_name, {
            product_name: line.product_name,
            sku: line.sku,
            quantity_unit: line.quantity_unit,
            unit_price: line.unit_price,
            product_id: line.product_id,
          });
        }
      }
    }
    return Array.from(seen.values())
      .map((item) => {
        const catProduct = catalogue.find(
          (p) =>
            String(p.id) === String(item.product_id) ||
            p.sku === item.sku ||
            p.name.toLowerCase() === item.product_name.toLowerCase()
        );
        return { ...item, catProduct };
      })
      .slice(0, 12);
  }, [orders, catalogue]);

  const creditUtilization = creditSummary?.utilization_percentage || 0;
  const creditBarColor =
    creditUtilization > 85
      ? "bg-[#8C2828]"
      : creditUtilization > 60
      ? "bg-[#D97706]"
      : "bg-[#205234]";
  const creditBadgeVariant =
    creditUtilization > 85
      ? "danger"
      : creditUtilization > 60
      ? "warning"
      : "success";

  /* Handlers */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      router.push(`/retailer/catalogue?search=${encodeURIComponent(searchInput.trim())}`);
    } else {
      router.push("/retailer/catalogue");
    }
  };

  const handleChipClick = (term: string) => {
    setSearchInput(term);
    router.push(`/retailer/catalogue?search=${encodeURIComponent(term)}`);
  };

  const scrollCategories = (direction: "left" | "right") => {
    if (categoryScrollRef.current) {
      const offset = direction === "left" ? -260 : 260;
      categoryScrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  const handleQuickAdd = (item: typeof buyAgainProducts[0]) => {
    if (!item.catProduct || item.catProduct.price === null) return;
    const p = item.catProduct;
    const isAvailable = p.is_in_stock ?? (Number(p.quantity_available) > 0);
    if (!isAvailable) return;
    try {
      addToCart({
        product_id: String(p.id),
        sku: p.sku,
        name: p.name,
        brand_name: p.brand_name,
        pack_size: p.pack_size,
        pack_unit: p.pack_unit,
        units_per_case: p.units_per_case,
        price: Number(p.price),
        gst_included: p.gst_included ?? false,
        quantity_available: Number(p.quantity_available),
        quantity: 1,
        quantity_unit: "CASE",
      });
      setAddedProducts((prev) => new Set(prev).add(String(p.id)).add(item.product_id));
      setTimeout(() => {
        setAddedProducts((prev) => {
          const next = new Set(prev);
          next.delete(String(p.id));
          next.delete(item.product_id);
          return next;
        });
      }, 1500);
    } catch {
      /* stock exceeded */
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Loading State                                                    */
  /* ---------------------------------------------------------------- */

  if (loading || pageLoading) {
    return (
      <div className="w-full px-4 py-4 sm:px-6 sm:py-6">
        <div className="mb-5">
          <div className="h-3 w-24 animate-pulse rounded bg-[#E7E6E0]" />
          <div className="mt-2 h-7 w-60 animate-pulse rounded bg-[#E7E6E0]" />
          <div className="mt-1.5 h-3.5 w-64 animate-pulse rounded bg-[#E7E6E0]" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="h-28 animate-pulse rounded-[4px] bg-[#E7E6E0]" />
          <div className="h-28 animate-pulse rounded-[4px] bg-[#E7E6E0]" />
        </div>
        <div className="h-11 animate-pulse rounded-[4px] bg-[#E7E6E0] mb-5" />
        <div className="flex gap-2 mb-5 overflow-hidden">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-9 w-28 animate-pulse rounded-[4px] bg-[#E7E6E0] shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Error State                                                      */
  /* ---------------------------------------------------------------- */

  if (error || !profile) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center px-4">
        <div className="w-full max-w-md rounded-[6px] border border-[#EDBCBC] bg-[#FBF0F0] p-6 text-center">
          <h2 className="text-sm font-bold text-[#8C2828]">
            Unable to open dashboard
          </h2>
          <p className="mt-1 text-xs text-[#8C2828]/80">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-[4px] bg-[#8C2828] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7A2020] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Main Responsive Dashboard                                        */
  /* ---------------------------------------------------------------- */

  return (
    <div className="w-full px-4 py-4 sm:px-6 sm:py-6 space-y-5 sm:space-y-6">

      {/* ── 1. Header: Retailer Greeting ───────────────────────── */}
      <section className="border-b border-[#E7E6E0] pb-4">
        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-[#969892]">
          WELCOME BACK
        </p>
        <h1 className="mt-0.5 text-xl sm:text-2xl font-bold tracking-tight text-[#242724] leading-tight">
          Namaste, {retailerName || "Kirana Partner"} 👋
        </h1>
        <p className="mt-1 text-xs sm:text-[13px] text-[#666864]">
          Here&apos;s what&apos;s available for your shop today.
          {shopName && (
            <span className="font-semibold text-[#242724]">
              {" "}— {shopName}
            </span>
          )}
        </p>
      </section>

      {/* ── 2. Two Side-by-Side Cards (Available Credit & Delivery) ── */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Available Credit Card */}
        <Link
          href="/retailer/credit"
          className="group rounded-[6px] border border-[#E7E6E0] bg-white p-3.5 sm:p-4 shadow-2xs hover:border-[#79565D] transition-colors"
        >
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#969892]">
              Available Credit
            </span>
            <Wallet size={15} className="text-[#79565D]" />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
            <p className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-[#242724] leading-tight">
              {creditSummary ? formatCurrency(creditSummary.available_credit) : "₹0"}
            </p>
            <span className="text-[10px] sm:text-xs text-[#666864] font-mono tabular-nums">
              Limit: {creditSummary ? formatCurrency(creditSummary.credit_limit) : "₹0"}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mt-2.5 h-1.5 sm:h-2 w-full rounded-full bg-[#F0EFEA] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${creditBarColor}`}
              style={{ width: `${Math.min(creditUtilization, 100)}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] sm:text-[11px]">
            <Badge variant={creditBadgeVariant as "success" | "warning" | "danger"} className="text-[9px] sm:text-[10px] px-1.5 py-0">
              {creditUtilization.toFixed(0)}% used
            </Badge>
            <span className="font-mono text-[#666864] hidden sm:inline">
              Outstanding: {creditSummary ? formatCurrency(creditSummary.current_outstanding) : "₹0"}
            </span>
            <span className="text-[#969892] group-hover:text-[#79565D] flex items-center gap-0.5">
              Passbook <ChevronRight size={11} />
            </span>
          </div>
        </Link>

        {/* Out for Delivery Card */}
        <Link
          href="/retailer/orders"
          className="group rounded-[6px] border border-[#E7E6E0] bg-white p-3.5 sm:p-4 shadow-2xs hover:border-[#79565D] transition-colors"
        >
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#969892]">
              Out for Delivery
            </span>
            <Truck size={15} className="text-[#205234]" />
          </div>

          <div className="flex items-baseline gap-2">
            <p className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-[#242724] leading-tight">
              {deliveryOrders.length}
            </p>
            <span className="text-[10px] sm:text-xs text-[#666864]">
              {deliveryOrders.length === 1 ? "order" : "orders"} arriving today
            </span>
          </div>

          {/* Order Preview Lines */}
          <div className="mt-2 space-y-1">
            {deliveryOrders.length > 0 ? (
              deliveryOrders.slice(0, 2).map((o) => (
                <div key={o.id} className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono">
                  <span className="font-bold text-[#242724] truncate mr-2">
                    {o.order_number}
                  </span>
                  <Badge variant="success" className="text-[8px] sm:text-[9px] px-1 py-0 shrink-0">
                    {o.status}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-[10px] sm:text-xs text-[#969892] py-0.5">
                No orders in transit right now.
              </p>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] sm:text-[11px] text-[#666864] pt-1 border-t border-[#F0EFEA]">
            <span className="truncate">Jabalpur Route Dispatch</span>
            <span className="text-[#79565D] group-hover:underline flex items-center gap-0.5 shrink-0">
              Details <ArrowRight size={11} />
            </span>
          </div>
        </Link>
      </section>

      {/* ── 3. Place an Order: Search Bar ──────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#969892]">
            Place an Order
          </h2>
          <span className="hidden sm:inline text-[11px] text-[#666864]">
            Search across 4 FMCG brand catalogues
          </span>
        </div>

        <form onSubmit={handleSearch} className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#969892] pointer-events-none"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search products, brands, or SKUs (e.g. Salt, Coffee, Biscuits)..."
            className="w-full rounded-[6px] border border-[#E7E6E0] bg-white py-2.5 sm:py-3 pl-10 pr-24 text-xs sm:text-sm text-[#242724] placeholder:text-[#969892] shadow-2xs outline-none focus:border-[#79565D] focus:ring-1 focus:ring-[#79565D]/20 transition-all"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-[4px] bg-[#79565D] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-[#67474E] transition-colors"
          >
            Search
          </button>
        </form>

      </section>

      {/* ── 4. AI Ordering (Full Width, Accessible via Jump Link) ─ */}
      <section id="ai-ordering" className="scroll-mt-16">
        <h2 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#969892] mb-1.5">
          AI Ordering
        </h2>
        <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-[#79565D]" />
              <span className="text-xs sm:text-sm font-bold text-[#242724]">
                Kirana Fast Order Capture
              </span>
            </div>
            <Badge variant="accent" className="text-[9px] px-2 py-0.5">
              Pilot Feature
            </Badge>
          </div>
          <p className="text-xs text-[#666864] mb-3">
            Place your routine restock using voice, pasting your WhatsApp order text, or snapping a picture of your rack.
          </p>

          <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
            <button
              disabled
              className="flex flex-col items-center justify-center gap-1.5 rounded-[4px] border border-dashed border-[#D5D3CB] bg-[#FAF9F6] py-3.5 sm:py-4 px-2 text-[#969892] cursor-not-allowed"
              title="Coming soon for Jabalpur route"
            >
              <Mic size={20} className="text-[#79565D]" />
              <span className="text-xs font-semibold text-[#242724]">Voice Order</span>
              <span className="text-[10px] text-[#969892]">Speak in Hindi/English</span>
            </button>
            <button
              disabled
              className="flex flex-col items-center justify-center gap-1.5 rounded-[4px] border border-dashed border-[#D5D3CB] bg-[#FAF9F6] py-3.5 sm:py-4 px-2 text-[#969892] cursor-not-allowed"
              title="Coming soon for Jabalpur route"
            >
              <MessageSquareText size={20} className="text-[#79565D]" />
              <span className="text-xs font-semibold text-[#242724]">Text Order</span>
              <span className="text-[10px] text-[#969892]">Paste WhatsApp list</span>
            </button>
            <button
              disabled
              className="flex flex-col items-center justify-center gap-1.5 rounded-[4px] border border-dashed border-[#D5D3CB] bg-[#FAF9F6] py-3.5 sm:py-4 px-2 text-[#969892] cursor-not-allowed"
              title="Coming soon for Jabalpur route"
            >
              <Camera size={20} className="text-[#79565D]" />
              <span className="text-xs font-semibold text-[#242724]">Photo Order</span>
              <span className="text-[10px] text-[#969892]">Snap shelf or register</span>
            </button>
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#969892] border-t border-[#F0EFEA] pt-2.5">
            <Clock size={12} className="shrink-0" />
            <span>AI order processing rollout in progress. You can browse catalogue and reorder routine items below.</span>
          </div>
        </div>
      </section>

      {/* ── 5. Shop by Category (Single horizontal line with More) ── */}
      {categories.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#969892]">
              Shop by Category
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => scrollCategories("left")}
                className="hidden sm:inline-flex p-1 rounded-[3px] border border-[#E7E6E0] bg-white text-[#666864] hover:bg-[#F0EFEA] hover:text-[#242724] transition-colors"
                title="Scroll left"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                onClick={() => scrollCategories("right")}
                className="hidden sm:inline-flex p-1 rounded-[3px] border border-[#E7E6E0] bg-white text-[#666864] hover:bg-[#F0EFEA] hover:text-[#242724] transition-colors"
                title="Scroll right"
              >
                <ChevronRight size={13} />
              </button>
              <Link
                href="/retailer/catalogue"
                className="text-xs font-semibold text-[#79565D] hover:underline ml-2"
              >
                View All
              </Link>
            </div>
          </div>

          {/* Single Line Category Scroller */}
          <div
            ref={categoryScrollRef}
            className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-hide"
          >
            <div className="flex items-center gap-2 sm:gap-2.5 w-max pb-1">
              {categories.map((cat) => {
                const Icon = getCategoryIcon(cat);
                return (
                  <Link
                    key={cat}
                    href={`/retailer/catalogue?category=${encodeURIComponent(cat)}`}
                    className="group flex items-center gap-2 rounded-[6px] border border-[#E7E6E0] bg-white px-3 py-2 sm:px-3.5 sm:py-2.5 shadow-2xs hover:border-[#79565D] transition-colors shrink-0"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#F4EFF0] text-[#79565D] group-hover:bg-[#79565D] group-hover:text-white transition-colors">
                      <Icon size={14} />
                    </div>
                    <span className="text-xs font-semibold text-[#242724] whitespace-nowrap">
                      {cat}
                    </span>
                  </Link>
                );
              })}

              {/* "More" Option at the end */}
              <Link
                href="/retailer/catalogue"
                className="group flex items-center gap-1.5 rounded-[6px] border border-dashed border-[#D5D3CB] bg-[#FAF9F6] px-3.5 py-2 sm:py-2.5 hover:border-[#79565D] hover:bg-[#F4EFF0] transition-colors shrink-0"
              >
                <span className="text-xs font-semibold text-[#79565D]">More</span>
                <ChevronRight size={13} className="text-[#79565D]" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── 6. Buy Again: Responsive Multi-Column Grid ─────────── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#969892]">
              Buy Again
            </h2>
            <p className="hidden sm:block text-[11px] text-[#666864]">
              Routine Kirana restocks from your previous dispatches
            </p>
          </div>
          <Link
            href="/retailer/orders"
            className="text-xs font-semibold text-[#79565D] hover:underline flex items-center gap-0.5"
          >
            Order History
            <ChevronRight size={12} />
          </Link>
        </div>

        {buyAgainProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
            {buyAgainProducts.map((item) => {
              const p = item.catProduct;
              const inStock = p ? (p.is_in_stock ?? (Number(p.quantity_available) > 0)) : false;
              const caseRate = p && p.price !== null ? p.price * p.units_per_case : null;
              const pieceRate = p?.price ?? item.unit_price;
              const isAdded = addedProducts.has(String(p?.id)) || addedProducts.has(item.product_id);

              return (
                <div
                  key={item.product_id}
                  className="flex flex-col justify-between gap-2.5 rounded-[6px] border border-[#E7E6E0] bg-white p-3 shadow-2xs hover:border-[#D5D3CB] transition-colors"
                >
                  {/* Product Details Header */}
                  <div className="flex items-start gap-2.5 min-w-0">
                    <ProductThumbnail
                      name={item.product_name}
                      category={p?.category || "FMCG"}
                      brandName={p?.brand_name}
                      size="sm"
                      className="shrink-0 mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#242724] truncate leading-tight">
                        {item.product_name}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#666864] flex-wrap">
                        <span className="font-mono text-[#969892]">{item.sku}</span>
                        {p && (
                          <>
                            <span>·</span>
                            <span>
                              {p.pack_size}{p.pack_unit} × {p.units_per_case}/cs
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pricing & Add to Cart Action */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#F0EFEA]">
                    <div>
                      {caseRate !== null ? (
                        <div>
                          <span className="font-mono font-bold text-xs text-[#242724] tabular-nums">
                            {formatCurrency(caseRate)}
                          </span>
                          <span className="text-[10px] text-[#969892] ml-1">
                            / case
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-[#242724]">
                          {formatCurrency(pieceRate)}
                        </span>
                      )}
                      <p className="text-[9px] text-[#969892] font-mono">
                        ({formatCurrency(pieceRate)}/pc)
                      </p>
                    </div>

                    <div>
                      {inStock ? (
                        <button
                          onClick={() => handleQuickAdd(item)}
                          disabled={isAdded}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-[4px] text-xs font-bold transition-all duration-150 ${
                            isAdded
                              ? "bg-[#EEF6F1] text-[#205234] border border-[#C3DEC9]"
                              : "bg-[#79565D] text-white hover:bg-[#67474E] active:scale-95 shadow-2xs"
                          }`}
                          title="Add 1 case to cart"
                        >
                          {isAdded ? (
                            <>
                              <Check size={13} />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <Plus size={13} />
                              <span>Add Case</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <Badge variant="outline" className="text-[9px]">
                          Out of stock
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[6px] border border-dashed border-[#E7E6E0] bg-[#FAF9F6] p-6 text-center">
            <ShoppingBag size={24} className="mx-auto text-[#969892] mb-1.5" />
            <p className="text-xs font-bold text-[#242724]">No past orders yet</p>
            <p className="text-[11px] text-[#666864] mt-0.5">
              Products you order will appear here for fast 1-click reordering.
            </p>
            <Link
              href="/retailer/catalogue"
              className="mt-3 inline-flex items-center gap-1.5 rounded-[4px] bg-[#79565D] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#67474E] transition-colors"
            >
              <Package size={13} />
              <span>Browse Full Catalogue</span>
            </Link>
          </div>
        )}
      </section>

    </div>
  );
}
