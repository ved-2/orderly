"use client";

import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Package,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  ShoppingCart,
  Check,
  Tag,
  ArrowRight,
  Filter,
  X,
  SlidersHorizontal,
  Percent,
  RotateCcw,
  Wheat,
  Coffee,
  Cookie,
  Droplets,
  Apple,
  Sparkles,
  Layers,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";
import { ProductThumbnail } from "@/components/ui/product-thumbnail";
import { Badge } from "@/components/ui/badge";
import {
  addToCart,
  getCart,
  getCartItemCount,
  getCartSubtotal,
  removeFromCart,
  updateCartQuantity,
  type CartItem,
} from "@/lib/cart";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ProductScheme {
  scheme_name: string;
  scheme_type: "BUY_X_GET_Y" | "SLAB_DISCOUNT";
  buy_quantity?: number | null;
  reward_quantity?: number | null;
  min_quantity?: number | null;
  discount_type?: "PERCENTAGE" | "FIXED_AMOUNT" | null;
  discount_value?: number | null;
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
  image_url?: string | null;
  schemes?: ProductScheme[];
}

interface CatalogueResponse {
  items: CatalogueProduct[];
  total: number;
  page: number;
  page_size: number;
}

interface RetailerOrderLine {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  quantity_unit: string;
  unit_price: number;
}

interface RetailerOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  lines: RetailerOrderLine[];
}

interface OrdersResponse {
  items: RetailerOrder[];
  total: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(amount: number | null): string {
  if (amount === null || isNaN(amount)) return "Price on request";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
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

function getCategoryIcon(cat: string): React.ElementType {
  return CATEGORY_ICONS[cat] || Package;
}

function formatRealScheme(scheme: ProductScheme): string {
  if (scheme.scheme_type === "BUY_X_GET_Y" && scheme.buy_quantity && scheme.reward_quantity) {
    return `Buy ${scheme.buy_quantity} Get ${scheme.reward_quantity} Free`;
  }
  if (scheme.scheme_type === "SLAB_DISCOUNT" && scheme.min_quantity && scheme.discount_value) {
    if (scheme.discount_type === "PERCENTAGE") {
      return `${scheme.discount_value}% Off (${scheme.min_quantity}+ cs)`;
    }
    return `₹${scheme.discount_value} Off (${scheme.min_quantity}+ cs)`;
  }
  return scheme.scheme_name || "Active Scheme";
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function RetailerCataloguePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  // Search & Filter States
  const initialSearch = searchParams.get("search") || "";
  const initialCategory = searchParams.get("category") || "";

  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState(initialSearch);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedBrand, setSelectedBrand] = useState("ALL");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [offersOnly, setOffersOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "price_asc" | "price_desc">("name");

  // Pagination & Loading States
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Cart & UI Feedback
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartToast, setCartToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Past Orders for "Frequently Purchased"
  const [pastOrders, setPastOrders] = useState<RetailerOrder[]>([]);

  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const schemesScrollRef = useRef<HTMLDivElement>(null);
  const recentScrollRef = useRef<HTMLDivElement>(null);

  const pageSize = 36;

  /* Sync search params if navigated from dashboard */
  useEffect(() => {
    const q = searchParams.get("search");
    const c = searchParams.get("category");
    if (q !== null && q !== search) {
      setSearch(q);
      setSearchInput(q);
    }
    if (c !== null && c !== selectedCategory) {
      setSelectedCategory(c);
    }
  }, [searchParams]);

  /* ---------------------------------------------------------------- */
  /*  Data Fetching                                                    */
  /* ---------------------------------------------------------------- */

  const loadCatalogue = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });

    if (search.trim()) params.set("search", search.trim());
    if (selectedCategory) params.set("category", selectedCategory);

