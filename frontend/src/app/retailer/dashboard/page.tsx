"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Apple,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Coffee,
  Cookie,
  Droplets,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
  Wallet,
  Wheat,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";
import { addToCart } from "@/lib/cart";
import { ProductThumbnail } from "@/components/ui/product-thumbnail";

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
  lines?: Array<{
    product_id: string;
    product_name: string;
    sku: string;
    quantity: number;
    quantity_unit: "CASE" | "PIECE";
    unit_price: number;
  }>;
}

interface OrdersResponse {
  items: RetailerOrder[];
  total: number;
}

interface CreditSummary {
  credit_limit: number;
  current_outstanding: number;
  available_credit: number;
  utilization_percentage: number;
  retailer: {
    shop_name: string;
    owner_name: string;
  };
}

interface LedgerResponse {
  summary: CreditSummary;
}

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
  price: number | null;
  image_url?: string | null;
  gst_included: boolean | null;
  quantity_available: number;
  is_in_stock: boolean;
  schemes?: ProductScheme[];
}

interface CatalogueResponse {
  items: CatalogueProduct[];
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatScheme(scheme: ProductScheme): string {
  if (scheme.scheme_type === "BUY_X_GET_Y" && scheme.buy_quantity && scheme.reward_quantity) {
    return `Buy ${scheme.buy_quantity} Get ${scheme.reward_quantity} Free`;
  }
  if (scheme.scheme_type === "SLAB_DISCOUNT" && scheme.min_quantity && scheme.discount_value) {
    return scheme.discount_type === "PERCENTAGE"
      ? `${scheme.discount_value}% off at ${scheme.min_quantity}+ cases`
      : `₹${scheme.discount_value} off at ${scheme.min_quantity}+ cases`;
  }
  return scheme.scheme_name;
}

function orderStatusClass(status: string): string {
  switch (status.toUpperCase()) {
    case "DELIVERED":
    case "COMPLETED":
      return "bg-[#EEF6F1] text-[#356545]";
    case "CANCELLED":
    case "REJECTED":
      return "bg-[#FBF0F0] text-[#8C2828]";
    case "APPROVED":
    case "DISPATCHED":
      return "bg-[#F4EFF0] text-[#67474E]";
    default:
      return "bg-[#F0EFEA] text-[#666864]";
  }
}

function ProductCard({
  product,
  added,
  onAdd,
}: {
  product: CatalogueProduct;
  added: boolean;
  onAdd: () => void;
}) {
  const casePrice =
    product.price !== null && product.units_per_case > 1
      ? product.price * product.units_per_case
      : null;
  const isAvailable = product.is_in_stock && product.quantity_available > 0;

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-md border border-[#E8E5DE] bg-white">
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <ProductThumbnail
          name={product.name}
          category={product.category}
          brandName={product.brand_name}
          imageUrl={product.image_url}
          size="md"
          className="h-[68px] w-[68px] shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-[#817F79]">
            {product.brand_name}
          </p>
          <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-5 text-[#272824]">
            {product.name}
          </h3>
          <p className="mt-1 text-xs text-[#706F68]">
            {product.pack_size} {product.pack_unit}
            {product.units_per_case > 1 && (
              <span> · {product.units_per_case} pieces/case</span>
            )}
          </p>
          <p className={`mt-1 text-[11px] ${isAvailable ? "text-[#477553]" : "text-[#8C2828]"}`}>
            {isAvailable ? "In stock" : "Out of stock"}
          </p>
        </div>
      </div>

      <div className="mt-auto flex items-end justify-between gap-2 border-t border-[#F0EFEA] px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          {product.price !== null ? (
            <>
              <p className="text-sm font-bold tabular-nums text-[#272824]">
                {formatCurrency(casePrice ?? product.price)}
                <span className="ml-1 text-[10px] font-normal text-[#817F79]">
                  / {casePrice !== null ? "case" : "piece"}
                </span>
              </p>
              {casePrice !== null && (
                <p className="mt-0.5 text-[10px] text-[#817F79]">
                  {formatCurrency(product.price)} per piece
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-[#817F79]">Price unavailable</p>
          )}
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={!isAvailable || product.price === null}
          aria-label={`Add ${product.name} ${product.units_per_case > 1 ? "case" : "piece"} to cart`}
          className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79565D] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#F0EFEA] disabled:text-[#96958F] ${
            added
              ? "bg-[#EEF6F1] text-[#356545]"
              : "bg-[#79565D] text-white hover:bg-[#67474E]"
          }`}
        >
          {added ? <Check size={14} /> : <Plus size={14} />}
          <span>{added ? "Added" : product.units_per_case > 1 ? "Add case" : "Add piece"}</span>
        </button>
      </div>
    </article>
  );
}

export default function RetailerDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [creditSummary, setCreditSummary] = useState<CreditSummary | null>(null);
  const [orders, setOrders] = useState<RetailerOrder[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueProduct[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);
  const [ordersUnavailable, setOrdersUnavailable] = useState(false);
  const [catalogueUnavailable, setCatalogueUnavailable] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());
  const [cartMessage, setCartMessage] = useState("");

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

        const [creditRes, ordersRes, catalogueRes] = await Promise.allSettled([
          apiRequest<LedgerResponse>("/retailer/credit/ledger?limit=1"),
          apiRequest<OrdersResponse>("/orders"),
          apiRequest<CatalogueResponse>("/products/catalogue?page=1&page_size=100"),
        ]);
        if (cancelled) return;

        const warnings: string[] = [];
        if (creditRes.status === "fulfilled" && creditRes.value.summary) {
          setCreditSummary(creditRes.value.summary);
        } else {
          warnings.push("Credit information could not be loaded.");
        }
        if (ordersRes.status === "fulfilled") {
          setOrders(ordersRes.value.items ?? []);
        } else {
          setOrdersUnavailable(true);
          warnings.push("Recent orders could not be loaded.");
        }
        if (catalogueRes.status === "fulfilled") {
          setCatalogue(
            (catalogueRes.value.items ?? []).map((product) => ({
              ...product,
              is_in_stock: Number(product.quantity_available) > 0,
            }))
          );
        } else {
          setCatalogueUnavailable(true);
          warnings.push("Catalogue products could not be loaded.");
        }
        setLoadWarnings(warnings);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
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

  const recentOrders = useMemo(
    () =>
      [...orders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [orders]
  );

  const upcomingOrders = useMemo(
    () =>
      recentOrders.filter((order) =>
        ["SUBMITTED", "PENDING", "HOLD", "APPROVED", "PROCESSING", "DISPATCHED"].includes(
          order.status.toUpperCase()
        )
      ),
    [recentOrders]
  );
  const upcomingOrderStatus = upcomingOrders[0]?.status.toUpperCase();
  const upcomingOrderMessage =
    upcomingOrderStatus === "DISPATCHED"
      ? "On its way to your shop"
      : upcomingOrderStatus === "APPROVED" || upcomingOrderStatus === "PROCESSING"
        ? "Your order is being prepared"
        : "Order received, awaiting confirmation";

  const categories = useMemo(() => {
    const categoryProducts = new Map<string, CatalogueProduct>();
    for (const product of catalogue) {
      if (product.category && !categoryProducts.has(product.category)) {
        categoryProducts.set(product.category, product);
      }
    }
    return Array.from(categoryProducts.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [catalogue]);

  const buyAgainProducts = useMemo(() => {
    const latestPurchases = new Map<
      string,
      { quantityUnit: "CASE" | "PIECE" }
    >();
    for (const order of recentOrders) {
      for (const line of order.lines ?? []) {
        if (!latestPurchases.has(line.product_id)) {
          latestPurchases.set(line.product_id, {
            quantityUnit: line.quantity_unit,
          });
        }
      }
    }
    return Array.from(latestPurchases.entries())
      .map(([productId, purchase]) => {
        const product = catalogue.find((item) => item.id === productId);
        return product ? { product, quantityUnit: purchase.quantityUnit } : null;
      })
      .filter(
        (item): item is { product: CatalogueProduct; quantityUnit: "CASE" | "PIECE" } =>
          item !== null
      )
      .slice(0, 8);
  }, [recentOrders, catalogue]);

  const popularProducts = useMemo(() => {
    const purchaseCounts = new Map<string, number>();
    for (const order of orders) {
      for (const line of order.lines ?? []) {
        purchaseCounts.set(
          line.product_id,
          (purchaseCounts.get(line.product_id) ?? 0) + 1
        );
      }
    }
    return catalogue
      .filter(
        (product) =>
          product.is_in_stock &&
          product.price !== null &&
          purchaseCounts.has(product.id)
      )
      .sort(
        (a, b) =>
          (purchaseCounts.get(b.id) ?? 0) - (purchaseCounts.get(a.id) ?? 0) ||
          a.name.localeCompare(b.name)
      )
      .slice(0, 8);
  }, [orders, catalogue]);

  const activeOffers = useMemo(
    () =>
      catalogue.flatMap((product) =>
        (product.schemes ?? []).map((scheme) => ({ product, scheme }))
      ).slice(0, 8),
    [catalogue]
  );

  const retailerName =
    creditSummary?.retailer?.owner_name || creditSummary?.retailer?.shop_name || "";
  const creditUtilization = Math.max(
    0,
    Math.min(creditSummary?.utilization_percentage ?? 0, 100)
  );
  const creditBarColor =
    creditUtilization > 85
      ? "bg-[#8C2828]"
      : creditUtilization > 60
        ? "bg-[#D97706]"
        : "bg-[#477553]";

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchInput.trim();
    router.push(
      query
        ? `/retailer/catalogue?search=${encodeURIComponent(query)}`
        : "/retailer/catalogue"
    );
  };

  const handleQuickAdd = (
    product: CatalogueProduct,
    quantityUnit: "CASE" | "PIECE" =
      product.units_per_case > 1 ? "CASE" : "PIECE"
  ) => {
    if (product.price === null) {
      setCartMessage("This product has no retailer price yet.");
      return;
    }
    if (!product.is_in_stock || product.quantity_available <= 0) {
      setCartMessage("This product is currently out of stock.");
      return;
    }
    try {
      addToCart({
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        brand_name: product.brand_name,
        pack_size: product.pack_size,
        pack_unit: product.pack_unit,
        units_per_case: product.units_per_case,
        price: product.price,
        gst_included: product.gst_included ?? false,
        quantity_available: product.quantity_available,
        quantity: 1,
        quantity_unit,
        image_url: product.image_url,
      });
      setAddedProducts((current) => new Set(current).add(product.id));
      setCartMessage(`${product.name} added to cart.`);
      window.setTimeout(() => {
        setAddedProducts((current) => {
          const next = new Set(current);
          next.delete(product.id);
          return next;
        });
      }, 1500);
      window.setTimeout(() => setCartMessage(""), 2500);
    } catch (addError) {
      setCartMessage(
        addError instanceof Error ? addError.message : "Unable to add this product."
      );
    }
  };

  if (loading || pageLoading) {
    return (
      <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-7">
        <div className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-[#E7E6E0]" />
          <div className="h-8 w-64 animate-pulse rounded bg-[#E7E6E0]" />
        </div>
        <div className="h-40 animate-pulse rounded-md bg-[#E7E6E0]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-44 animate-pulse rounded-md bg-[#E7E6E0]" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center px-4">
        <div className="w-full max-w-md rounded-md border border-[#EDBCBC] bg-[#FBF0F0] p-6 text-center">
          <h2 className="text-sm font-bold text-[#8C2828]">Unable to open dashboard</h2>
          <p className="mt-1 text-xs text-[#8C2828]/80">
            {error || "Your retailer profile could not be loaded."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded bg-[#79565D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#67474E]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="w-full space-y-8 px-4 py-6 pb-24 sm:px-6 sm:py-8 md:pb-8 lg:px-7">
      <section
        aria-labelledby="dashboard-greeting"
        className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#817F79]">
            WELCOME BACK
          </p>
          <h1 id="dashboard-greeting" className="mt-1 text-2xl font-semibold tracking-tight text-[#272824] sm:text-3xl">
            Namaste{retailerName ? `, ${retailerName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-[#706F68]">
            Here&apos;s what&apos;s available for your shop today.
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          className="relative flex h-14 w-full max-w-2xl items-center rounded-full border border-white/80 bg-white/65 p-1.5 shadow-[0_8px_24px_rgba(54,44,40,0.08)] backdrop-blur-xl transition-shadow focus-within:shadow-[0_10px_30px_rgba(54,44,40,0.12)] md:max-w-[min(42vw,560px)]"
        >
          <Search
            size={17}
            aria-hidden="true"
            className="pointer-events-none ml-3 shrink-0 text-[#89877F]"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search products, brands or SKUs"
            aria-label="Search catalogue"
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-[#272824] outline-none placeholder:text-[#96958F]"
          />
          <button
            type="submit"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-[#79565D]/95 px-5 text-xs font-semibold text-white shadow-[0_4px_12px_rgba(65,42,47,0.2)] backdrop-blur-md transition hover:bg-[#67474E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79565D] focus-visible:ring-offset-2"
          >
            Search
          </button>
        </form>

        {loadWarnings.length > 0 && (
          <p role="status" className="text-xs text-[#8C5A21]">
            {loadWarnings.join(" ")}
          </p>
        )}
      </section>

      <section aria-labelledby="credit-heading">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="credit-heading" className="text-lg font-semibold text-[#272824]">
              Available Credit
            </h2>
            <p className="mt-0.5 text-xs text-[#817F79]">Your account balance and next delivery</p>
          </div>
          <Link
            href="/retailer/credit"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#79565D] hover:underline"
          >
            Credit details <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Link
            href="/retailer/credit"
            className="rounded-md border border-[#E8E5DE] bg-white p-4 transition-colors hover:border-[#CFC4C5] sm:p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#706F68]">Available balance</span>
              <Wallet size={17} className="text-[#79565D]" />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-[#272824] sm:text-3xl">
              {creditSummary ? formatCurrency(creditSummary.available_credit) : "—"}
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#F0EFEA]">
              <div
                className={`h-full rounded-full ${creditBarColor}`}
                style={{ width: `${creditSummary ? creditUtilization : 0}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-[#706F68]">
              <span>
                Used {creditSummary ? formatCurrency(creditSummary.current_outstanding) : "—"}
                {creditSummary && ` · ${creditUtilization.toFixed(0)}%`}
              </span>
              <span>
                Limit {creditSummary ? formatCurrency(creditSummary.credit_limit) : "—"}
              </span>
            </div>
          </Link>

          <Link
            href="/retailer/orders"
            className="flex min-h-40 flex-col justify-between rounded-md border border-[#E8E5DE] bg-white p-4 transition-colors hover:border-[#CFC4C5] sm:p-5"
          >
            <div className="flex items-center justify-between">
              <span>
                <span className="block text-xs font-medium text-[#706F68]">Order coming soon</span>
                <span className="mt-1 block text-[11px] text-[#817F79]">
                  Get your shop ready
                </span>
              </span>
              <ShoppingBag size={17} className="text-[#79565D]" />
            </div>
            {ordersUnavailable ? (
              <p className="mt-4 text-sm text-[#817F79]">
                Order data could not be loaded.
              </p>
            ) : upcomingOrders[0] ? (
              <div className="mt-4 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-[#272824]">
                    {upcomingOrders[0].order_number}
                  </p>
                  <p className="mt-1 text-xs text-[#817F79]">
                    {upcomingOrderMessage}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold tabular-nums text-[#272824]">
                    {formatCurrency(upcomingOrders[0].total_amount)}
                  </p>
                  <span
                    className={`mt-1 inline-flex rounded px-2 py-1 text-[10px] font-medium ${orderStatusClass(upcomingOrders[0].status)}`}
                  >
                    {upcomingOrders[0].status}
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[#817F79]">
                No incoming orders right now. Place an order and we&apos;ll keep you updated.
              </p>
            )}
          </Link>
        </div>
      </section>

      <section aria-labelledby="buy-again-heading">
        <SectionHeading
          id="buy-again-heading"
          title="Buy Again"
          description="Products from your recent orders"
          href="/retailer/orders"
          linkLabel="Order history"
        />
        {ordersUnavailable || catalogueUnavailable ? (
          <EmptyState
            icon={ShoppingBag}
            title="Buy Again is unavailable"
            description="Order history or catalogue data could not be loaded."
          />
        ) : buyAgainProducts.length > 0 ? (
          <ProductGrid>
            {buyAgainProducts.map(({ product, quantityUnit }) => (
              <ProductCard
                key={product.id}
                product={product}
                added={addedProducts.has(product.id)}
                onAdd={() => handleQuickAdd(product, quantityUnit)}
              />
            ))}
          </ProductGrid>
        ) : (
          <EmptyState
            icon={ShoppingBag}
            title="No previous products to reorder"
            description="Products from your orders will appear here."
            href="/retailer/catalogue"
            linkLabel="Browse catalogue"
          />
        )}
      </section>

      <section aria-labelledby="categories-heading">
        <SectionHeading
          id="categories-heading"
          title="Shop by Category"
          description="Browse the catalogue by range"
          href="/retailer/catalogue"
          linkLabel="View catalogue"
        />
        {catalogueUnavailable ? (
          <EmptyState
            icon={Package}
            title="Categories could not be loaded"
            description="Please try again in a moment."
          />
        ) : categories.length > 0 ? (
          <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
            <div className="flex w-max gap-5 pb-2 sm:gap-6">
            {categories.map(([category, product]) => {
              const Icon = CATEGORY_ICONS[category] ?? Package;
              return (
                <Link
                  key={category}
                  href={`/retailer/catalogue?category=${encodeURIComponent(category)}`}
                  className="group flex w-[92px] shrink-0 flex-col items-center text-center sm:w-[112px] md:w-[128px]"
                >
                  <span className="flex h-[76px] w-[76px] items-center justify-center overflow-hidden bg-[#F0EFEA] transition-transform group-hover:scale-[1.03] sm:h-[88px] sm:w-[88px] md:h-[104px] md:w-[104px]">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-contain mix-blend-multiply"
                      />
                    ) : (
                      <Icon size={28} aria-hidden="true" className="text-[#79565D]" />
                    )}
                  </span>
                  <span className="mt-2 w-full truncate text-xs font-semibold text-[#272824]">
                    {category}
                  </span>
                </Link>
              );
            })}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Package}
            title="Categories are unavailable"
            description="The catalogue has no categories to display right now."
          />
        )}
      </section>

      <section aria-labelledby="offers-heading">
        <SectionHeading
          id="offers-heading"
          title="Offers & Schemes"
          description="Offers available on your retailer catalogue"
          href="/retailer/catalogue"
          linkLabel="Shop offers"
        />
        {catalogueUnavailable ? (
          <EmptyState
            icon={Tag}
            title="Offers could not be loaded"
            description="Please try again in a moment."
          />
        ) : activeOffers.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {activeOffers.map(({ product, scheme }, index) => (
              <Link
                key={`${product.id}-${scheme.scheme_name}-${index}`}
                href={`/retailer/catalogue?search=${encodeURIComponent(product.sku)}`}
                className="flex min-w-0 items-center gap-3 rounded-md border border-[#E8E5DE] bg-white p-3 transition-colors hover:border-[#CFC4C5]"
              >
                <ProductThumbnail
                  name={product.name}
                  category={product.category}
                  brandName={product.brand_name}
                  imageUrl={product.image_url}
                  size="md"
                  className="h-12 w-12 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[#79565D]">
                    <Tag size={12} /> Offer
                  </span>
                  <span className="mt-1 block truncate text-sm font-semibold text-[#272824]">
                    {formatScheme(scheme)}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[#817F79]">
                    {product.brand_name} · {product.name}
                  </span>
                </span>
                <ChevronRight size={15} className="shrink-0 text-[#817F79]" />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Tag}
            title="No active offers"
            description="Retailer-eligible schemes will appear here when available."
          />
        )}
      </section>

      <section aria-labelledby="popular-heading">
        <SectionHeading
          id="popular-heading"
          title="Popular Products"
          description="Frequently ordered items from your order history"
          href="/retailer/catalogue"
          linkLabel="Full catalogue"
        />
        {ordersUnavailable || catalogueUnavailable ? (
          <EmptyState
            icon={Package}
            title="Popular products are unavailable"
            description="Order history or catalogue data could not be loaded."
          />
        ) : popularProducts.length > 0 ? (
          <ProductGrid>
            {popularProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                added={addedProducts.has(product.id)}
                onAdd={() => handleQuickAdd(product)}
              />
            ))}
          </ProductGrid>
        ) : (
          <EmptyState
            icon={Package}
            title={orders.length > 0 ? "No popular products available" : "No purchase history yet"}
            description={
              orders.length > 0
                ? "In-stock products with a retailer price will appear here."
                : "Products you order will appear here based on your order history."
            }
            href="/retailer/catalogue"
            linkLabel="Browse catalogue"
          />
        )}
      </section>

      <section aria-labelledby="recent-orders-heading">
        <SectionHeading
          id="recent-orders-heading"
          title="Recent Orders"
          description="Your latest order activity"
          href="/retailer/orders"
          linkLabel="All orders"
        />
        {ordersUnavailable ? (
          <EmptyState
            icon={ShoppingBag}
            title="Recent orders could not be loaded"
            description="Please try again in a moment."
          />
        ) : recentOrders.length > 0 ? (
          <div className="overflow-hidden rounded-md border border-[#E8E5DE] bg-white">
            {recentOrders.slice(0, 5).map((order, index) => (
              <Link
                key={order.id}
                href="/retailer/orders"
                className={`flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-[#FAF9F6] sm:px-5 ${
                  index > 0 ? "border-t border-[#F0EFEA]" : ""
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[#F4EFF0] text-[#79565D]">
                    <Package size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[#272824]">
                      {order.order_number}
                    </span>
                    <span className="mt-1 flex items-center gap-1 text-xs text-[#817F79]">
                      <Clock3 size={12} />
                      {new Date(order.created_at).toLocaleDateString("en-IN")}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-sm font-semibold tabular-nums text-[#272824]">
                    {formatCurrency(order.total_amount)}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-medium ${orderStatusClass(order.status)}`}
                  >
                    {order.status}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ShoppingBag}
            title="No recent orders"
            description="Your order updates will appear here."
            href="/retailer/catalogue"
            linkLabel="Start shopping"
          />
        )}
      </section>

      <p className="sr-only" aria-live="polite" role="status">
        {cartMessage}
      </p>
    </main>
  );
}

function SectionHeading({
  id,
  title,
  description,
  href,
  linkLabel,
}: {
  id: string;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 id={id} className="text-lg font-semibold text-[#272824]">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-[#817F79]">{description}</p>
      </div>
      <Link
        href={href}
        className="inline-flex min-h-9 shrink-0 items-center gap-1 text-xs font-semibold text-[#79565D] hover:underline"
      >
        {linkLabel} <ChevronRight size={14} />
      </Link>
    </div>
  );
}

function ProductGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  href,
  linkLabel,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-[#DDD9D1] bg-white px-4 py-7 text-center">
      <Icon size={22} aria-hidden="true" className="mx-auto text-[#8D8981]" />
      <p className="mt-2 text-sm font-semibold text-[#272824]">{title}</p>
      <p className="mt-1 text-xs text-[#817F79]">{description}</p>
      {href && linkLabel && (
        <Link
          href={href}
          className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded border border-[#E6E3DC] px-3 text-xs font-semibold text-[#67474E] hover:bg-[#FAF9F6]"
        >
          {linkLabel} <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
}
