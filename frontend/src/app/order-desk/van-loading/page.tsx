"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Truck,
  Boxes,
  Store,
  Download,
  Printer,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
  MapPin,
  FileSpreadsheet,
} from "lucide-react";

import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface LoadingItem {
  product_id: string;
  sku: string;
  product_name: string;
  brand_name: string;
  category: string;
  pack_size: string;
  units_per_case: number;
  total_cases_billed: number;
  total_cases_free: number;
  total_cases: number;
  total_pieces_billed: number;
  total_pieces_free: number;
  total_pieces: number;
  equivalent_cases: number;
  retailers_count: number;
}

interface RouteDrop {
  order_id: string;
  order_number: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  city: string;
  address: string;
  status: string;
  total_amount: number;
  approved_at: string | null;
  created_at: string | null;
}

interface VanLoadingResponse {
  summary: {
    total_orders: number;
    total_retailers: number;
    total_cases: number;
    total_pieces: number;
    total_amount: number;
    cities_covered: string[];
    generated_at: string;
  };
  items: LoadingItem[];
  retailers: RouteDrop[];
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

export default function VanLoadingSheetPage() {
  const [data, setData] = useState<VanLoadingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("APPROVED");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"picklist" | "drops">("picklist");
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (cityFilter) params.append("city", cityFilter);

      const res = await apiRequest<VanLoadingResponse>(
        `/orders/desk/van-loading-sheet?${params.toString()}`
      );
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load van loading sheet.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, cityFilter]);

  useEffect(() => {
    document.title = "Van Loading Sheet & Picklist | Orderly";
    loadData();
  }, [loadData]);

  const handleDownloadCsv = () => {
    const params = new URLSearchParams();
    if (statusFilter) params.append("status", statusFilter);
    if (cityFilter) params.append("city", cityFilter);
    params.append("format", "csv");
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
    window.open(`${baseUrl}/orders/desk/van-loading-sheet?${params.toString()}`, "_blank");
  };

  const filteredItems = (data?.items || []).filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.product_name.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      item.brand_name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  const filteredDrops = (data?.retailers || []).filter((drop) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      drop.shop_name.toLowerCase().includes(q) ||
      drop.owner_name.toLowerCase().includes(q) ||
      drop.order_number.toLowerCase().includes(q) ||
      drop.city.toLowerCase().includes(q) ||
      drop.address.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E4E3DD] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1A1A18] text-white">
              <Truck size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#1A1A18]">
                Van Loading Sheet & Picklist
              </h1>
              <p className="text-xs text-[#6B6D66]">
                Consolidated warehouse packing lists and route dispatch plan
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#D5D4CE] bg-white px-3 py-2 text-xs font-semibold text-[#1A1A18] hover:bg-[#F7F6F2] transition shadow-xs"
          >
            <Printer size={14} />
            Print Picklist
          </button>
          <button
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#D5D4CE] bg-white px-3 py-2 text-xs font-semibold text-[#1A1A18] hover:bg-[#F7F6F2] transition shadow-xs"
          >
            <Download size={14} />
            Download CSV
          </button>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1A1A18] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#2C2C28] transition shadow-xs disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-[#E4E3DD] bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7C75]">
            Approved Orders
          </p>
          <p className="mt-1.5 text-2xl font-bold text-[#1A1A18]">
            {data?.summary.total_orders ?? 0}
          </p>
          <p className="mt-0.5 text-[11px] text-[#6B6D66]">
            Across {data?.summary.total_retailers ?? 0} Kiranas
          </p>
        </div>

        <div className="rounded-xl border border-[#E4E3DD] bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7C75]">
            Total Cases
          </p>
          <p className="mt-1.5 text-2xl font-bold text-[#1A1A18] text-[#285A3C]">
            {data?.summary.total_cases ?? 0}
          </p>
          <p className="mt-0.5 text-[11px] text-[#6B6D66]">
            Whole cartons to load
          </p>
        </div>

        <div className="rounded-xl border border-[#E4E3DD] bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7C75]">
            Loose Pieces
          </p>
          <p className="mt-1.5 text-2xl font-bold text-[#8A5018]">
            {data?.summary.total_pieces ?? 0}
          </p>
          <p className="mt-0.5 text-[11px] text-[#6B6D66]">
            Pieces for crate box
          </p>
        </div>

        <div className="rounded-xl border border-[#E4E3DD] bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7C75]">
            Total Load Value
          </p>
          <p className="mt-1.5 text-2xl font-bold text-[#1A1A18]">
            {formatCurrency(data?.summary.total_amount ?? 0)}
          </p>
          <p className="mt-0.5 text-[11px] text-[#6B6D66]">
            Invoice dispatch value
          </p>
        </div>

        <div className="rounded-xl border border-[#E4E3DD] bg-white p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7C75]">
            Cities / Routes
          </p>
          <p className="mt-1.5 text-2xl font-bold text-[#1A1A18]">
            {data?.summary.cities_covered.length ?? 0}
          </p>
          <p className="mt-0.5 text-[11px] text-[#6B6D66] truncate">
            {data?.summary.cities_covered.join(", ") || "All regions"}
          </p>
        </div>
      </div>

      {/* Filter and Tab Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#E4E3DD] bg-white p-3 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("picklist")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "picklist"
                ? "bg-[#1A1A18] text-white"
                : "text-[#5A5C56] hover:bg-[#F2F1EC]"
            }`}
          >
            <Boxes size={14} />
            Consolidated SKU Picklist ({filteredItems.length})
          </button>
          <button
            onClick={() => setActiveTab("drops")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "drops"
                ? "bg-[#1A1A18] text-white"
                : "text-[#5A5C56] hover:bg-[#F2F1EC]"
            }`}
          >
            <Store size={14} />
            Retailer Route Drops ({filteredDrops.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-[#D5D4CE] bg-[#FAF9F5] px-2.5 py-1.5 text-xs font-medium text-[#1A1A18] outline-none"
          >
            <option value="APPROVED">Status: Confirmed / Approved</option>
            <option value="ALL">Status: All Queued (Submitted + Approved)</option>
          </select>

          {/* City Filter */}
          {data?.summary.cities_covered && data.summary.cities_covered.length > 0 && (
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="rounded-lg border border-[#D5D4CE] bg-[#FAF9F5] px-2.5 py-1.5 text-xs font-medium text-[#1A1A18] outline-none"
            >
              <option value="">All Cities / Routes</option>
              {data.summary.cities_covered.map((c) => (
                <option key={c} value={c}>
                  Route: {c}
                </option>
              ))}
            </select>
          )}

          {/* Search Input */}
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A8C84]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search SKU or Store..."
              className="w-48 rounded-lg border border-[#D5D4CE] bg-[#FAF9F5] pl-8 pr-3 py-1.5 text-xs text-[#1A1A18] placeholder-[#9A9C94] outline-none focus:border-[#1A1A18]"
            />
          </div>
        </div>
      </div>

      {/* Content View */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-[#E4E3DD] bg-white">
          <div className="flex items-center gap-2 text-xs text-[#6B6D66]">
            <RefreshCw size={16} className="animate-spin" />
            Calculating van picklist from approved orders...
          </div>
        </div>
      ) : activeTab === "picklist" ? (
        /* Picklist Table */
        <div className="overflow-hidden rounded-xl border border-[#E4E3DD] bg-white shadow-2xs">
          <div className="border-b border-[#E4E3DD] bg-[#FAF9F5] px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1A1A18]">
              Warehouse Consolidated Items Picklist
            </span>
            <span className="text-[11px] text-[#6B6D66]">
              Pack high-volume cases first, then loose items in tote crates
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E4E3DD] bg-[#F4F3EE] text-[11px] font-semibold uppercase tracking-wider text-[#6B6D66]">
                <tr>
                  <th className="px-4 py-2.5">SKU & Product</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5 text-center">Pack / Units</th>
                  <th className="px-3 py-2.5 text-right bg-[#EAF2EC] text-[#245233]">
                    Cases (Billed)
                  </th>
                  <th className="px-3 py-2.5 text-right bg-[#EAF2EC] text-[#245233]">
                    Cases (Free)
                  </th>
                  <th className="px-3 py-2.5 text-right font-bold bg-[#DCEBDD] text-[#1E452B]">
                    Total Cases
                  </th>
                  <th className="px-3 py-2.5 text-right bg-[#F8F1E7] text-[#7A4513]">
                    Loose Pcs
                  </th>
                  <th className="px-3 py-2.5 text-center">Stores</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEFE9]">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-xs text-[#8A8C84]">
                      No items to load for the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.product_id} className="hover:bg-[#FAF9F6] transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#1A1A18]">
                          {item.product_name}
                        </div>
                        <div className="text-[11px] text-[#7A7C75]">
                          {item.brand_name} · <span className="font-mono">{item.sku}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[#5A5C56]">
                        {item.category}
                      </td>
                      <td className="px-3 py-3 text-center text-[#5A5C56]">
                        {item.pack_size} ({item.units_per_case} pcs/cs)
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-[#285A3C]">
                        {item.total_cases_billed}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-[#285A3C]">
                        {item.total_cases_free > 0 ? (
                          <span className="rounded bg-[#D7EAD9] px-1.5 py-0.5 text-[11px] font-bold text-[#1E452B]">
                            +{item.total_cases_free}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-sm text-[#1E452B] bg-[#F4F9F5]">
                        {item.total_cases}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-[#8A5018]">
                        {item.total_pieces > 0 ? (
                          <span>
                            {item.total_pieces} pcs
                            {item.total_pieces_free > 0 && (
                              <span className="text-[10px] text-[#285A3C] block">
                                (+{item.total_pieces_free} free)
                              </span>
                            )}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="rounded-full bg-[#EFEFE9] px-2 py-0.5 text-[11px] font-medium text-[#4A4C46]">
                          {item.retailers_count}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Route Drops Table */
        <div className="overflow-hidden rounded-xl border border-[#E4E3DD] bg-white shadow-2xs">
          <div className="border-b border-[#E4E3DD] bg-[#FAF9F5] px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1A1A18]">
              Delivery Sequence & Shop Stops
            </span>
            <span className="text-[11px] text-[#6B6D66]">
              Order numbers and contact details for the delivery driver
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E4E3DD] bg-[#F4F3EE] text-[11px] font-semibold uppercase tracking-wider text-[#6B6D66]">
                <tr>
                  <th className="px-4 py-2.5">Stop # / Order</th>
                  <th className="px-3 py-2.5">Shop & Owner</th>
                  <th className="px-3 py-2.5">Contact Phone</th>
                  <th className="px-3 py-2.5">City & Delivery Address</th>
                  <th className="px-3 py-2.5 text-right">Invoice Total</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEFE9]">
                {filteredDrops.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-xs text-[#8A8C84]">
                      No retail deliveries found for selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredDrops.map((drop, idx) => (
                    <tr key={drop.order_id} className="hover:bg-[#FAF9F6] transition">
                      <td className="px-4 py-3">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1A1A18] text-[10px] font-bold text-white mr-2">
                          {idx + 1}
                        </span>
                        <span className="font-mono font-medium text-[#1A1A18]">
                          {drop.order_number}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-[#1A1A18]">
                          {drop.shop_name}
                        </div>
                        <div className="text-[11px] text-[#6B6D66]">
                          {drop.owner_name}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <a
                          href={`tel:${drop.phone}`}
                          className="text-[#2B5490] hover:underline font-mono"
                        >
                          {drop.phone}
                        </a>
                      </td>
                      <td className="px-3 py-3 max-w-xs text-[#4A4C46]">
                        <span className="font-semibold text-[#1A1A18]">{drop.city}</span>: {drop.address}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-[#1A1A18]">
                        {formatCurrency(drop.total_amount)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Badge variant="success">
                          {drop.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
