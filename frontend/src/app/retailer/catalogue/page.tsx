"use client";

import {
  useCallback,
  useEffect,
  useState,
  useMemo,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
  Mic,
  MicOff,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";
import { ProductThumbnail } from "@/components/ui/product-thumbnail";
import { Badge } from "@/components/ui/badge";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb";
import {
  addToCart,
  getCart,
  getCartItemCount,
  getCartSubtotal,
  removeFromCart,
  updateCartQuantity,
  type QuantityUnit,
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
  mrp?: number | null;
  gst_included: boolean | null;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  is_in_stock: boolean;
  image_url?: string | null;
  schemes?: ProductScheme[];
  variants?: CatalogueProduct[];
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
  const [desktopGridColumns, setDesktopGridColumns] = useState<"auto" | "3" | "4">("auto");

  // Pagination & Loading States
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Cart & UI Feedback
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartToast, setCartToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [voiceEndConfirmOpen, setVoiceEndConfirmOpen] = useState(false);
  const [voiceEndedToast, setVoiceEndedToast] = useState(false);
  const [voicePanelPosition, setVoicePanelPosition] = useState({ x: 12, y: 12 });
  const [selectedVariantProduct, setSelectedVariantProduct] = useState<CatalogueProduct | null>(null);
  const [selectedOrderUnits, setSelectedOrderUnits] = useState<Record<string, QuantityUnit>>({});
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});

  // Past Orders for "Frequently Purchased"
  const [pastOrders, setPastOrders] = useState<RetailerOrder[]>([]);

  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const schemesScrollRef = useRef<HTMLDivElement>(null);
  const recentScrollRef = useRef<HTMLDivElement>(null);
  const voicePanelRef = useRef<HTMLDivElement>(null);
  const voiceDragRef = useRef<{
    pointerX: number;
    pointerY: number;
    panelX: number;
    panelY: number;
  } | null>(null);

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

  useEffect(() => {
    if (!selectedVariantProduct) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedVariantProduct(null);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedVariantProduct]);

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
  const desktopGridClass = {
    auto: "xl:grid-cols-3 2xl:grid-cols-4",
    "3": "xl:grid-cols-3 2xl:grid-cols-3",
    "4": "xl:grid-cols-4 2xl:grid-cols-4",
  }[desktopGridColumns];

  /* ---------------------------------------------------------------- */
  /*  Cart Handlers                                                    */
  /* ---------------------------------------------------------------- */

  function getCartQuantity(productId: string, quantityUnit: QuantityUnit): number {
    const found = cartItems.find(
      (item) => item.product_id === productId && item.quantity_unit === quantityUnit
    );
    return found?.quantity ?? 0;
  }

  function changeCartQuantity(
    product: CatalogueProduct,
    quantityUnit: QuantityUnit,
    change: 1 | -1
  ) {
    const currentQuantity = getCartQuantity(product.id, quantityUnit);
    try {
      if (change < 0) {
        if (currentQuantity <= 1) {
          removeFromCart(product.id, quantityUnit);
        } else {
          updateCartQuantity(product.id, quantityUnit, currentQuantity - 1);
        }
      } else {
        if (product.price === null) {
          showToast("Price is not configured for this product.", "error");
          return;
        }
        if (!product.is_in_stock || product.quantity_available <= 0) {
          showToast("This product is currently out of stock.", "error");
          return;
        }

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
          quantity_unit: quantityUnit,
          image_url: product.image_url,
        };
        addToCart(item);
      }

      setQuantityDrafts((drafts) => {
        const next = { ...drafts };
        delete next[`${product.id}:${quantityUnit}`];
        return next;
      });
      setCartItems(getCart());
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to update cart.", "error");
    }
  }

  function commitCartQuantity(
    product: CatalogueProduct,
    quantityUnit: QuantityUnit,
    value: string
  ) {
    const key = `${product.id}:${quantityUnit}`;
    const quantity = value.trim() === "" ? NaN : Number(value);
    const currentQuantity = getCartQuantity(product.id, quantityUnit);

    try {
      if (!Number.isInteger(quantity) || quantity < 0) {
        showToast("Enter a whole quantity of zero or more.", "error");
        return;
      }

      if (quantity === 0) {
        if (currentQuantity > 0) removeFromCart(product.id, quantityUnit);
      } else if (quantity !== currentQuantity) {
        if (!product.is_in_stock || product.quantity_available <= 0) {
          showToast("This product is currently out of stock.", "error");
          return;
        }
        if (product.price === null) {
          showToast("Price is not configured for this product.", "error");
          return;
        }

        if (currentQuantity > 0) {
          updateCartQuantity(product.id, quantityUnit, quantity);
        } else {
          addToCart({
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
            quantity,
            quantity_unit: quantityUnit,
            image_url: product.image_url,
          });
        }
      }

      setCartItems(getCart());
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to update quantity.", "error");
    } finally {
      setQuantityDrafts((drafts) => {
        const next = { ...drafts };
        delete next[key];
        return next;
      });
    }
  }

  function getSelectedOrderUnit(product: CatalogueProduct): QuantityUnit {
    return (
      selectedOrderUnits[product.id] ??
      (getCartQuantity(product.id, "CASE") > 0
        ? "CASE"
        : getCartQuantity(product.id, "PIECE") > 0 || product.units_per_case <= 1
          ? "PIECE"
          : "CASE")
    );
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

  function openVoicePanel(event: ReactMouseEvent<HTMLButtonElement>) {
    if (!voicePanelOpen) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const panelWidth = Math.min(320, window.innerWidth - 24);
      const panelHeight = 210;
      const x = Math.max(12, Math.min(bounds.right - panelWidth, window.innerWidth - panelWidth - 12));
      const below = bounds.bottom + 10;
      const y = below + panelHeight <= window.innerHeight - 12
        ? below
        : Math.max(12, bounds.top - panelHeight - 10);
      setVoicePanelPosition({ x, y });
    }
    setVoicePanelOpen(true);
  }

  function handleVoicePanelDragStart(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    const panel = voicePanelRef.current;
    if (!panel) return;
    const bounds = panel.getBoundingClientRect();
    voiceDragRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      panelX: bounds.left,
      panelY: bounds.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleVoicePanelDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = voiceDragRef.current;
    const panel = voicePanelRef.current;
    if (!drag || !panel) return;
    const { width, height } = panel.getBoundingClientRect();
    const x = Math.max(
      12,
      Math.min(drag.panelX + event.clientX - drag.pointerX, window.innerWidth - width - 12)
    );
    const y = Math.max(
      12,
      Math.min(drag.panelY + event.clientY - drag.pointerY, window.innerHeight - height - 12)
    );
    setVoicePanelPosition({ x, y });
  }

  function handleVoicePanelDragEnd(event: ReactPointerEvent<HTMLDivElement>) {
    voiceDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function closeVoicePanel() {
    setMicrophoneEnabled(false);
    setVoicePanelOpen(false);
    setVoiceEndConfirmOpen(false);
    setVoiceError("");
  }

  function endVoiceConversation() {
    closeVoicePanel();
    setVoiceEndedToast(true);
    window.setTimeout(() => setVoiceEndedToast(false), 4000);
  }

  function handleVoiceError(message: string) {
    setVoiceError(message);
    setMicrophoneEnabled(false);
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
    setDesktopGridColumns("auto");
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
    const quantityUnit = getSelectedOrderUnit(product);
    const quantity = getCartQuantity(product.id, quantityUnit);
    const quantityDraftKey = `${product.id}:${quantityUnit}`;
    const quantityDraft = quantityDrafts[quantityDraftKey] ?? String(quantity);
    const caseQuantity = getCartQuantity(product.id, "CASE");
    const pieceQuantity = getCartQuantity(product.id, "PIECE");
    const cartQuantityLabel = [
      caseQuantity > 0 && `${caseQuantity} ${caseQuantity === 1 ? "case" : "cases"}`,
      pieceQuantity > 0 && `${pieceQuantity} ${pieceQuantity === 1 ? "piece" : "pieces"}`,
    ].filter(Boolean).join(" · ");
    const casePrice = product.price === null ? null : product.price * product.units_per_case;
    const hasVariants = Boolean(product.variants?.length);
    const scheme = product.schemes?.[0];

    return (
      <div
        key={product.id}
        className="group flex min-w-0 flex-col rounded-md border border-[#E7E6E0] bg-white p-2.5 shadow-2xs transition-colors hover:border-[#D5D3CB] sm:p-4"
      >
        <div className="relative mb-3 aspect-square w-full overflow-hidden rounded border border-[#F0EFEA] bg-[#FAF9F6] sm:mb-4">
          <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-5">
            <ProductThumbnail
              name={product.name}
              category={product.category}
              brandName={product.brand_name}
              imageUrl={product.image_url}
              size="lg"
              className="!h-full !w-full border-0 bg-transparent [&_img]:object-contain"
            />
          </div>
          {quantity > 0 ? (
            <div className="absolute bottom-2 left-2 flex h-10 items-center overflow-hidden rounded border border-[#E7E6E0] bg-white shadow-sm">
              <button
                type="button"
                onClick={() => changeCartQuantity(product, quantityUnit, -1)}
                aria-label={`Decrease ${product.name} quantity`}
                className="grid size-10 shrink-0 place-items-center text-[#242724] transition-colors hover:bg-[#F0EFEA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#79565D]"
              >
                <Minus size={16} />
              </button>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={quantityDraft}
                onChange={(event) =>
                  setQuantityDrafts((drafts) => ({
                    ...drafts,
                    [quantityDraftKey]: event.target.value,
                  }))
                }
                onBlur={(event) => commitCartQuantity(product, quantityUnit, event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                aria-label={`${product.name} quantity in ${quantityUnit === "CASE" ? "cases" : "pieces"}`}
                className="h-full w-10 border-x border-[#F0EFEA] bg-white text-center text-sm font-semibold tabular-nums text-[#242724] outline-none focus-visible:bg-[#F4EFF0]"
              />
              <button
                type="button"
                onClick={() => changeCartQuantity(product, quantityUnit, 1)}
                disabled={!product.is_in_stock || product.price === null}
                aria-label={`Increase ${product.name} quantity`}
                className="grid size-10 shrink-0 place-items-center bg-[#79565D] text-white transition-colors hover:bg-[#67474E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white disabled:cursor-not-allowed disabled:bg-[#D5D3CB]"
              >
                <Plus size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => changeCartQuantity(product, quantityUnit, 1)}
              disabled={!product.is_in_stock || product.price === null}
              aria-label={`Add ${product.name} to cart`}
              className="absolute bottom-2 left-2 grid size-10 place-items-center rounded border border-[#79565D] bg-[#79565D] text-white shadow-sm transition-colors hover:bg-[#67474E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#79565D] disabled:cursor-not-allowed disabled:border-[#D5D3CB] disabled:bg-[#D5D3CB]"
            >
              <Plus size={19} strokeWidth={2.5} />
            </button>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[#79565D]">
            {product.brand_name}
          </p>
          <h3
            title={product.name}
            className="mt-1 line-clamp-2 min-h-10 text-[13px] font-semibold leading-5 text-[#242724] sm:text-sm"
          >
            {product.name}
          </h3>

          <div className="mt-2 flex min-h-8 flex-wrap items-center gap-1.5">
            <span className="rounded-sm bg-[#F0EFEA] px-2 py-1 text-[10px] font-medium text-[#555750] sm:text-[11px]">
              {product.pack_size} {product.pack_unit}
            </span>
            {product.units_per_case > 1 && (
              <span className="text-[10px] text-[#777870] sm:text-[11px]">
                {product.units_per_case} pcs / case
              </span>
            )}
            {hasVariants && (
              <button
                type="button"
                onClick={() => setSelectedVariantProduct(product)}
                className="ml-auto min-h-8 rounded-sm border border-[#E7E6E0] px-2 text-[10px] font-medium text-[#67474E] transition-colors hover:bg-[#F4EFF0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79565D]/40"
                aria-label={`Choose a variant of ${product.name}`}
              >
                Variants <span className="text-[#969892]">{product.variants!.length}</span>
              </button>
            )}
          </div>

          <div className="mt-2 flex min-h-8 items-center justify-between gap-2">
            {product.units_per_case > 1 ? (
              <div className="inline-flex min-h-9 shrink-0 items-center rounded border border-[#E7E6E0] bg-[#F7F7F5] p-0.5">
                {(["CASE", "PIECE"] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() =>
                      setSelectedOrderUnits((units) => ({ ...units, [product.id]: unit }))
                    }
                    aria-pressed={quantityUnit === unit}
                    className={`min-h-8 rounded-sm px-2 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79565D]/40 sm:px-2.5 ${
                      quantityUnit === unit
                        ? "bg-white text-[#67474E] shadow-sm"
                        : "text-[#777870] hover:text-[#242724]"
                    }`}
                  >
                    {unit === "CASE" ? "Case" : "Piece"}
                  </button>
                ))}
              </div>
            ) : (
              <span className="px-1 text-[10px] text-[#777870]">Order by piece</span>
            )}
            <span className={`shrink-0 text-[10px] font-medium ${product.is_in_stock ? "text-[#52765A]" : "text-[#8C2828]"}`}>
              {product.is_in_stock ? "In stock" : "Unavailable"}
            </span>
          </div>
          <div className="mt-1 min-h-6">
            {cartQuantityLabel && (
              <span className="inline-flex rounded-sm bg-[#F5F5F3] px-2 py-1 text-[10px] text-[#777870]">
                {cartQuantityLabel}
              </span>
            )}
          </div>

          <div className="mt-auto border-t border-[#F0EFEA] pt-3">
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-[#969892]">
                  Retailer price / case
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-[#242724] sm:text-base">
                  {formatCurrency(casePrice)}
                </p>
              </div>
              {product.price !== null && (
                <p className="shrink-0 pb-0.5 text-[10px] tabular-nums text-[#777870]">
                  {formatCurrency(product.price)} / piece
                </p>
              )}
            </div>
            {product.price !== null && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#F0EFEA] pt-2 text-[10px]">
                <span className="text-[#777870]">
                  MRP{" "}
                  {product.mrp != null && product.mrp > 0 ? (
                    <span className="font-medium tabular-nums text-[#242724]">{formatCurrency(product.mrp)} / piece</span>
                  ) : (
                    <span className="text-[#969892]">Not provided</span>
                  )}
                </span>
                {product.mrp != null && product.mrp > 0 ? (
                  <span className={`font-medium ${product.mrp >= product.price ? "text-[#52765A]" : "text-[#8C2828]"}`}>
                    {(((product.mrp - product.price) / product.mrp) * 100).toFixed(1)}% margin
                  </span>
                ) : (
                  <span className="text-[#969892]">Margin unavailable</span>
                )}
              </div>
            )}
            <div className="mt-2 min-h-5">
              {scheme ? (
                <span className="inline-flex max-w-full items-center gap-1 rounded-sm bg-[#F4EFF0] px-2 py-1 text-[10px] font-medium text-[#67474E]">
                  <Tag size={11} className="shrink-0" />
                  <span className="truncate">{formatRealScheme(scheme)}</span>
                </span>
              ) : null}
            </div>
          </div>
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


      {/* ── 2. Prominent Search Bar ────────────────────────────── */}
      <section>
        <div className="flex items-start gap-2 sm:gap-3">
          <form onSubmit={handleSearchSubmit} className="min-w-0 flex-1">
            <InputGroup className="h-11 rounded-[6px] border-[#E7E6E0] bg-white focus-within:border-[#79565D] focus-within:ring-1 focus-within:ring-[#79565D]/20">
              <InputGroupAddon className="pl-3 text-[#969892]">
                <InputGroupText>
                  <Search size={16} />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by product, brand, category, or SKU..."
                aria-label="Search products"
                className="h-full px-1 text-xs text-[#242724] placeholder:text-[#969892] md:text-sm"
              />
              {searchInput && (
                <InputGroupAddon align="inline-end" className="pr-1.5">
                  <InputGroupButton
                    type="button"
                    onClick={handleClearSearch}
                    aria-label="Clear search"
                    title="Clear search"
                    className="text-[#969892] hover:text-[#242724]"
                  >
                    <X />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
          </form>

          <div className="relative flex shrink-0 justify-center">
            <button
              type="button"
              onClick={openVoicePanel}
              aria-label="Open voice search controls"
              aria-expanded={voicePanelOpen}
              className="relative flex size-11 items-center justify-center overflow-hidden rounded-full border border-[#E7E6E0] bg-white p-0.5 shadow-2xs transition-colors hover:border-[#79565D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79565D]/30"
            >
              <VoicePoweredOrb
                active={microphoneEnabled}
                onError={handleVoiceError}
                className="size-full rounded-full"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute grid size-6 place-items-center rounded-full border border-white/60 bg-white/70 text-[#3d3031] shadow-sm backdrop-blur-md"
              >
                <Mic size={13} />
              </span>
            </button>

            {voicePanelOpen && (
              <div
                ref={voicePanelRef}
                role="dialog"
                aria-label="Microphone controls"
                style={{ left: voicePanelPosition.x, top: voicePanelPosition.y }}
                className="fixed z-[80] flex w-max max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-3 rounded-full border border-white/65 bg-[rgba(121,86,93,0.2)] px-3 py-2 text-[#32292b] shadow-[0_12px_36px_rgba(61,48,49,0.2)] backdrop-blur-2xl"
              >
                <div
                  onPointerDown={handleVoicePanelDragStart}
                  onPointerMove={handleVoicePanelDrag}
                  onPointerUp={handleVoicePanelDragEnd}
                  onPointerCancel={handleVoicePanelDragEnd}
                  className="flex min-w-0 cursor-grab touch-none items-center gap-2.5 active:cursor-grabbing"
                >
                  <span
                    className={`size-2 shrink-0 rounded-full shadow-sm ${
                      microphoneEnabled ? "bg-[#4E8962]" : "bg-[#969892]"
                    }`}
                  />
                  <span className="select-none whitespace-nowrap text-xs font-medium">
                    {microphoneEnabled ? "Listening" : "Muted"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setVoiceError("");
                    setMicrophoneEnabled((enabled) => !enabled);
                  }}
                  aria-label={microphoneEnabled ? "Mute microphone" : "Unmute microphone"}
                  title={microphoneEnabled ? "Mute microphone" : "Unmute microphone"}
                  className={`grid size-10 shrink-0 place-items-center rounded-full border border-white/70 shadow-sm backdrop-blur-lg transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79565D]/40 ${
                    microphoneEnabled
                      ? "bg-[#79565D]/80 text-white"
                      : "bg-white/55 text-[#3d3031] hover:bg-white/75"
                  }`}
                >
                  {microphoneEnabled ? <MicOff size={17} /> : <Mic size={17} />}
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceEndConfirmOpen(true)}
                  aria-label="End voice conversation"
                  title="End conversation"
                  className="grid size-10 shrink-0 place-items-center rounded-full border border-white/70 bg-white/55 text-[#5b4b4d] shadow-sm backdrop-blur-lg transition hover:scale-105 hover:bg-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79565D]/40"
                >
                  <X size={17} />
                </button>
                {voiceError && (
                  <p role="alert" className="basis-full px-1 text-center text-xs text-[#8C2828]">
                    {voiceError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Search Chips */}
        
      </section>

      {(voiceEndConfirmOpen || voiceEndedToast) && (
        <div
          className={`fixed inset-0 z-[100] flex justify-center p-4 ${
            voiceEndConfirmOpen
              ? "items-center bg-black/10 backdrop-blur-[2px] sm:items-start sm:bg-transparent sm:pt-4 sm:backdrop-blur-0"
              : "pointer-events-none items-center sm:items-start sm:pt-4"
          }`}
        >
          {voiceEndConfirmOpen ? (
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="end-voice-title"
              aria-describedby="end-voice-description"
              className="w-full max-w-sm rounded-2xl border border-white/60 bg-white/75 p-5 text-[#242724] shadow-[0_18px_56px_rgba(36,39,36,0.2)] backdrop-blur-2xl sm:mt-0"
            >
              <h2 id="end-voice-title" className="text-base font-semibold">
                End conversation?
              </h2>
              <p id="end-voice-description" className="mt-1.5 text-sm text-[#666864]">
                You can switch voice search back on from the home page.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                type="button"
                onClick={() => setVoiceEndConfirmOpen(false)}
                className="h-9 rounded-lg border border-white/70 bg-white/55 px-3 text-sm font-medium text-[#3d3031] shadow-sm backdrop-blur-md transition hover:bg-white/80"
                >
                No, go back
                </button>
                <button
                type="button"
                onClick={endVoiceConversation}
                className="h-9 rounded-lg border border-[#79565D]/40 bg-[#79565D]/90 px-3 text-sm font-medium text-white shadow-sm backdrop-blur-md transition hover:bg-[#67474E]"
                >
                Yes, end conversation
                </button>
              </div>
            </div>
          ) : (
            <p
              role="status"
              className="w-full max-w-sm rounded-2xl border border-white/60 bg-white/75 px-4 py-3 text-center text-sm text-[#3d3031] shadow-lg backdrop-blur-2xl"
            >
              Conversation ended. You can switch voice search back on from the home page.
            </p>
          )}
        </div>
      )}

      {/* ── 3. Category Browsing (Image Tiles) ─────────────────── */}
      {categories.length > 0 && (
        <section>
          <h2 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#969892]">
            Browse Categories
          </h2>
          <div
            ref={categoryScrollRef}
            className="-mx-3 overflow-x-auto px-3 pb-1 scrollbar-hide sm:mx-0 sm:px-0"
          >
            <div className="flex w-max items-start gap-3">
              <button
                onClick={() => handleCategorySelect("")}
                aria-pressed={!selectedCategory}
                className={`group flex w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-lg p-1 transition-colors ${
                  !selectedCategory ? "bg-[#F4EFF0]" : "hover:bg-white/70"
                }`}
              >
                <span
                  className={`flex h-[62px] w-full items-center justify-center overflow-hidden rounded-md border transition-colors ${
                    !selectedCategory
                      ? "border-[#79565D]/35 bg-[#EBDDE0] text-[#79565D]"
                      : "border-[#E7E6E0] bg-[#F0EFEA] text-[#77736F] group-hover:border-[#D5D3CB]"
                  }`}
                  aria-hidden="true"
                >
                  <Layers size={25} strokeWidth={1.5} />
                </span>
                <span
                  className={`w-full truncate text-center text-[10px] font-medium ${
                    !selectedCategory ? "text-[#67474E]" : "text-[#666864]"
                  }`}
                >
                  All
                </span>
              </button>

              {categories.map((cat) => {
                const Icon = getCategoryIcon(cat);
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => handleCategorySelect(cat)}
                    aria-pressed={isSelected}
                    className={`group flex w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-lg p-1 transition-colors ${
                      isSelected ? "bg-[#F4EFF0]" : "hover:bg-white/70"
                    }`}
                  >
                    <div
                      className={`flex h-[62px] w-full items-center justify-center overflow-hidden rounded-md border transition-colors ${
                        isSelected
                          ? "border-[#79565D]/35 bg-[#EBDDE0] text-[#79565D]"
                          : "border-[#E7E6E0] bg-[#F0EFEA] text-[#79565D] group-hover:border-[#D5D3CB]"
                      } transition-colors`}
                    >
                      <Icon size={25} strokeWidth={1.5} />
                    </div>
                    <span
                      className={`w-full truncate text-center text-[10px] font-medium ${
                        isSelected ? "text-[#67474E]" : "text-[#666864]"
                      }`}
                    >
                      {cat}
                    </span>
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

      

      {/* ── Product Discovery ───────────────────────────────────── */}
      <div className="w-full">
        <main className="min-w-0 w-full space-y-3.5">

          {/* Controls Bar: Mobile Filter Trigger & Counter */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7E6E0] pb-2 text-xs">
           <div className="flex min-w-0 items-center gap-2">
              <button
                onClick={() => setFilterOpen(true)}
               className={`flex h-9 shrink-0 items-center gap-1.5 rounded border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79565D]/30 ${
                 hasActiveFilters
                   ? "border-[#79565D]/30 bg-[#F4EFF0] text-[#67474E]"
                   : "border-[#E7E6E0] bg-white text-[#3d3f3b] hover:border-[#79565D]/40 hover:bg-[#FAF8F8]"
               }`}
             >
               <SlidersHorizontal size={14} className="text-[#79565D]" />
               <span>Filters &amp; view</span>
               {hasActiveFilters && (
                 <span className="ml-0.5 size-1.5 rounded-full bg-[#79565D]" aria-label="Filters active" />
               )}
             </button>
           </div>

           <span className="ml-auto shrink-0 text-right text-[11px] text-[#666864] sm:text-xs">
             Showing <strong className="text-[#242724]">{filteredProducts.length}</strong> of{" "}
             {total} products
           </span>

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
            <div className={`grid w-full grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3.5 ${desktopGridClass}`}>
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

      {selectedVariantProduct?.variants && selectedVariantProduct.variants.length > 0 && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-[#242724]/35 sm:items-center sm:p-5"
          onClick={() => setSelectedVariantProduct(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="variant-dialog-title"
            className="flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-[#E7E6E0] bg-[#FAF9F6] shadow-[0_20px_60px_rgba(36,39,36,0.2)] sm:max-h-[min(80dvh,680px)] sm:max-w-xl sm:rounded-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#E7E6E0] bg-white px-5 pb-4 pt-5 sm:px-6">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#79565D]">
                  Choose a pack size
                </p>
                <h2 id="variant-dialog-title" className="mt-1 line-clamp-2 text-base font-semibold text-[#242724] sm:text-lg">
                  {selectedVariantProduct.name}
                </h2>
                <p className="mt-1 text-xs text-[#777870]">
                  Retailer pricing · wholesale ordering units
                </p>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => setSelectedVariantProduct(null)}
                aria-label="Close variant selector"
                className="grid size-10 shrink-0 place-items-center rounded border border-[#E7E6E0] bg-white text-[#666864] transition-colors hover:bg-[#F0EFEA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79565D]/40"
              >
                <X size={18} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
              <ul className="space-y-2">
                {selectedVariantProduct.variants.map((variant) => {
                  const quantityUnit = getSelectedOrderUnit(variant);
                  const quantity = getCartQuantity(variant.id, quantityUnit);
                  const quantityDraftKey = `${variant.id}:${quantityUnit}`;
                  const quantityDraft = quantityDrafts[quantityDraftKey] ?? String(quantity);
                  const variantCasePrice =
                    variant.price === null
                      ? null
                      : variant.price * variant.units_per_case;

                  return (
                    <li
                      key={variant.id}
                      className="flex min-w-0 items-center gap-3 rounded-md border border-[#E7E6E0] bg-white p-3 sm:gap-4 sm:p-4"
                    >
                      <ProductThumbnail
                        name={variant.name}
                        category={variant.category}
                        brandName={variant.brand_name}
                        imageUrl={variant.image_url}
                        size="md"
                        className="size-16 shrink-0 border-0 bg-[#FAF9F6]"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-sm font-semibold text-[#242724]">
                          {variant.name}
                        </h3>
                        <p className="mt-0.5 truncate text-xs text-[#777870]">
                          {variant.pack_size} {variant.pack_unit}
                          {variant.units_per_case > 1 && ` · ${variant.units_per_case} pcs/case`}
                        </p>
                        <p className="mt-1 text-xs font-semibold tabular-nums text-[#242724]">
                          {formatCurrency(variantCasePrice)}
                          <span className="font-normal text-[#969892]"> / case</span>
                        </p>
                        {variant.price !== null && (
                          <p className="mt-0.5 text-[10px] tabular-nums text-[#777870]">
                            {formatCurrency(variant.price)} / piece
                          </p>
                        )}
                        {variant.price !== null && (
                          <p className="mt-0.5 text-[10px] tabular-nums text-[#777870]">
                            MRP {variant.mrp != null && variant.mrp > 0 ? `${formatCurrency(variant.mrp)} / pc` : "not provided"}
                            {variant.mrp != null && variant.mrp > 0 ? (
                              <span className={`ml-1 font-medium ${variant.mrp >= variant.price ? "text-[#52765A]" : "text-[#8C2828]"}`}>
                                {(((variant.mrp - variant.price) / variant.mrp) * 100).toFixed(1)}% margin
                              </span>
                            ) : (
                              <span className="ml-1 text-[#969892]">margin unavailable</span>
                            )}
                          </p>
                        )}
                        <p className={`mt-1 line-clamp-1 text-[10px] font-medium ${variant.is_in_stock ? "text-[#52765A]" : "text-[#8C2828]"}`}>
                          {variant.is_in_stock ? "In stock" : "Unavailable"}
                          {variant.schemes?.[0] && ` · ${formatRealScheme(variant.schemes[0])}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {quantity > 0 ? (
                          <div className="flex h-10 items-center overflow-hidden rounded border border-[#E7E6E0] bg-white">
                            <button
                              type="button"
                              onClick={() => changeCartQuantity(variant, quantityUnit, -1)}
                              aria-label={`Decrease ${variant.name} quantity`}
                              className="grid size-9 place-items-center text-[#242724] hover:bg-[#F0EFEA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#79565D]"
                            >
                              <Minus size={15} />
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={quantityDraft}
                              onChange={(event) =>
                                setQuantityDrafts((drafts) => ({
                                  ...drafts,
                                  [quantityDraftKey]: event.target.value,
                                }))
                              }
                              onBlur={(event) => commitCartQuantity(variant, quantityUnit, event.currentTarget.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") event.currentTarget.blur();
                              }}
                              aria-label={`${variant.name} quantity in ${quantityUnit === "CASE" ? "cases" : "pieces"}`}
                              className="h-full w-9 border-x border-[#F0EFEA] bg-white text-center text-sm font-semibold tabular-nums text-[#242724] outline-none focus-visible:bg-[#F4EFF0]"
                            />
                            <button
                              type="button"
                              onClick={() => changeCartQuantity(variant, quantityUnit, 1)}
                              disabled={!variant.is_in_stock || variant.price === null}
                              aria-label={`Increase ${variant.name} quantity`}
                              className="grid size-9 place-items-center bg-[#79565D] text-white hover:bg-[#67474E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white disabled:cursor-not-allowed disabled:bg-[#D5D3CB]"
                            >
                              <Plus size={15} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => changeCartQuantity(variant, quantityUnit, 1)}
                            disabled={!variant.is_in_stock || variant.price === null}
                            aria-label={`Add ${variant.name} to cart`}
                            className="grid size-10 place-items-center rounded bg-[#79565D] text-white transition-colors hover:bg-[#67474E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79565D]/40 disabled:cursor-not-allowed disabled:bg-[#D5D3CB]"
                          >
                            <Plus size={18} />
                          </button>
                        )}
                        {variant.units_per_case > 1 ? (
                          <div className="inline-flex min-h-8 items-center rounded border border-[#E7E6E0] bg-[#F7F7F5] p-0.5">
                            {(["CASE", "PIECE"] as const).map((unit) => (
                              <button
                                key={unit}
                                type="button"
                                onClick={() =>
                                  setSelectedOrderUnits((units) => ({ ...units, [variant.id]: unit }))
                                }
                                aria-pressed={quantityUnit === unit}
                                className={`min-h-7 rounded-sm px-1.5 text-[9px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79565D]/40 ${
                                  quantityUnit === unit
                                    ? "bg-white text-[#67474E] shadow-sm"
                                    : "text-[#777870]"
                                }`}
                              >
                                {unit === "CASE" ? "Case" : "Piece"}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[9px] text-[#969892]">Piece</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </div>
      )}

      {/* ── Catalogue Filters Drawer ───────────────────────────── */}
      {filterOpen && (
        <div
          className="fixed inset-0 z-[80] flex justify-end bg-[#242724]/35"
          onClick={() => setFilterOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalogue-filter-title"
            className="ml-auto flex h-full w-[min(90vw,400px)] flex-col border-l border-[#E7E6E0] bg-[#FAF9F6] p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E7E6E0] pb-4">
              <div>
                <h2 id="catalogue-filter-title" className="text-base font-semibold text-[#242724]">
                  Catalogue options
                </h2>
                <p className="mt-0.5 text-xs text-[#777870]">Filter products and adjust the grid.</p>
              </div>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                aria-label="Close filters"
                className="grid size-10 shrink-0 place-items-center rounded border border-[#E7E6E0] bg-white text-[#666864] transition-colors hover:bg-[#F0EFEA] hover:text-[#242724] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79565D]/40"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto py-5">
              <div>
                <label htmlFor="catalogue-brand-filter" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#777870]">
                  Brand
                </label>
                <select
                  id="catalogue-brand-filter"
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="min-h-11 w-full rounded border border-[#E7E6E0] bg-white px-3 text-sm text-[#242724] outline-none focus:border-[#79565D] focus:ring-2 focus:ring-[#79565D]/15"
                >
                  {brands.map((b) => (
                    <option key={b} value={b}>
                      {b === "ALL" ? "All FMCG Brands" : b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3 border-t border-[#E7E6E0] pt-4">
                <label className="flex min-h-9 cursor-pointer items-center gap-3 text-sm text-[#242724]">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="size-4 rounded border-[#D5D3CB] text-[#79565D] focus:ring-[#79565D]"
                  />
                  <span>In Stock Only</span>
                </label>
                {realActiveSchemes.length > 0 && (
                  <label className="flex min-h-9 cursor-pointer items-center gap-3 text-sm text-[#242724]">
                    <input
                      type="checkbox"
                      checked={offersOnly}
                      onChange={(e) => setOffersOnly(e.target.checked)}
                      className="size-4 rounded border-[#D5D3CB] text-[#79565D] focus:ring-[#79565D]"
                    />
                    <span>With Trade Schemes</span>
                  </label>
                )}
              </div>

              <div className="border-t border-[#E7E6E0] pt-4">
                <label htmlFor="catalogue-sort" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#777870]">
                  Sort
                </label>
                <select
                  id="catalogue-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "name" | "price_asc" | "price_desc")}
                  className="min-h-11 w-full rounded border border-[#E7E6E0] bg-white px-3 text-sm text-[#242724] outline-none focus:border-[#79565D] focus:ring-2 focus:ring-[#79565D]/15"
                >
                  <option value="name">Product Name (A-Z)</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
              </div>

              <fieldset className="border-t border-[#E7E6E0] pt-4">
                <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#777870]">
                  Desktop grid
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {(["auto", "3", "4"] as const).map((columns) => (
                    <button
                      key={columns}
                      type="button"
                      onClick={() => setDesktopGridColumns(columns)}
                      aria-pressed={desktopGridColumns === columns}
                      className={`min-h-10 rounded border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79565D]/40 ${
                        desktopGridColumns === columns
                          ? "border-[#79565D] bg-[#F4EFF0] text-[#67474E]"
                          : "border-[#E7E6E0] bg-white text-[#666864] hover:bg-[#F0EFEA]"
                      }`}
                    >
                      {columns === "auto" ? "Auto" : `${columns} columns`}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="flex gap-3 border-t border-[#E7E6E0] pt-4">
              <button
                type="button"
                onClick={handleResetFilters}
                className="min-h-11 flex-1 rounded border border-[#E7E6E0] bg-white text-sm font-semibold text-[#666864] transition-colors hover:bg-[#F0EFEA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79565D]/40"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                className="min-h-11 flex-1 rounded bg-[#79565D] text-sm font-semibold text-white transition-colors hover:bg-[#67474E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79565D]/40"
              >
                Done
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
          className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-30 flex justify-center px-4 pointer-events-none sm:bottom-24 md:hidden"
        >
          <div className="pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-[28px] border border-white/65 bg-[linear-gradient(125deg,rgba(255,255,255,0.78),rgba(236,226,242,0.68)_52%,rgba(226,215,235,0.72))] p-3 text-[#302738] shadow-[0_14px_40px_rgba(54,38,67,0.22)] backdrop-blur-2xl">
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/70 bg-[linear-gradient(145deg,rgba(121,86,93,0.78),rgba(126,91,157,0.82))] text-white shadow-md">
                <ShoppingCart size={15} />
              </div>
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-bold tabular-nums text-[#302738]">
                  {cartTotalUnits} item{cartTotalUnits > 1 ? "s" : ""} &bull; {formatCurrency(cartSubtotal)}
                </p>
                <p className="truncate text-[10px] text-[#655c6d]">
                  Tap to review & order
                </p>
              </div>
            </div>

            <Link
              href="/retailer/cart"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/55 bg-[linear-gradient(120deg,#79565D,#76558A)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-[0_5px_16px_rgba(82,53,102,0.26)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79565D]/40"
            >
              <span>View Cart</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </aside>
      )}

    </div>
  );
}