    return apiRequest<CatalogueResponse>(
      `/products/catalogue?${params.toString()}`
    );
  }, [page, search, selectedCategory]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/register");
      return;
    }

    let cancelled = false;

    async function loadData() {
      setIsLoading(true);
      setError("");
      try {
        const [catRes, ordersRes] = await Promise.allSettled([
          loadCatalogue(),
          apiRequest<OrdersResponse>("/orders"),
        ]);

        if (cancelled) return;

        if (catRes.status === "fulfilled") {
          const res = catRes.value;
          setProducts(
            res.items.map((p) => ({
              ...p,
              is_in_stock: p.quantity_available > 0,
            }))
          );
          setTotal(res.total);
          setCategories((prev) =>
            Array.from(
              new Set([...prev, ...res.items.map((p) => p.category)])
            ).sort()
          );
        } else {
          setError(
            catRes.reason instanceof Error
              ? catRes.reason.message
              : "Unable to load catalogue."
          );
        }

        if (ordersRes.status === "fulfilled") {
          setPastOrders(ordersRes.value.items || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load catalogue."
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [user, loading, router, loadCatalogue]);

  // Sync Cart
  useEffect(() => {
    const syncCart = () => setCartItems(getCart());
    syncCart();
    window.addEventListener("orderly-cart-updated", syncCart);
    window.addEventListener("storage", syncCart);

    return () => {
      window.removeEventListener("orderly-cart-updated", syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Derived Calculations                                             */
  /* ---------------------------------------------------------------- */

  const brands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.brand_name) set.add(p.brand_name);
    });
    return ["ALL", ...Array.from(set).sort()];
  }, [products]);

  // Frequently purchased products derived from actual order history
  const frequentlyPurchased = useMemo(() => {
    const frequency = new Map<string, number>();
    for (const order of pastOrders) {
      if (!order.lines) continue;
      for (const line of order.lines) {
        frequency.set(line.product_id, (frequency.get(line.product_id) || 0) + 1);
      }
    }
    return products
      .filter((p) => frequency.has(p.id))
      .sort((a, b) => (frequency.get(b.id) || 0) - (frequency.get(a.id) || 0))
      .slice(0, 10);
  }, [pastOrders, products]);

  // Unique REAL active schemes returned by the backend
  const realActiveSchemes = useMemo(() => {
    const map = new Map<string, ProductScheme & { affected_products: string[] }>();
    for (const p of products) {
      if (!p.schemes || p.schemes.length === 0) continue;
      for (const s of p.schemes) {
        const key = `${s.scheme_name}_${s.scheme_type}_${s.buy_quantity}_${s.discount_value}`;
        if (!map.has(key)) {
          map.set(key, { ...s, affected_products: [p.name] });
        } else {
          const entry = map.get(key)!;
          if (!entry.affected_products.includes(p.name)) {
            entry.affected_products.push(p.name);
          }
        }
      }
    }
    return Array.from(map.values());
  }, [products]);

  // Filter & Sort Pipeline
  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => {
      if (selectedBrand !== "ALL" && p.brand_name !== selectedBrand) return false;
      if (inStockOnly && !p.is_in_stock) return false;
      if (offersOnly && (!p.schemes || p.schemes.length === 0)) return false;
      return true;
    });

    if (sortBy === "price_asc") {
      result = [...result].sort((a, b) => {
        const priceA = (a.price || 0) * a.units_per_case;
        const priceB = (b.price || 0) * b.units_per_case;
        return priceA - priceB;
      });
    } else if (sortBy === "price_desc") {
      result = [...result].sort((a, b) => {
        const priceA = (a.price || 0) * a.units_per_case;
        const priceB = (b.price || 0) * b.units_per_case;
        return priceB - priceA;
      });
    } else {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [products, selectedBrand, inStockOnly, offersOnly, sortBy]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const cartTotalUnits = getCartItemCount();
  const cartSubtotal = getCartSubtotal();

  /* ---------------------------------------------------------------- */
  /*  Cart Handlers                                                    */
  /* ---------------------------------------------------------------- */

  function getCartCaseQuantity(productId: string): number {
    const found = cartItems.find(
      (item) => item.product_id === productId && item.quantity_unit === "CASE"
    );
    return found ? found.quantity : 0;
  }

  function handleAddCaseToCart(product: CatalogueProduct) {
    if (product.price === null) {
      showToast("Price is not configured for this product.", "error");
      return;
    }
    if (!product.is_in_stock || product.quantity_available <= 0) {
      showToast("This product is currently out of stock.", "error");
      return;
    }

    try {
      const item: CartItem = {
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        brand_name: product.brand_name,
        pack_size: product.pack_size,
        pack_unit: product.pack_unit,
        units_per_case: product.units_per_case,
        price: Number(product.price),
        gst_included: Boolean(product.gst_included),
        quantity_available: Number(product.quantity_available),
        quantity: 1,
        quantity_unit: "CASE",
      };

      addToCart(item);
      showToast(`Added 1 Case (${product.units_per_case} pcs) to cart`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to add product.", "error");
    }
  }

  function handleQuantityChange(product: CatalogueProduct, newQty: number) {
    try {
      if (newQty <= 0) {
        removeFromCart(product.id, "CASE");
      } else {
        updateCartQuantity(product.id, "CASE", newQty);
      }
      setCartItems(getCart());
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to update quantity.", "error");
    }
  }

  function showToast(message: string, type: "success" | "error") {
    setCartToast({ message, type });
    setTimeout(() => setCartToast(null), 2500);
  }

  /* ---------------------------------------------------------------- */
  /*  Filters & Navigation Handlers                                    */
  /* ---------------------------------------------------------------- */

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  function handleClearSearch() {
    setSearch("");
    setSearchInput("");
    setPage(1);
  }

  function handleCategorySelect(cat: string) {
    setSelectedCategory(cat === selectedCategory ? "" : cat);
    setPage(1);
  }

  function handleResetFilters() {
    setSearch("");
    setSearchInput("");
    setSelectedCategory("");
    setSelectedBrand("ALL");
    setInStockOnly(false);
    setOffersOnly(false);
    setSortBy("name");
    setPage(1);
  }

  const hasActiveFilters =
    Boolean(search) ||
    Boolean(selectedCategory) ||
    selectedBrand !== "ALL" ||
    inStockOnly ||
    offersOnly;

  /* ---------------------------------------------------------------- */
  /*  Product Card Renderer                                            */
  /* ---------------------------------------------------------------- */

  const renderProductCard = (product: CatalogueProduct) => {
    const inCartQty = getCartCaseQuantity(product.id);
    const piecePrice = product.price || 0;
    const casePrice = piecePrice * product.units_per_case;
    const scheme =
      product.schemes && product.schemes.length > 0
        ? formatRealScheme(product.schemes[0])
        : null;
    const availableCases = Math.floor(product.quantity_available / product.units_per_case);

    return (
      <div
        key={product.id}
        className="group flex flex-col justify-between rounded-[6px] border border-[#E7E6E0] bg-white p-2.5 sm:p-3.5 shadow-2xs hover:border-[#79565D] hover:shadow-xs transition-all duration-150 w-full"
      >
        <div className="w-full">
          {/* Symmetrical Product Image Container */}
          <div className="relative w-full h-28 sm:h-36 flex items-center justify-center rounded-[4px] bg-[#FAF9F6] border border-[#F0EFEA] mb-2 overflow-hidden">
            <ProductThumbnail
              name={product.name}
              category={product.category}
              brandName={product.brand_name}
              imageUrl={product.image_url}
              size="md"
              className="max-h-full max-w-full object-contain"
            />

            {/* Scheme Label Pill */}
            {scheme && (
              <div className="absolute top-1.5 left-1.5 max-w-[85%]">
                <span className="inline-flex items-center gap-1 rounded-[3px] bg-[#79565D] px-1.5 py-0.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-white shadow-2xs truncate">
                  <Percent size={8} />
                  <span className="truncate">{scheme}</span>
                </span>
              </div>
            )}

            {/* Stock Indicator Dot */}
            <div className="absolute top-1.5 right-1.5">
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-[3px] text-[8px] sm:text-[9px] font-semibold tracking-wider uppercase border tabular-nums ${
                  product.is_in_stock
                    ? "bg-[#EEF6F1] text-[#205234] border-[#C3DEC9]"
                    : "bg-[#FBF0F0] text-[#8C2828] border-[#EDBCBC]"
                }`}
              >
                {product.is_in_stock ? `${availableCases} cs` : "Out"}
              </span>
            </div>
          </div>

          {/* Product Meta */}
          <div className="space-y-1 w-full text-left">
            <div className="flex items-center justify-between gap-1 text-[10px]">
              <span className="font-mono text-[#969892] uppercase font-bold truncate">
                {product.sku}
              </span>
              <span className="text-[#79565D] font-bold uppercase tracking-wider shrink-0 text-[9px] sm:text-[10px]">
                {product.brand_name}
              </span>
            </div>

            <h3
              title={product.name}
              className="text-xs sm:text-[13px] font-bold text-[#242724] line-clamp-2 leading-tight group-hover:text-[#79565D] transition-colors"
            >
              {product.name}
            </h3>

            {/* Pack Size & Case Details */}
            <p className="text-[10px] sm:text-[11px] text-[#666864] pt-0.5 truncate">
              {product.pack_size} {product.pack_unit} &bull;{" "}
              <span className="font-semibold text-[#242724]">
                {product.units_per_case} pcs/cs
              </span>
            </p>
          </div>
        </div>

        {/* Card Bottom: Wholesale Pricing & Action */}
        <div className="mt-2.5 pt-2 border-t border-[#F0EFEA] flex flex-col gap-2 w-full">
          {/* Price Row: Case Price & Piece Price */}
          <div className="flex items-baseline justify-between text-left">
            <div>
              <p className="font-mono text-xs sm:text-base font-bold text-[#242724] tabular-nums leading-tight">
                {formatCurrency(casePrice)}
                <span className="text-[9px] sm:text-[10px] font-sans font-normal text-[#969892] ml-0.5">
                  / cs
                </span>
              </p>
              <p className="text-[9px] sm:text-[10px] font-mono text-[#666864] tabular-nums">
                {formatCurrency(piecePrice)} / pc
              </p>
            </div>
            <span className="text-[8px] sm:text-[9px] text-[#969892] font-mono">
              {product.gst_rate ? `GST ${product.gst_rate}%` : "GST Incl."}
            </span>
          </div>

          {/* Quantity Controls or Add Button */}
          {inCartQty > 0 ? (
            <div className="flex h-7 sm:h-8 w-full items-center justify-between rounded-[4px] border border-[#242724] bg-white overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => handleQuantityChange(product, inCartQty - 1)}
                className="flex h-full w-8 items-center justify-center text-[#242724] hover:bg-[#F0EFEA] active:bg-[#E7E6E0] transition-colors"
                title="Decrease 1 case"
              >
                <Minus size={12} />
              </button>
              <span className="font-mono font-bold text-[11px] sm:text-xs text-[#242724] tabular-nums">
                {inCartQty} cs
              </span>
              <button
                type="button"
                onClick={() => handleQuantityChange(product, inCartQty + 1)}
                className="flex h-full w-8 items-center justify-center text-[#242724] hover:bg-[#F0EFEA] active:bg-[#E7E6E0] transition-colors"
                title="Add 1 case"
              >
                <Plus size={12} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleAddCaseToCart(product)}
              disabled={!product.is_in_stock || product.price === null}
              className="flex h-7 sm:h-8 w-full items-center justify-center gap-1 rounded-[4px] bg-[#242724] px-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#79565D] active:scale-[0.98] transition-all disabled:cursor-not-allowed disabled:bg-[#D5D3CB]"
            >
              <Plus size={12} />
              <span>Add Case</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Loading Skeleton                                                 */
  /* ---------------------------------------------------------------- */

  if (loading || (isLoading && products.length === 0 && !error)) {
    return (
      <div className="w-full px-3 py-4 sm:px-6 space-y-5">
        <div className="h-8 w-32 animate-pulse rounded bg-[#E7E6E0]" />
        <div className="h-11 w-full animate-pulse rounded bg-[#E7E6E0]" />
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded bg-[#E7E6E0]" />
          ))}
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Main Marketplace View                                            */
  /* ---------------------------------------------------------------- */

  return (
    <div className="w-full px-3 py-3.5 sm:px-6 space-y-4 sm:space-y-5 pb-24 md:pb-12">

      {/* ── 1. Header: Clean "Explore" Title ───────────────────── */}
      <section className="border-b border-[#E7E6E0] pb-2.5">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#242724]">
          Explore
        </h1>
      </section>

      {/* ── 2. Prominent Search Bar ────────────────────────────── */}
      <section>
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#969892] pointer-events-none"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by product, brand, category, or SKU..."
            className="w-full rounded-[6px] border border-[#E7E6E0] bg-white py-2.5 sm:py-3 pl-10 pr-24 text-xs sm:text-sm text-[#242724] placeholder:text-[#969892] shadow-2xs outline-none focus:border-[#79565D] focus:ring-1 focus:ring-[#79565D]/20 transition-all"
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-20 top-1/2 -translate-y-1/2 p-1 text-[#969892] hover:text-[#242724]"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-[4px] bg-[#79565D] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#67474E] transition-colors"
          >
            Search
          </button>
        </form>

        {/* Quick Search Chips */}
        
      </section>

      {/* ── 3. Category Browsing Bar (Single Line Scrollable) ──── */}
      {categories.length > 0 && (
        <section>
          <div
            ref={categoryScrollRef}
            className="-mx-3 px-3 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-hide pb-0.5"
          >
            <div className="flex items-center gap-2 sm:gap-2.5 w-max">
              <button
                onClick={() => handleCategorySelect("")}
                className={`flex items-center gap-1.5 rounded-[6px] border px-3 py-1.5 sm:py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                  !selectedCategory
                    ? "bg-[#242724] text-white border-[#242724] shadow-2xs"
                    : "bg-white text-[#666864] border-[#E7E6E0] hover:bg-[#F0EFEA] hover:text-[#242724]"
                }`}
              >
                <Layers size={13} />
                <span>All Categories</span>
              </button>

              {categories.map((cat) => {
                const Icon = getCategoryIcon(cat);
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => handleCategorySelect(cat)}
                    className={`group flex items-center gap-1.5 rounded-[6px] border px-3 py-1.5 sm:py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                      isSelected
                        ? "bg-[#79565D] text-white border-[#79565D] shadow-2xs"
                        : "bg-white text-[#242724] border-[#E7E6E0] hover:border-[#79565D]"
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-[3px] ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-[#F4EFF0] text-[#79565D] group-hover:bg-[#79565D] group-hover:text-white"
                      } transition-colors`}
                    >
                      <Icon size={12} />
                    </div>
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── 4. Real Distributor Schemes (One Liner Scrollable) ──── */}
      {realActiveSchemes.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#969892]">
              Active Trade Schemes
            </h2>
            <span className="text-[10px] text-[#666864]">Applied at Order Desk</span>
          </div>

          <div
            ref={schemesScrollRef}
            className="-mx-3 px-3 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-hide pb-1"
          >
            <div className="flex items-center gap-2.5 w-max">
              {realActiveSchemes.map((scheme, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 rounded-[6px] border border-[#E7E6E0] bg-white px-3 py-2 text-xs shadow-2xs shrink-0"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#F4EFF0] text-[#79565D] shrink-0">
                    <Percent size={14} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[#242724]">
                        {formatRealScheme(scheme)}
                      </span>
                      <Badge variant="accent" className="text-[8px] px-1 py-0">
                        {scheme.scheme_type === "BUY_X_GET_Y" ? "Free Goods" : "Rebate"}
                      </Badge>
                    </div>
                    {scheme.affected_products.length > 0 && (
                      <p className="text-[10px] text-[#666864] truncate max-w-xs">
                        On: {scheme.affected_products.slice(0, 2).join(", ")}
                        {scheme.affected_products.length > 2 && " & more"}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      

      {/* ── Main Workspace: Filters Sidebar + Product Discovery Grid ── */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">

        {/* ── Desktop Filters Sidebar ────────────────────────────── */}
        <aside className="hidden lg:block w-60 shrink-0 rounded-[6px] border border-[#E7E6E0] bg-white p-4 shadow-2xs space-y-4 sticky top-20">
          <div className="flex items-center justify-between border-b border-[#E7E6E0] pb-2.5">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal size={13} className="text-[#79565D]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#242724]">
                Filters
              </span>
            </div>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="text-[11px] font-semibold text-[#8C2828] hover:underline"
              >
                Reset
              </button>
            )}
          </div>

          {/* Brand Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#969892] block mb-1.5">
              FMCG Brand
            </label>
            <div className="space-y-0.5 max-h-44 overflow-y-auto pr-1 text-xs">
              {brands.map((b) => (
                <button
                  key={b}
                  onClick={() => setSelectedBrand(b)}
                  className={`w-full text-left px-2 py-1 rounded-[3px] transition-colors flex items-center justify-between ${
                    selectedBrand === b
                      ? "bg-[#242724] text-white font-semibold"
                      : "text-[#666864] hover:bg-[#F0EFEA] hover:text-[#242724]"
                  }`}
                >
                  <span className="truncate">{b === "ALL" ? "All Brands" : b}</span>
                  {selectedBrand === b && <Check size={12} />}
                </button>
              ))}
            </div>
          </div>

          {/* Availability */}
          <div className="border-t border-[#F0EFEA] pt-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#969892] block mb-1.5">
              Availability
            </label>
            <label className="flex items-center gap-2 text-xs text-[#242724] cursor-pointer">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="rounded border-[#D5D3CB] text-[#79565D] focus:ring-[#79565D]"
              />
              <span>In Stock Only</span>
            </label>
          </div>

          {/* Real Schemes Only */}
          {realActiveSchemes.length > 0 && (
            <div className="border-t border-[#F0EFEA] pt-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#969892] block mb-1.5">
                Wholesale Deals
              </label>
              <label className="flex items-center gap-2 text-xs text-[#242724] cursor-pointer">
                <input
                  type="checkbox"
                  checked={offersOnly}
                  onChange={(e) => setOffersOnly(e.target.checked)}
                  className="rounded border-[#D5D3CB] text-[#79565D] focus:ring-[#79565D]"
                />
                <span>With Trade Schemes</span>
              </label>
            </div>
          )}

          {/* Sort By */}
          <div className="border-t border-[#F0EFEA] pt-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#969892] block mb-1.5">
              Sort
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full rounded-[4px] border border-[#E7E6E0] bg-white px-2 py-1.5 text-xs text-[#242724] outline-none focus:border-[#79565D]"
            >
              <option value="name">Product Name (A-Z)</option>
              <option value="price_asc">Case Rate (Low to High)</option>
              <option value="price_desc">Case Rate (High to Low)</option>
            </select>
          </div>
        </aside>

        {/* ── Main Products Discovery Area ───────────────────────── */}
        <main className="min-w-0 flex-1 space-y-3.5 w-full">

          {/* Controls Bar: Mobile Filter Trigger & Counter */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7E6E0] pb-2 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileFilterOpen(true)}
                className="lg:hidden flex items-center gap-1.5 rounded-[4px] border border-[#E7E6E0] bg-white px-2.5 py-1 text-xs font-bold text-[#242724] shadow-2xs"
              >
                <Filter size={12} className="text-[#79565D]" />
                <span>Filter {hasActiveFilters && "(Active)"}</span>
              </button>

              <span className="text-[#666864] text-[11px] sm:text-xs">
                Showing <strong className="text-[#242724]">{filteredProducts.length}</strong> of{" "}
                {total} products
              </span>
            </div>

            {/* Active Filter Tags */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedCategory && (
                <span className="inline-flex items-center gap-1 rounded-[3px] bg-[#F4EFF0] px-2 py-0.5 text-[10px] font-bold text-[#79565D]">
                  {selectedCategory}
                  <button onClick={() => setSelectedCategory("")}>
                    <X size={11} />
                  </button>
                </span>
              )}
              {selectedBrand !== "ALL" && (
                <span className="inline-flex items-center gap-1 rounded-[3px] bg-[#F0EFEA] px-2 py-0.5 text-[10px] font-bold text-[#242724]">
                  {selectedBrand}
                  <button onClick={() => setSelectedBrand("ALL")}>
                    <X size={11} />
                  </button>
                </span>
              )}
              {inStockOnly && (
                <span className="inline-flex items-center gap-1 rounded-[3px] bg-[#EEF6F1] px-2 py-0.5 text-[10px] font-bold text-[#205234]">
                  In Stock
                  <button onClick={() => setInStockOnly(false)}>
                    <X size={11} />
                  </button>
                </span>
              )}
            </div>
          </div>

          {/* ── 6. Product Discovery Grid (Symmetrical Two-Column on Mobile) ── */}
          {filteredProducts.length === 0 ? (
            <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-10 text-center shadow-2xs">
              <Package size={28} className="mx-auto text-[#969892] mb-1.5" />
              <h3 className="text-sm font-bold text-[#242724]">No products match filter</h3>
              <p className="mt-0.5 text-xs text-[#666864]">
                Try clearing your search or selecting a different category.
              </p>
              <button
                onClick={handleResetFilters}
                className="mt-3 rounded-[4px] bg-[#79565D] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3.5 w-full">
              {filteredProducts.map(renderProductCard)}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-[#E7E6E0] text-xs">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded-[4px] border border-[#E7E6E0] bg-white px-3 py-1 font-bold text-[#242724] hover:bg-[#F0EFEA] disabled:opacity-40"
              >
                <ChevronLeft size={13} /> Prev
              </button>
              <span className="tabular-nums font-mono text-[#666864] text-[11px]">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 rounded-[4px] border border-[#E7E6E0] bg-white px-3 py-1 font-bold text-[#242724] hover:bg-[#F0EFEA] disabled:opacity-40"
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          )}
        </main>

      </div>

      {/* ── Mobile Filters Drawer Modal ─────────────────────────── */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex bg-black/40 backdrop-blur-xs lg:hidden">
          <div className="ml-auto flex h-full w-full max-w-xs flex-col bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E7E6E0] pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#242724]">
                Filter Catalogue
              </span>
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="p-1 text-[#666864] hover:text-[#242724]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#969892] block mb-1.5">
                  Brand
                </label>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full rounded-[4px] border border-[#E7E6E0] bg-white p-2 text-xs text-[#242724]"
                >
                  {brands.map((b) => (
                    <option key={b} value={b}>
                      {b === "ALL" ? "All FMCG Brands" : b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#F0EFEA]">
                <label className="flex items-center gap-2 text-xs text-[#242724]">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="rounded text-[#79565D]"
                  />
                  <span>In Stock Only</span>
                </label>
                {realActiveSchemes.length > 0 && (
                  <label className="flex items-center gap-2 text-xs text-[#242724]">
                    <input
                      type="checkbox"
                      checked={offersOnly}
                      onChange={(e) => setOffersOnly(e.target.checked)}
                      className="rounded text-[#79565D]"
                    />
                    <span>With Trade Schemes</span>
                  </label>
                )}
              </div>

              <div className="pt-2 border-t border-[#F0EFEA]">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#969892] block mb-1.5">
                  Sort
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full rounded-[4px] border border-[#E7E6E0] bg-white p-2 text-xs text-[#242724]"
                >
                  <option value="name">Product Name (A-Z)</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
              </div>
            </div>

            <div className="border-t border-[#E7E6E0] pt-3 flex gap-2">
              <button
                onClick={handleResetFilters}
                className="flex-1 rounded-[4px] border border-[#E7E6E0] py-2 text-xs font-semibold text-[#666864]"
              >
                Reset
              </button>
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="flex-1 rounded-[4px] bg-[#79565D] py-2 text-xs font-bold text-white"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cart Action Toast Feedback ─────────────────────────── */}
      {cartToast && (
        <div
          className={`fixed top-16 right-4 z-50 flex items-center gap-2 rounded-[4px] px-3.5 py-2 text-xs font-bold shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
            cartToast.type === "success"
              ? "border border-[#C3DEC9] bg-[#EEF6F1] text-[#205234]"
              : "border border-[#EDBCBC] bg-[#FBF0F0] text-[#8C2828]"
          }`}
        >
          {cartToast.type === "success" ? <Check size={14} /> : <X size={14} />}
          <span>{cartToast.message}</span>
        </div>
      )}

      {/* ── Floating Bottom Cart Bar (Phone ONLY, lifted above bottom nav) ── */}
      {cartTotalUnits > 0 && (
        <aside
          aria-label="Floating cart checkout"
          className="fixed inset-x-0 bottom-[72px] sm:bottom-20 z-30 px-3.5 pointer-events-none md:hidden"
        >
          <div className="w-full rounded-[6px] border border-[#242724] bg-[#242724] p-3 text-white shadow-xl pointer-events-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[#79565D] text-white shrink-0">
                <ShoppingCart size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white tabular-nums font-mono truncate">
                  {cartTotalUnits} case{cartTotalUnits > 1 ? "s" : ""} &bull; {formatCurrency(cartSubtotal)}
                </p>
                <p className="text-[10px] text-[#D5D3CB] truncate">
                  Tap to review & order
                </p>
              </div>
            </div>

            <Link
              href="/retailer/cart"
              className="rounded-[4px] bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#242724] hover:bg-[#F0EFEA] transition-colors flex items-center gap-1 shadow-2xs shrink-0"
            >
              <span>View Cart</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </aside>
      )}

    </div>
  );
}
