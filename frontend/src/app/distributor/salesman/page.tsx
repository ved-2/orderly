"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  Store,
  TrendingUp,
  MapPin,
  ExternalLink,
  Plus,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Search,
  Building2,
  Phone,
  Mail,
  UserCheck,
  ShieldCheck,
  ChevronRight,
  X,
} from "lucide-react";

import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface AssignedRetailer {
  id: string;
  shop_name: string;
  retailer_code: string;
  owner_name: string;
  phone: string;
  city: string;
}

interface AvailableRetailer {
  id: string;
  shop_name: string;
  retailer_code: string;
  owner_name: string;
  phone: string;
  city: string;
  registration_status: string;
}

interface SalesmanItem {
  id: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  assigned_retailers_count: number;
  assigned_retailers: AssignedRetailer[];
  total_orders: number;
  total_sales: number;
  last_order_at: string | null;
}

interface SalesmenResponse {
  items: SalesmanItem[];
  total: number;
  available_retailers: AvailableRetailer[];
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(val);
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function DistributorSalesmanPage() {
  const [salesmen, setSalesmen] = useState<SalesmanItem[]>([]);
  const [availableRetailers, setAvailableRetailers] = useState<AvailableRetailer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Assignment Modal
  const [activeSalesman, setActiveSalesman] = useState<SalesmanItem | null>(null);
  const [assignSearch, setAssignSearch] = useState("");
  const [submittingAssign, setSubmittingAssign] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await apiRequest<SalesmenResponse>("/distributor/salesmen");
      setSalesmen(res.items || []);
      setAvailableRetailers(res.available_retailers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load salesmen.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Field Salesmen & Beat Assignments | Orderly";
    loadData();
  }, [loadData]);

  const handleAssignRetailer = async (salesmanId: string, retailerId: string) => {
    try {
      setSubmittingAssign(true);
      setError(null);
      await apiRequest("/distributor/salesmen/assign", {
        method: "POST",
        body: JSON.stringify({
          salesman_id: salesmanId,
          retailer_id: retailerId,
        }),
      });

      setFeedback("Kirana assigned to salesman beat successfully!");
      setTimeout(() => setFeedback(null), 3000);
      await loadData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign retailer.");
    } finally {
      setSubmittingAssign(false);
    }
  };

  const handleUnassignRetailer = async (salesmanId: string, retailerId: string) => {
    try {
      setError(null);
      await apiRequest("/distributor/salesmen/unassign", {
        method: "POST",
        body: JSON.stringify({
          salesman_id: salesmanId,
          retailer_id: retailerId,
        }),
      });

      setFeedback("Kirana unassigned successfully!");
      setTimeout(() => setFeedback(null), 3000);
      await loadData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unassign retailer.");
    }
  };

  const totalAssignedStores = salesmen.reduce(
    (acc, s) => acc + s.assigned_retailers_count,
    0
  );
  const totalSalesmenGMV = salesmen.reduce(
    (acc, s) => acc + s.total_sales,
    0
  );
  const totalSalesmenOrders = salesmen.reduce(
    (acc, s) => acc + s.total_orders,
    0
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E7E6E0] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#969892]">
            <Users size={14} className="text-[#79565D]" />
            <span>Field Beat Operations</span>
            <span>·</span>
            <span>Jabalpur FMCG Field Team</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#242724]">
            Field Salesmen & Beat Management
          </h1>
          <p className="mt-0.5 text-xs text-[#666864]">
            Track salesmen order productivity, manage assigned kirana beats, and simulate field visits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#E7E6E0] bg-white px-3 py-2 text-xs font-semibold text-[#242724] hover:bg-[#FAF9F6] transition-colors"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <Link
            href="/distributor/staff"
            className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#79565D] px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-[#67474E] transition-colors"
          >
            <Plus size={13} />
            <span>Invite Salesman</span>
          </Link>

          <Link
            href="/salesman"
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#79565D] bg-[#F4EFF0] px-3.5 py-2 text-xs font-semibold text-[#79565D] hover:bg-[#eedfe2] transition-colors"
          >
            <ExternalLink size={13} />
            <span>Open Salesman App</span>
          </Link>
        </div>
      </div>

