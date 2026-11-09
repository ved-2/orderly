"use client";

import { useEffect, useState, useCallback } from "react";
import {
  UserX,
  AlertTriangle,
  Clock,
  Phone,
  MessageCircle,
  RefreshCw,
  Search,
  Filter,
  Download,
  Store,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  CreditCard,
} from "lucide-react";

import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface DormantRetailer {
  retailer_id: string;
  retailer_code: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  city: string;
  address: string;
  days_inactive: number;
  last_order_date: string | null;
  last_order_id: string | null;
  last_order_number: string | null;
  last_order_amount: number | null;
  credit_limit: number;
  current_outstanding: number;
  whatsapp_url: string;
}

interface DormantSummary {
  total_active_retailers: number;
  total_dormant_retailers: number;
  dormancy_rate_percentage: number;
  threshold_days: number;
  total_outstanding_at_risk: number;
}

interface DormantResponse {
  summary: DormantSummary;
  items: DormantRetailer[];
  total: number;
  limit: number;
  offset: number;
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

function formatDate(isoString: string | null): string {
  if (!isoString) return "Never Ordered";
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

export default function DormantRetailersPage() {
  const [data, setData] = useState<DormantResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [daysThreshold, setDaysThreshold] = useState<number>(14);
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("");

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append("days", daysThreshold.toString());
      if (cityFilter) params.append("city", cityFilter);

      const res = await apiRequest<DormantResponse>(
        `/distributor/retailers/dormant?${params.toString()}`
      );
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dormant retailers.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [daysThreshold, cityFilter]);

  useEffect(() => {
    document.title = "14-Day Inactive Kirana Stores | Orderly";
    loadData();
  }, [loadData]);

  const filteredRetailers = (data?.items || []).filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.shop_name.toLowerCase().includes(q) ||
      r.owner_name.toLowerCase().includes(q) ||
      r.phone.toLowerCase().includes(q) ||
      r.city.toLowerCase().includes(q) ||
      r.retailer_code.toLowerCase().includes(q)
    );
  });

  const availableCities = Array.from(
    new Set((data?.items || []).map((r) => r.city).filter(Boolean))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E4E3DD] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#8E281F] text-white">
              <UserX size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#1A1A18]">
                Dormant Retailers ({daysThreshold}+ Days Inactive)
              </h1>
              <p className="text-xs text-[#6B6D66]">
                Kirana accounts with zero orders in the selected period. Re-engage to recover sales churn.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Threshold Switcher */}
          <div className="flex items-center rounded-lg border border-[#D5D4CE] bg-white p-0.5 shadow-2xs">
            {[7, 14, 30, 60].map((d) => (
              <button
                key={d}
                onClick={() => setDaysThreshold(d)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  daysThreshold === d
                    ? "bg-[#1A1A18] text-white"
                    : "text-[#5A5C56] hover:bg-[#F2F1EC]"
                }`}
              >
                {d}d+
              </button>
            ))}
          </div>

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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#E4E3DD] bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#8E281F]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7C75]">
              Dormant Stores
            </p>
            <AlertTriangle size={15} />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-[#8E281F]">
            {data?.summary.total_dormant_retailers ?? 0}
          </p>
          <p className="mt-0.5 text-[11px] text-[#6B6D66]">
            Out of {data?.summary.total_active_retailers ?? 0} active retailers
          </p>
        </div>

        <div className="rounded-xl border border-[#E4E3DD] bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#8A5018]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7C75]">
              Dormancy Rate
            </p>
            <Clock size={15} />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-[#8A5018]">
            {data?.summary.dormancy_rate_percentage ?? 0}%
          </p>
          <p className="mt-0.5 text-[11px] text-[#6B6D66]">
            Inactive $\ge$ {daysThreshold} days
          </p>
        </div>

        <div className="rounded-xl border border-[#E4E3DD] bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#B24A10]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7C75]">
              Credit at Risk
            </p>
            <ShieldAlert size={15} />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-[#1A1A18]">
            {formatCurrency(data?.summary.total_outstanding_at_risk ?? 0)}
          </p>
          <p className="mt-0.5 text-[11px] text-[#6B6D66]">
            Unsettled balance of dormant shops
          </p>
        </div>

        <div className="rounded-xl border border-[#E4E3DD] bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#285A3C]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7C75]">
              Recovery Action
            </p>
            <MessageCircle size={15} />
          </div>
          <p className="mt-1.5 text-xs font-medium text-[#1A1A18] leading-tight">
            1-Click WhatsApp Follow-ups
          </p>
          <p className="mt-1 text-[11px] text-[#285A3C] font-semibold">
            Auto-populated Hindi greetings & schemes
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#E4E3DD] bg-white p-3 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#1A1A18]">
            Showing {filteredRetailers.length} Inactive Retailers
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* City Filter */}
          {availableCities.length > 0 && (
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="rounded-lg border border-[#D5D4CE] bg-[#FAF9F5] px-2.5 py-1.5 text-xs font-medium text-[#1A1A18] outline-none"
            >
              <option value="">All Cities / Beats</option>
              {availableCities.map((c) => (
                <option key={c} value={c}>
                  City: {c}
                </option>
              ))}
            </select>
          )}

          {/* Search */}
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A8C84]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Kirana / Owner / Phone..."
              className="w-56 rounded-lg border border-[#D5D4CE] bg-[#FAF9F5] pl-8 pr-3 py-1.5 text-xs text-[#1A1A18] placeholder-[#9A9C94] outline-none focus:border-[#1A1A18]"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-[#E4E3DD] bg-white">
          <div className="flex items-center gap-2 text-xs text-[#6B6D66]">
            <RefreshCw size={16} className="animate-spin" />
            Analyzing order history and dormancy rates...
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E4E3DD] bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E4E3DD] bg-[#F4F3EE] text-[11px] font-semibold uppercase tracking-wider text-[#6B6D66]">
                <tr>
                  <th className="px-4 py-2.5">Shop & Owner</th>
                  <th className="px-3 py-2.5">City & Contact</th>
                  <th className="px-3 py-2.5 text-center bg-[#FBEBEA] text-[#8E281F]">
                    Days Inactive
                  </th>
                  <th className="px-3 py-2.5">Last Order</th>
                  <th className="px-3 py-2.5 text-right">Outstanding / Limit</th>
                  <th className="px-4 py-2.5 text-right">Re-engage Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEFE9]">
                {filteredRetailers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-xs text-[#8A8C84]">
                      Great news! No retailers are dormant beyond {daysThreshold} days for this filter.
                    </td>
                  </tr>
                ) : (
                  filteredRetailers.map((r) => (
                    <tr key={r.retailer_id} className="hover:bg-[#FAF9F6] transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#1A1A18]">
                          {r.shop_name}
                        </div>
                        <div className="text-[11px] text-[#6B6D66]">
                          {r.owner_name} · <span className="font-mono text-[#7A7C75]">{r.retailer_code}</span>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="font-medium text-[#1A1A18]">{r.city}</div>
                        <a
                          href={`tel:${r.phone}`}
                          className="text-[11px] font-mono text-[#2B5490] hover:underline"
                        >
                          {r.phone}
                        </a>
                      </td>

                      <td className="px-3 py-3 text-center bg-[#FDF5F5]">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F6D8D5] px-2.5 py-0.5 text-xs font-bold text-[#8E281F]">
                          <Clock size={12} />
                          {r.days_inactive} days
                        </span>
                      </td>

                      <td className="px-3 py-3">
                        <div className="text-[#1A1A18] font-medium">
                          {formatDate(r.last_order_date)}
                        </div>
                        {r.last_order_amount !== null && (
                          <div className="text-[11px] text-[#6B6D66]">
                            {r.last_order_number} ({formatCurrency(r.last_order_amount)})
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3 text-right">
                        <div className="font-bold text-[#1A1A18]">
                          {formatCurrency(r.current_outstanding)}
                        </div>
                        <div className="text-[11px] text-[#7A7C75]">
                          Limit: {formatCurrency(r.credit_limit)}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={r.whatsapp_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-[#25D366] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1EBE5D] transition shadow-2xs"
                            title="Send WhatsApp Follow-up with pre-filled order reminder"
                          >
                            <MessageCircle size={13} />
                            WhatsApp
                          </a>
                          <a
                            href={`tel:${r.phone}`}
                            className="inline-flex items-center gap-1 rounded-md border border-[#D5D4CE] bg-white px-2 py-1.5 text-xs font-semibold text-[#1A1A18] hover:bg-[#F2F1EC] transition shadow-2xs"
                            title="Call Kirana Owner"
                          >
                            <Phone size={13} />
                          </a>
                        </div>
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
