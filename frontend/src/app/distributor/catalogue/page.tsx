"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";

interface BrandItem {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

interface ProductItem {
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
  is_active: boolean;
  price: number;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  active_schemes_count: number;
  created_at: string;
}

interface SchemeRuleItem {
  id: string;
  tier_number: number;
  quantity_unit: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  reward_product_id: string | null;
  reward_product_name: string | null;
  reward_product_sku: string | null;
  buy_quantity: number | null;
  reward_quantity: number | null;
  min_quantity: number | null;
  discount_type: string | null;
  discount_value: number | null;
}

interface SchemeItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  scheme_type: "BUY_X_GET_Y" | "SLAB_DISCOUNT";
  valid_from: string;
  valid_to: string;
  applies_to_all_retailers: boolean;
  is_active: boolean;
  created_at: string;
  rules: SchemeRuleItem[];
}

interface UserProfile {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
}

const ALLOWED_ROLES = new Set(["DISTRIBUTOR_ADMIN"]);

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(isoString: string): string {
  if (!isoString) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(isoString));
}

export default function DistributorCataloguePage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"PRODUCTS" | "SCHEMES">("PRODUCTS");

  // Data states
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [schemes, setSchemes] = useState<SchemeItem[]>([]);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Filters
  const [productSearch, setProductSearch] = useState("");
  const [productStatus, setProductStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const [schemeSearch, setSchemeSearch] = useState("");
  const [schemeStatus, setSchemeStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Add Product Modal
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newSku, setNewSku] = useState("");
  const [newName, setNewName] = useState("");
  const [newBrandId, setNewBrandId] = useState("");
  const [newCategory, setNewCategory] = useState("Beverages");
  const [newPackSize, setNewPackSize] = useState("500");
  const [newPackUnit, setNewPackUnit] = useState("ml");
  const [newUnitsPerCase, setNewUnitsPerCase] = useState("24");
  const [newHsn, setNewHsn] = useState("2202");
  const [newGstRate, setNewGstRate] = useState("18");
  const [newPrice, setNewPrice] = useState("720.00");
  const [newInitialStock, setNewInitialStock] = useState("100");
  const [savingProduct, setSavingProduct] = useState(false);

  // Quick Brand Add
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandCode, setNewBrandCode] = useState("");
  const [savingBrand, setSavingBrand] = useState(false);

  // Edit Product Modal
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Add Scheme Modal
  const [showAddSchemeModal, setShowAddSchemeModal] = useState(false);
  const [newSchemeCode, setNewSchemeCode] = useState("");
  const [newSchemeName, setNewSchemeName] = useState("");
  const [newSchemeDescription, setNewSchemeDescription] = useState("");
  const [newSchemeType, setNewSchemeType] = useState<"BUY_X_GET_Y" | "SLAB_DISCOUNT">("BUY_X_GET_Y");
  const [newSchemeProductId, setNewSchemeProductId] = useState("");
  const [newBuyQty, setNewBuyQty] = useState("10");
  const [newRewardQty, setNewRewardQty] = useState("1");
  const [newRewardProductId, setNewRewardProductId] = useState("");
  const [newMinQty, setNewMinQty] = useState("20");
  const [newDiscountType, setNewDiscountType] = useState<"PERCENTAGE" | "FIXED_AMOUNT">("PERCENTAGE");
  const [newDiscountValue, setNewDiscountValue] = useState("5");
  const [newValidFrom, setNewValidFrom] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [newValidTo, setNewValidTo] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [savingScheme, setSavingScheme] = useState(false);

  // 1. Authenticate user
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

  // 2. Load catalogue data
  const loadCatalogue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [productsRes, schemesRes, brandsRes] = await Promise.all([
        apiRequest<{ items: ProductItem[]; total: number }>(
          `/distributor/products?status_filter=${productStatus}${
            productSearch ? `&search=${encodeURIComponent(productSearch)}` : ""
          }`
        ),
        apiRequest<{ items: SchemeItem[]; total: number }>(
          `/distributor/schemes?status_filter=${schemeStatus}${
            schemeSearch ? `&search=${encodeURIComponent(schemeSearch)}` : ""
          }`
        ),
        apiRequest<BrandItem[]>("/distributor/products/brands"),
      ]);

      setProducts(productsRes.items || []);
      setSchemes(schemesRes.items || []);
      setBrands(brandsRes || []);

      if (brandsRes.length > 0 && !newBrandId) {
        setNewBrandId(brandsRes[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load catalogue data.");
    } finally {
      setLoading(false);
    }
  }, [productStatus, productSearch, schemeStatus, schemeSearch, newBrandId]);

  useEffect(() => {
    if (profile && ALLOWED_ROLES.has(profile.role)) {
      void loadCatalogue();
    }
  }, [profile, loadCatalogue]);

  // Toggle product status
  const handleToggleProductStatus = async (productId: string, currentName: string) => {
    try {
      setError(null);
      const res = await apiRequest<{ id: string; is_active: boolean; message: string }>(
        `/distributor/products/${productId}/toggle-status`,
        { method: "POST" }
      );
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, is_active: res.is_active } : p))
      );
      setFeedback(res.message);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change product status.");
    }
  };

  // Toggle scheme status
  const handleToggleSchemeStatus = async (schemeId: string, currentName: string) => {
    try {
      setError(null);
      const res = await apiRequest<{ id: string; is_active: boolean; message: string }>(
        `/distributor/schemes/${schemeId}/toggle-status`,
        { method: "POST" }
      );
      setSchemes((prev) =>
        prev.map((s) => (s.id === schemeId ? { ...s, is_active: res.is_active } : s))
      );
      setFeedback(res.message);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change scheme status.");
    }
  };

  // Create Brand
  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName || !newBrandCode) return;
    setSavingBrand(true);
    setError(null);

    try {
      const created = await apiRequest<BrandItem>("/distributor/products/brands", {
        method: "POST",
        body: JSON.stringify({
          name: newBrandName,
          code: newBrandCode,
        }),
      });

      setBrands((prev) => [...prev, created]);
      setNewBrandId(created.id);
      setShowAddBrand(false);
      setNewBrandName("");
      setNewBrandCode("");
      setFeedback(`Brand '${created.name}' added.`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create brand.");
    } finally {
      setSavingBrand(false);
    }
  };

  // Create Product
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSku || !newName || !newBrandId) return;
    setSavingProduct(true);
    setError(null);

    try {
      const res = await apiRequest<{ id: string; message: string }>(
        "/distributor/products",
        {
          method: "POST",
          body: JSON.stringify({
            sku: newSku,
            name: newName,
            brand_id: newBrandId,
            category: newCategory,
            pack_size: parseFloat(newPackSize),
            pack_unit: newPackUnit,
            units_per_case: parseInt(newUnitsPerCase, 10),
            hsn_code: newHsn || null,
            gst_rate: newGstRate ? parseFloat(newGstRate) : null,
            price: parseFloat(newPrice),
            initial_stock: parseFloat(newInitialStock),
          }),
        }
      );

      setFeedback(res.message);
      setTimeout(() => setFeedback(null), 3000);
      setShowAddProductModal(false);
      // Reset form
      setNewSku("");
      setNewName("");
      void loadCatalogue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product.");
    } finally {
      setSavingProduct(false);
    }
  };

  // Open Edit Product Modal
  const openEditModal = (p: ProductItem) => {
    setEditingProduct(p);
    setEditName(p.name);
    setEditCategory(p.category);
    setEditPrice(p.price.toString());
    setEditStock(p.quantity_on_hand.toString());
  };

  // Save Edit Product
  const handleSaveEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setSavingEdit(true);
    setError(null);

    try {
      const res = await apiRequest<{ id: string; message: string }>(
        `/distributor/products/${editingProduct.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: editName,
            category: editCategory,
            price: parseFloat(editPrice),
            stock_on_hand: parseFloat(editStock),
          }),
        }
      );

      setFeedback(res.message);
      setTimeout(() => setFeedback(null), 3000);
      setEditingProduct(null);
      void loadCatalogue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update product.");
    } finally {
      setSavingEdit(false);
    }
  };

  // Create Scheme
  const handleCreateScheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchemeCode || !newSchemeName || !newSchemeProductId) return;
    setSavingScheme(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        code: newSchemeCode,
        name: newSchemeName,
        description: newSchemeDescription || null,
        scheme_type: newSchemeType,
        product_id: newSchemeProductId,
        valid_from: new Date(`${newValidFrom}T00:00:00Z`).toISOString(),
        valid_to: new Date(`${newValidTo}T23:59:59Z`).toISOString(),
        quantity_unit: "CASE",
      };

      if (newSchemeType === "BUY_X_GET_Y") {
        payload.buy_quantity = parseFloat(newBuyQty);
        payload.reward_quantity = parseFloat(newRewardQty);
        payload.reward_product_id = newRewardProductId || newSchemeProductId;
      } else {
        payload.min_quantity = parseFloat(newMinQty);
        payload.discount_type = newDiscountType;
        payload.discount_value = parseFloat(newDiscountValue);
      }

      const res = await apiRequest<{ id: string; message: string }>(
        "/distributor/schemes",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      setFeedback(res.message);
      setTimeout(() => setFeedback(null), 3000);
      setShowAddSchemeModal(false);
      setNewSchemeCode("");
      setNewSchemeName("");
      void loadCatalogue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create trade scheme.");
    } finally {
      setSavingScheme(false);
    }
  };

  if (authLoading || profileLoading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 sm:p-8">
        <p className="text-sm text-gray-500">Authenticating administrator session...</p>
      </main>
    );
  }

  if (!profile || !ALLOWED_ROLES.has(profile.role)) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 sm:p-8">
        <div className="mx-auto max-w-md border border-gray-200 bg-white p-6 shadow-xs">
          <h1 className="text-lg font-semibold text-gray-950">Access Restricted</h1>
          <p className="mt-2 text-sm text-gray-600">
            Only Distributor Administrators can manage catalogue inventory and trade schemes.
          </p>
          <div className="mt-6">
            <Link
              href="/distributor"
              className="inline-block bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800"
            >
              Back to Console
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const activeProductsCount = products.filter((p) => p.is_active).length;
  const disabledProductsCount = products.filter((p) => !p.is_active).length;
  const activeSchemesCount = schemes.filter((s) => s.is_active).length;

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {/* Top Bar */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/distributor"
              className="text-xs font-semibold tracking-wider uppercase text-gray-500 hover:text-gray-900"
            >
              &larr; Administration Console
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-xs font-semibold uppercase text-gray-900">
              Master Catalogue & Schemes
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (brands.length > 0 && !newBrandId) setNewBrandId(brands[0].id);
                setShowAddProductModal(true);
              }}
              className="bg-gray-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-gray-800"
            >
              + Add New Product
            </button>
            <button
              onClick={() => {
                if (products.length > 0 && !newSchemeProductId) {
                  setNewSchemeProductId(products[0].id);
                }
                setShowAddSchemeModal(true);
              }}
              className="border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
            >
              + Create Trade Scheme
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
        {/* Banner Feedback */}
        {feedback && (
          <div className="border border-emerald-300 bg-emerald-50 p-3 text-xs font-medium text-emerald-900">
            {feedback}
          </div>
        )}

        {error && (
          <div className="border border-red-300 bg-red-50 p-3 text-xs font-medium text-red-900">
            {error}
          </div>
        )}

        {/* Workspace Title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-950">
            Catalogue & Trade Scheme Engine
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage SKU specifications, wholesale case prices, depot inventory reserves,
            and promotional Buy-X-Get-Y or slab schemes.
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total SKUs
            </p>
            <p className="mt-2 text-2xl font-bold font-mono text-gray-950">
              {products.length}
            </p>
          </div>

          <div className="border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Active For Retailers
            </p>
            <p className="mt-2 text-2xl font-bold font-mono text-emerald-700">
              {activeProductsCount}
            </p>
          </div>

          <div className="border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Disabled Products
            </p>
            <p className="mt-2 text-2xl font-bold font-mono text-neutral-600">
              {disabledProductsCount}
            </p>
          </div>

          <div className="border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Active Trade Schemes
            </p>
            <p className="mt-2 text-2xl font-bold font-mono text-gray-950">
              {activeSchemesCount}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab("PRODUCTS")}
              className={`py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "PRODUCTS"
                  ? "border-gray-900 text-gray-950"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              Products & Stock ({products.length})
            </button>
            <button
              onClick={() => setActiveTab("SCHEMES")}
              className={`py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "SCHEMES"
                  ? "border-gray-900 text-gray-950"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              Trade Schemes & Offers ({schemes.length})
            </button>
          </nav>
        </div>

        {/* TAB 1: PRODUCTS */}
        {activeTab === "PRODUCTS" && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 border border-gray-200">
              <input
                type="text"
                placeholder="Search by SKU, Product Name, Category..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full sm:w-80 border border-gray-300 px-3 py-1.5 text-xs text-gray-900 outline-none focus:border-gray-900"
              />

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">Status:</span>
                {(["ALL", "ACTIVE", "INACTIVE"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setProductStatus(st)}
                    className={`px-3 py-1 text-xs font-medium border ${
                      productStatus === st
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {st === "ALL" ? "All SKUs" : st === "ACTIVE" ? "Active" : "Disabled"}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Table */}
            <div className="border border-gray-200 bg-white overflow-x-auto">
              {loading && products.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">
                  Loading catalogue products...
                </div>
              ) : products.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">
                  No products found matching your search.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-gray-200 bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">SKU / Code</th>
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4">Brand / Category</th>
                      <th className="py-3 px-4">Pack Specs</th>
                      <th className="py-3 px-4 text-right">Wholesale Price</th>
                      <th className="py-3 px-4 text-right">Depot Stock</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-800">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-mono font-semibold text-gray-950">
                          {p.sku}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-gray-950">{p.name}</p>
                          {p.active_schemes_count > 0 && (
                            <span className="mt-0.5 inline-block border border-blue-200 bg-blue-50 px-1.5 py-0.2 text-[10px] font-semibold text-blue-900">
                              {p.active_schemes_count} Active Scheme
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          <span>{p.brand_name}</span> &bull; <span>{p.category}</span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {p.pack_size} {p.pack_unit} ({p.units_per_case} pcs/case)
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-gray-950">
                          {formatCurrency(p.price)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          <span
                            className={
                              p.quantity_available <= 5
                                ? "text-red-700 font-semibold"
                                : "text-gray-900"
                            }
                          >
                            {p.quantity_available} cs
                          </span>{" "}
                          <span className="text-[10px] text-gray-400">
                            ({p.quantity_on_hand} on-hand)
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              p.is_active
                                ? "border border-emerald-300 bg-emerald-50 text-emerald-900"
                                : "border border-gray-300 bg-gray-100 text-gray-600"
                            }`}
                          >
                            {p.is_active ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => openEditModal(p)}
                            className="border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleProductStatus(p.id, p.name)}
                            className={`px-2 py-1 text-[11px] font-semibold border ${
                              p.is_active
                                ? "border-red-300 text-red-800 hover:bg-red-50"
                                : "border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                            }`}
                          >
                            {p.is_active ? "Disable" : "Enable"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TRADE SCHEMES */}
        {activeTab === "SCHEMES" && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 border border-gray-200">
              <input
                type="text"
                placeholder="Search by Scheme Code or Name..."
                value={schemeSearch}
                onChange={(e) => setSchemeSearch(e.target.value)}
                className="w-full sm:w-80 border border-gray-300 px-3 py-1.5 text-xs text-gray-900 outline-none focus:border-gray-900"
              />

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">Status:</span>
                {(["ALL", "ACTIVE", "INACTIVE"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setSchemeStatus(st)}
                    className={`px-3 py-1 text-xs font-medium border ${
                      schemeStatus === st
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {st === "ALL" ? "All Schemes" : st === "ACTIVE" ? "Active" : "Disabled"}
                  </button>
                ))}
              </div>
            </div>

            {/* Schemes Table */}
            <div className="border border-gray-200 bg-white overflow-x-auto">
              {loading && schemes.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">
                  Loading trade schemes...
                </div>
              ) : schemes.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">
                  No trade schemes found. Click &quot;+ Create Trade Scheme&quot; above to add one.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-gray-200 bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Scheme Code</th>
                      <th className="py-3 px-4">Scheme Name</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Target Product & Offer Rule</th>
                      <th className="py-3 px-4">Validity Window</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-800">
                    {schemes.map((s) => {
                      const firstRule = s.rules[0];
                      return (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4 font-mono font-semibold text-gray-950">
                            {s.code}
                          </td>
                          <td className="py-3 px-4 font-semibold text-gray-950">
                            {s.name}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block border border-gray-300 bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-800">
                              {s.scheme_type === "BUY_X_GET_Y" ? "Buy X Get Y" : "Slab Discount"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            {firstRule ? (
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {firstRule.product_name} ({firstRule.product_sku})
                                </p>
                                <p className="text-[11px] text-gray-600 mt-0.5">
                                  {s.scheme_type === "BUY_X_GET_Y" ? (
                                    <span>
                                      Buy {firstRule.buy_quantity} Cases &rarr; Get{" "}
                                      <strong className="text-emerald-700">
                                        {firstRule.reward_quantity} Free Case
                                      </strong>{" "}
                                      of {firstRule.reward_product_name || firstRule.product_name}
                                    </span>
                                  ) : (
                                    <span>
                                      Min {firstRule.min_quantity} Cases &rarr;{" "}
                                      <strong className="text-emerald-700">
                                        {firstRule.discount_type === "PERCENTAGE"
                                          ? `${firstRule.discount_value}% Off`
                                          : `₹${firstRule.discount_value} Off/case`}
                                      </strong>
                                    </span>
                                  )}
                                </p>
                              </div>
                            ) : (
                              <span className="text-gray-400">No rule attached</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-gray-600">
                            {formatDate(s.valid_from)} &rarr; {formatDate(s.valid_to)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                s.is_active
                                  ? "border border-emerald-300 bg-emerald-50 text-emerald-900"
                                  : "border border-gray-300 bg-gray-100 text-gray-600"
                              }`}
                            >
                              {s.is_active ? "Active" : "Disabled"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleToggleSchemeStatus(s.id, s.name)}
                              className={`px-2.5 py-1 text-[11px] font-semibold border ${
                                s.is_active
                                  ? "border-red-300 text-red-800 hover:bg-red-50"
                                  : "border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                              }`}
                            >
                              {s.is_active ? "Disable Scheme" : "Enable Scheme"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: ADD PRODUCT */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl border border-gray-300 bg-white p-6 shadow-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h2 className="text-base font-semibold text-gray-950">Add New Master SKU</h2>
              <button
                onClick={() => setShowAddProductModal(false)}
                className="text-gray-400 hover:text-gray-700 font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700">SKU Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PRD-COKE-500ML"
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    className="mt-1 w-full border border-gray-300 px-3 py-1.5 font-mono uppercase text-gray-900 outline-none focus:border-gray-900"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700">Product Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Coca-Cola 500ml Bottle"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="mt-1 w-full border border-gray-300 px-3 py-1.5 text-gray-900 outline-none focus:border-gray-900"
                  />
                </div>
              </div>

              {/* Brand & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-gray-700">Brand *</label>
                    <button
                      type="button"
                      onClick={() => setShowAddBrand(!showAddBrand)}
                      className="text-[11px] text-gray-600 underline"
                    >
                      {showAddBrand ? "Cancel" : "+ New Brand"}
                    </button>
                  </div>
                  {showAddBrand ? (
                    <div className="mt-1 p-2 border border-gray-300 bg-gray-50 space-y-2">
                      <input
                        type="text"
                        placeholder="Brand Name (e.g. Nestle)"
                        value={newBrandName}
                        onChange={(e) => setNewBrandName(e.target.value)}
                        className="w-full border border-gray-300 px-2 py-1 bg-white text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Brand Code (e.g. NSTL)"
                        value={newBrandCode}
                        onChange={(e) => setNewBrandCode(e.target.value)}
                        className="w-full border border-gray-300 px-2 py-1 bg-white text-xs uppercase"
                      />
                      <button
                        type="button"
                        onClick={handleCreateBrand}
                        disabled={savingBrand}
                        className="bg-gray-900 text-white px-2 py-1 text-[11px] font-semibold"
                      >
                        {savingBrand ? "Saving..." : "Add Brand"}
                      </button>
                    </div>
                  ) : (
                    <select
                      value={newBrandId}
                      onChange={(e) => setNewBrandId(e.target.value)}
                      className="mt-1 w-full border border-gray-300 px-3 py-1.5 text-gray-900 outline-none focus:border-gray-900 bg-white"
                    >
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-gray-700">Category *</label>
                  <input
                    type="text"
                    required
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="mt-1 w-full border border-gray-300 px-3 py-1.5 text-gray-900 outline-none focus:border-gray-900"
                  />
                </div>
              </div>

              {/* Pack details */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-gray-700">Pack Size *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newPackSize}
                    onChange={(e) => setNewPackSize(e.target.value)}
                    className="mt-1 w-full border border-gray-300 px-3 py-1.5 text-gray-900 outline-none focus:border-gray-900"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700">Unit (e.g. ml, g, kg) *</label>
                  <input
                    type="text"
                    required
                    value={newPackUnit}
                    onChange={(e) => setNewPackUnit(e.target.value)}
                    className="mt-1 w-full border border-gray-300 px-3 py-1.5 text-gray-900 outline-none focus:border-gray-900"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700">Units / Case *</label>
                  <input
                    type="number"
                    required
                    value={newUnitsPerCase}
                    onChange={(e) => setNewUnitsPerCase(e.target.value)}
                    className="mt-1 w-full border border-gray-300 px-3 py-1.5 text-gray-900 outline-none focus:border-gray-900"
                  />
                </div>
              </div>

              {/* Pricing & Stock */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                <div>
                  <label className="block font-medium text-gray-700">
                    Wholesale Price (₹ / Case) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="mt-1 w-full border border-gray-300 px-3 py-1.5 font-mono text-gray-900 outline-none focus:border-gray-900"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700">
                    Initial Depot Stock (Cases) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newInitialStock}
                    onChange={(e) => setNewInitialStock(e.target.value)}
                    className="mt-1 w-full border border-gray-300 px-3 py-1.5 font-mono text-gray-900 outline-none focus:border-gray-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="bg-gray-900 px-5 py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {savingProduct ? "Creating SKU..." : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT PRODUCT */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md border border-gray-300 bg-white p-6 shadow-md">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h2 className="text-base font-semibold text-gray-950">
                Edit SKU: {editingProduct.sku}
              </h2>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-gray-400 hover:text-gray-700 font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditProduct} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-gray-700">Product Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full border border-gray-300 px-3 py-1.5 text-gray-900 outline-none focus:border-gray-900"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700">Category</label>
                <input
                  type="text"
                  required
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="mt-1 w-full border border-gray-300 px-3 py-1.5 text-gray-900 outline-none focus:border-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700">
                    Wholesale Price (₹ / Case)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="mt-1 w-full border border-gray-300 px-3 py-1.5 font-mono text-gray-900 outline-none focus:border-gray-900"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700">
                    Warehouse Stock (Cases)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editStock}
                    onChange={(e) => setEditStock(e.target.value)}
                    className="mt-1 w-full border border-gray-300 px-3 py-1.5 font-mono text-gray-900 outline-none focus:border-gray-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="bg-gray-900 px-5 py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {savingEdit ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD SCHEME */}
      {showAddSchemeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg border border-gray-300 bg-white p-6 shadow-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h2 className="text-base font-semibold text-gray-950">
                Create New Trade Scheme
              </h2>
              <button
                onClick={() => setShowAddSchemeModal(false)}
                className="text-gray-400 hover:text-gray-700 font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateScheme} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700">Scheme Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SCH-COKE-10PLUS1"
                    value={newSchemeCode}
                    onChange={(e) => setNewSchemeCode(e.target.value)}
                    className="mt-1 w-full border border-gray-300 px-3 py-1.5 font-mono uppercase text-gray-900 outline-none focus:border-gray-900"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700">Scheme Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Buy 10 Cases Get 1 Free"
                    value={newSchemeName}
                    onChange={(e) => setNewSchemeName(e.target.value)}
                    className="mt-1 w-full border border-gray-300 px-3 py-1.5 text-gray-900 outline-none focus:border-gray-900"
                  />
                </div>
              </div>

              {/* Scheme Type Selector */}
              <div>
                <label className="block font-medium text-gray-700">Scheme Model *</label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewSchemeType("BUY_X_GET_Y")}
                    className={`py-2 px-3 text-xs font-semibold border text-center ${
                      newSchemeType === "BUY_X_GET_Y"
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Buy X Get Y (Free Stock)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSchemeType("SLAB_DISCOUNT")}
                    className={`py-2 px-3 text-xs font-semibold border text-center ${
                      newSchemeType === "SLAB_DISCOUNT"
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Slab Discount (% or ₹ Off)
                  </button>
                </div>
              </div>

              {/* Target Product */}
              <div>
                <label className="block font-medium text-gray-700">
                  Target Product (Order SKU) *
                </label>
                <select
                  value={newSchemeProductId}
                  onChange={(e) => setNewSchemeProductId(e.target.value)}
                  className="mt-1 w-full border border-gray-300 px-3 py-1.5 text-gray-900 outline-none focus:border-gray-900 bg-white"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) &bull; {p.category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Conditional Rule Fields */}
              {newSchemeType === "BUY_X_GET_Y" ? (
                <div className="p-3 border border-gray-200 bg-gray-50 space-y-3">
                  <p className="font-semibold text-gray-900">
                    Buy X Get Y Free Calculation
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-gray-700">
                        Buy Quantity (Cases) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={newBuyQty}
                        onChange={(e) => setNewBuyQty(e.target.value)}
                        className="mt-1 w-full border border-gray-300 px-3 py-1.5 bg-white text-gray-900 outline-none focus:border-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700">
                        Free Reward Quantity (Cases) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={newRewardQty}
                        onChange={(e) => setNewRewardQty(e.target.value)}
                        className="mt-1 w-full border border-gray-300 px-3 py-1.5 bg-white text-gray-900 outline-none focus:border-gray-900"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 border border-gray-200 bg-gray-50 space-y-3">
                  <p className="font-semibold text-gray-900">
                    Slab Discount Calculation
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-medium text-gray-700">
                        Min Quantity (Cases) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={newMinQty}
                        onChange={(e) => setNewMinQty(e.target.value)}
                        className="mt-1 w-full border border-gray-300 px-3 py-1.5 bg-white text-gray-900 outline-none focus:border-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700">
                        Discount Type *
                      </label>
                      <select
                        value={newDiscountType}
                        onChange={(e) =>
                          setNewDiscountType(
                            e.target.value as "PERCENTAGE" | "FIXED_AMOUNT"
                          )
                        }
                        className="mt-1 w-full border border-gray-300 px-3 py-1.5 bg-white text-gray-900 outline-none focus:border-gray-900"
                      >
                        <option value="PERCENTAGE">Percentage (%)</option>
                        <option value="FIXED_AMOUNT">Fixed (₹ / Case)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700">
                        Discount Value *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={newDiscountValue}
                        onChange={(e) => setNewDiscountValue(e.target.value)}
                        className="mt-1 w-full border border-gray-300 px-3 py-1.5 bg-white text-gray-900 outline-none focus:border-gray-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Validity Dates */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                <div>
                  <label className="block font-medium text-gray-700">Valid From *</label>
                  <input
                    type="date"
                    required
                    value={newValidFrom}
                    onChange={(e) => setNewValidFrom(e.target.value)}
                    className="mt-1 w-full border border-gray-300 px-3 py-1.5 text-gray-900 outline-none focus:border-gray-900"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700">Valid To *</label>
                  <input
                    type="date"
                    required
                    value={newValidTo}
                    onChange={(e) => setNewValidTo(e.target.value)}
                    className="mt-1 w-full border border-gray-300 px-3 py-1.5 text-gray-900 outline-none focus:border-gray-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddSchemeModal(false)}
                  className="border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingScheme}
                  className="bg-gray-900 px-5 py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {savingScheme ? "Creating Scheme..." : "Save Scheme"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