      {feedback && (
        <div className="rounded-[6px] border border-[#BCE2CD] bg-[#F0F9F4] p-3 text-xs text-[#205234] flex items-center gap-2">
          <CheckCircle2 size={15} />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div className="rounded-[6px] border border-[#EDBCBC] bg-[#FBF0F0] p-4 text-xs text-[#8C2828] flex items-center justify-between">
          <p>{error}</p>
          <button
            onClick={() => loadData()}
            className="font-bold underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between text-[#666864]">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Active Salesmen
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#F4EFF0] text-[#79565D]">
              <Users size={15} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#242724]">
            {loading ? "..." : salesmen.length}
          </p>
          <p className="mt-1 text-[11px] text-[#969892]">
            Field beat operators with order access
          </p>
        </div>

        <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between text-[#666864]">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Assigned Kiranas
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#EEF6F1] text-[#205234]">
              <Store size={15} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#205234]">
            {loading ? "..." : totalAssignedStores}
          </p>
          <p className="mt-1 text-[11px] text-[#969892]">
            Mapped retail store accounts
          </p>
        </div>

        <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between text-[#666864]">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Field Beat Orders
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#EEF6F1] text-[#205234]">
              <TrendingUp size={15} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#242724]">
            {loading ? "..." : totalSalesmenOrders}
          </p>
          <p className="mt-1 text-[11px] text-[#969892]">
            Booked during merchant visits
          </p>
        </div>

        <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between text-[#666864]">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Salesmen GMV
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#FAF9F6] text-[#242724]">
              <Building2 size={15} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#242724]">
            {loading ? "..." : formatCurrency(totalSalesmenGMV)}
          </p>
          <p className="mt-1 text-[11px] text-[#969892]">
            Total field sales revenue
          </p>
        </div>
      </div>

      {/* Salesmen List */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-[#242724]">
          Field Sales Team Roster ({salesmen.length})
        </h2>

        {salesmen.length === 0 ? (
          <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-8 text-center">
            <Users size={32} className="mx-auto text-[#969892]" />
            <p className="mt-2 text-sm font-bold text-[#242724]">No Salesmen Yet</p>
            <p className="mt-1 text-xs text-[#666864]">
              Generate a single-use token to invite your first field salesman.
            </p>
            <Link
              href="/distributor/staff"
              className="mt-4 inline-block rounded-[4px] bg-[#79565D] px-4 py-2 text-xs font-semibold text-white"
            >
              Issue Salesman Invitation
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {salesmen.map((salesman) => (
              <div
                key={salesman.id}
                className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#F0EFEA] pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4EFF0] text-[#79565D] font-bold text-sm">
                      {salesman.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#242724]">
                          {salesman.email}
                        </span>
                        <Badge variant={salesman.is_active ? "success" : "danger"}>
                          {salesman.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-[#666864] mt-0.5">
                        {salesman.phone && (
                          <span className="flex items-center gap-1">
                            <Phone size={11} />
                            <span>{salesman.phone}</span>
                          </span>
                        )}
                        <span>Joined: {formatDate(salesman.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveSalesman(salesman)}
                      className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#79565D] px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-[#67474E] transition-colors"
                    >
                      <Plus size={13} />
                      <span>Manage Beat Stores</span>
                    </button>

                    <Link
                      href="/salesman"
                      className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#E7E6E0] bg-white px-3 py-1.5 text-xs font-semibold text-[#242724] hover:bg-[#FAF9F6]"
                    >
                      <span>Field App</span>
                      <ExternalLink size={12} />
                    </Link>
                  </div>
                </div>

                {/* Salesman Stats */}
                <div className="grid grid-cols-3 gap-3 text-center sm:text-left bg-[#FAF9F6] p-3 rounded-[4px] border border-[#E7E6E0] text-xs">
                  <div>
                    <span className="text-[10px] text-[#969892] uppercase font-bold">
                      Assigned Beat
                    </span>
                    <p className="font-bold text-[#242724] text-sm mt-0.5">
                      {salesman.assigned_retailers_count} Stores
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#969892] uppercase font-bold">
                      Orders Booked
                    </span>
                    <p className="font-bold text-[#242724] text-sm mt-0.5">
                      {salesman.total_orders} Orders
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#969892] uppercase font-bold">
                      Revenue Generated
                    </span>
                    <p className="font-bold text-[#205234] text-sm mt-0.5">
                      {formatCurrency(salesman.total_sales)}
                    </p>
                  </div>
                </div>

                {/* Assigned Retailers Chips */}
                {salesman.assigned_retailers.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#969892] mb-2">
                      Assigned Kirana Stores ({salesman.assigned_retailers.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {salesman.assigned_retailers.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center gap-2 rounded-[4px] border border-[#E7E6E0] bg-white px-2.5 py-1 text-xs text-[#242724]"
                        >
                          <Store size={12} className="text-[#79565D]" />
                          <span className="font-semibold">{r.shop_name}</span>
                          <span className="text-[10px] text-[#969892]">({r.city})</span>
                          <button
                            onClick={() => handleUnassignRetailer(salesman.id, r.id)}
                            title="Unassign"
                            className="text-[#969892] hover:text-[#8C2828] transition-colors ml-1"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Store Assignment Modal */}
      {activeSalesman && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setActiveSalesman(null)}
          />
          <div className="relative w-full max-w-xl rounded-[6px] border border-[#E7E6E0] bg-white p-6 shadow-xl z-10 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#E7E6E0] pb-3">
              <div>
                <h3 className="font-bold text-base text-[#242724]">
                  Assign Stores to Beat: {activeSalesman.email}
                </h3>
                <p className="text-xs text-[#666864]">
                  Select kirana stores to include in this salesman's field territory.
                </p>
              </div>
              <button
                onClick={() => setActiveSalesman(null)}
                className="p-1 text-[#666864] hover:text-[#242724]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Kirana */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#969892]"
              />
              <input
                type="text"
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
                placeholder="Search by store name, owner, city or code..."
                className="w-full h-9 rounded-[4px] border border-[#E7E6E0] pl-9 pr-3 text-xs text-[#242724] focus:border-[#79565D] focus:outline-none"
              />
            </div>

            {/* List of Available Kiranas */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#F0EFEA] border border-[#E7E6E0] rounded-[4px]">
              {availableRetailers
                .filter((r) => {
                  if (!assignSearch.trim()) return true;
                  const q = assignSearch.toLowerCase();
                  return (
                    r.shop_name.toLowerCase().includes(q) ||
                    r.retailer_code.toLowerCase().includes(q) ||
                    r.city.toLowerCase().includes(q) ||
                    r.owner_name.toLowerCase().includes(q)
                  );
                })
                .map((r) => {
                  const isAssigned = activeSalesman.assigned_retailers.some(
                    (ar) => ar.id === r.id
                  );

                  return (
                    <div
                      key={r.id}
                      className="p-3 flex items-center justify-between hover:bg-[#FAF9F6] text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#242724]">
                            {r.shop_name}
                          </span>
                          <span className="font-mono text-[10px] text-[#666864]">
                            {r.retailer_code}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#666864]">
                          {r.owner_name} · {r.city} · {r.phone}
                        </p>
                      </div>

                      <div>
                        {isAssigned ? (
                          <button
                            onClick={() =>
                              handleUnassignRetailer(activeSalesman.id, r.id)
                            }
                            className="rounded-[4px] border border-[#EDBCBC] bg-[#FBF0F0] px-2.5 py-1 text-[11px] font-semibold text-[#8C2828] hover:bg-[#f5e1e1]"
                          >
                            Unassign
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              handleAssignRetailer(activeSalesman.id, r.id)
                            }
                            disabled={submittingAssign}
                            className="rounded-[4px] bg-[#79565D] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#67474E]"
                          >
                            Assign to Beat
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="pt-2 border-t border-[#E7E6E0] flex justify-end">
              <button
                onClick={() => setActiveSalesman(null)}
                className="rounded-[4px] bg-[#242724] px-4 py-2 text-xs font-semibold text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
