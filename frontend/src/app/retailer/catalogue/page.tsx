
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Package,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";
import {
  addToCart,
  getCart,
  removeFromCart,
  updateCartQuantity,
  type CartItem,
} from "@/lib/cart";

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

export default function RetailerCataloguePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [cartMessage, setCartMessage] = useState("");
  const [cartError, setCartError] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const pageSize = 20;

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });

      if (search.trim()) params.set("search", search.trim());
      if (category) params.set("category", category);

      const response = await apiRequest<CatalogueResponse>(
        `/products/catalogue?${params.toString()}`
      );

      setProducts(
        response.items.map((product) => ({
          ...product,
          is_in_stock: product.quantity_available > 0,
        })),
      );
      setTotal(response.total);

      setCategories((previous) =>
        Array.from(
          new Set([
            ...previous,
            ...response.items.map((product) => product.category),
          ])
        ).sort()
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the product catalogue."
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, search, category]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/register");
      return;
    }

    fetchProducts();
  }, [user, loading, router, fetchProducts]);

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

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
  }

  function handleAddToCart(product: CatalogueProduct) {
    if (product.price === null) {
      setCartError("Price is not configured for this product.");
      setCartMessage("");
      return;
    }

    if (
      product.quantity_available === undefined ||
      product.quantity_available <= 0
    ) {
      setCartError("This product is currently out of stock.");
      setCartMessage("");
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
        quantity_unit: "PIECE",
      };

      addToCart(item);

      setCartMessage(`${product.name} added to cart.`);
      setCartError("");
    } catch (error) {
      setCartError(
        error instanceof Error ? error.message : "Unable to add product.",
      );
      setCartMessage("");
    }
  }

  function handleCartQuantityChange(
    product: CatalogueProduct,
    quantity: number,
  ) {
    try {
      if (quantity <= 0) {
        removeFromCart(product.id, "PIECE");
      } else {
        updateCartQuantity(product.id, "PIECE", quantity);
      }
      setCartItems(getCart());
      setCartError("");
      setCartMessage("");
    } catch (error) {
      setCartError(
        error instanceof Error ? error.message : "Unable to update quantity.",
      );
      setCartMessage("");
    }
  }

  function renderCartControl(product: CatalogueProduct) {
    const cartItem = cartItems.find(
      (item) =>
        item.product_id === product.id && item.quantity_unit === "PIECE",
    );

    if (cartItem) {
      return (
        <div className="inline-flex items-center border border-neutral-300">
          <button
            type="button"
            onClick={() =>
              handleCartQuantityChange(product, cartItem.quantity - 1)
            }
            className="p-2 hover:bg-neutral-100"
            aria-label={`Decrease ${product.name} quantity`}
          >
            <Minus size={16} />
          </button>
          <input
            type="number"
            min="1"
            max={Math.floor(product.quantity_available)}
            step="1"
            value={cartItem.quantity}
            onChange={(event) => {
              const quantity = Number(event.target.value);
              if (Number.isInteger(quantity) && quantity > 0) {
                handleCartQuantityChange(product, quantity);
              }
            }}
            className="w-14 appearance-none text-center text-sm outline-none"
            aria-label={`${product.name} quantity`}
          />
          <button
            type="button"
            onClick={() =>
              handleCartQuantityChange(product, cartItem.quantity + 1)
            }
            disabled={
              cartItem.quantity >= Math.floor(product.quantity_available)
            }
            className="p-2 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`Increase ${product.name} quantity`}
          >
            <Plus size={16} />
          </button>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => handleAddToCart(product)}
        disabled={!product.is_in_stock || product.price === null}
        className="border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-300"
      >
        {!product.is_in_stock
          ? "Out of stock"
          : product.price === null
            ? "Price unavailable"
            : "Add to cart"}
      </button>
    );
  }

  function formatPrice(price: number | null) {
    if (price === null) return "Price unavailable";

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(price);
  }

  if (loading) {
    return (
      <main className="min-h-screen w-full bg-[#f7f7f5] px-4 py-5 text-sm text-neutral-500 sm:px-6 lg:px-8">
        Loading account...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-neutral-900">
      <div className="w-full px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">
              Orderly / Retailer
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Product catalogue
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              Browse products and view your applicable distributor prices.
            </p>
          </div>

        </header>

        <section className="mb-6 border border-neutral-200 bg-white p-4 sm:p-5">
          <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search product, SKU or brand..."
                className="w-full border border-neutral-300 py-3 pl-10 pr-3 text-sm outline-none focus:border-neutral-900"
              />
            </div>

            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setPage(1);
              }}
              className="w-full border border-neutral-300 bg-white px-3 py-3 text-sm outline-none focus:border-neutral-900 sm:w-auto"
            >
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="w-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-neutral-700 sm:w-auto"
            >
              Search
            </button>
          </form>
        </section>

        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-neutral-600">
            {total} products found
          </p>
          <p className="text-xs text-neutral-500">
            Prices in INR
          </p>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div aria-live="polite" className="text-sm">
            {cartMessage && (
              <p className="text-green-700">{cartMessage}</p>
            )}
            {cartError && <p className="text-red-600">{cartError}</p>}
          </div>

          <Link
            href="/retailer/cart"
            className="border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            View cart
          </Link>
        </div>

        {error && (
          <div className="mb-5 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
            <button
              onClick={fetchProducts}
              className="ml-3 font-semibold underline"
            >
              Retry
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="border border-neutral-200 bg-white p-12 text-center text-sm text-neutral-500">
            Loading products...
          </div>
        ) : products.length === 0 ? (
          <div className="border border-neutral-200 bg-white px-6 py-16 text-center">
            <Package className="mx-auto mb-3 text-neutral-400" size={32} />
            <h2 className="font-medium">No products found</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Try changing your search or category filter.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3 xl:hidden">
              {products.map((product) => (
                <article
                  key={product.id}
                  className="border border-neutral-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-medium">{product.name}</h2>
                      <p className="mt-1 text-xs text-neutral-500">
                        {product.brand_name} · {product.sku}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold">
                        {formatPrice(product.price)}
                      </p>
                      {product.gst_included !== null && (
                        <p className="mt-1 text-xs text-neutral-500">
                          GST {product.gst_included ? "included" : "excluded"}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                    <span>
                      {product.pack_size} {product.pack_unit}
                    </span>
                    <span>{product.units_per_case} units/case</span>
                    <span>{product.category}</span>
                    <span>
                      {product.quantity_available > 0
                        ? `${product.quantity_available} available`
                        : "Out of stock"}
                    </span>
                  </div>

                  <div className="mt-4 flex justify-end">
                    {renderCartControl(product)}
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto border border-neutral-200 bg-white xl:block">
              <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-5 py-4">Product</th>
                  <th className="px-5 py-4">SKU</th>
                  <th className="px-5 py-4">Pack</th>
                  <th className="px-5 py-4">Category</th>
                  <th className="px-5 py-4">GST</th>
                  <th className="px-5 py-4 text-right">Your price</th>
                  <th className="px-5 py-4 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-100">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-neutral-50">
                    <td className="px-5 py-4">
                      <p className="font-medium">{product.name}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {product.brand_name}
                      </p>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-neutral-600">
                      {product.sku}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {product.pack_size} {product.pack_unit}
                      <p className="mt-1 text-xs text-neutral-400">
                        {product.units_per_case} units/case
                      </p>
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {product.category}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {product.gst_rate === null
                        ? "Not specified"
                        : `${product.gst_rate}%`}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <p className="font-semibold">
                        {formatPrice(product.price)}
                      </p>
                      {product.gst_included !== null && (
                        <p className="mt-1 text-xs text-neutral-500">
                          GST {product.gst_included ? "included" : "excluded"}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {renderCartControl(product)}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </>
        )}

        <footer className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-500">
            Page {page} of {totalPages}
          </p>

          <div className="flex gap-2">
            <button
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((current) => current - 1)}
              className="border border-neutral-300 bg-white p-2 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((current) => current + 1)}
              className="border border-neutral-300 bg-white p-2 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}
