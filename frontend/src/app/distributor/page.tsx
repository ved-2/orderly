"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Store,
  Inbox,
  Package,
  FileSpreadsheet,
  Users,
  Building2,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Boxes,
  Truck,
  UserX,
  ExternalLink,
  DollarSign,
  ShoppingCart,
  RefreshCw,
} from "lucide-react";

import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface OverviewMetrics {
  totalRetailers: number;
  totalSalesmen: number;
  totalOrders: number;
  totalRevenue: number;
  confirmedRevenue: number;
}

const adminModules = [
  {
    title: "B2B Sales & Revenue Intelligence",
    description:
      "Monitor real-time wholesale GMV, breakdown by sales channel (Salesman Beat vs Web vs AI), and top kirana store spenders.",
    href: "/distributor/sales",
    badge: "Live Analytics",
    icon: TrendingUp,
    accent: "text-[#205234]",
    accentBg: "bg-[#EEF6F1]",
  },
  {
    title: "Field Salesmen & Beat Operations",
    description:
      "Inspect salesmen order productivity, manage assigned kirana store beat territories, and simulate beat visits.",
    href: "/distributor/salesman",
    badge: "Field Team",
    icon: Users,
    accent: "text-[#79565D]",
    accentBg: "bg-[#F4EFF0]",
  },
  {
    title: "Kirana Network & Credit Limits",
    description:
      "Verify incoming kirana shop registrations, set credit limits, review outstanding ledgers, and log payment collections.",
    href: "/distributor/retailers",
    badge: "Retailer Roster",
    icon: Store,
    accent: "text-[#79565D]",
    accentBg: "bg-[#F4EFF0]",
  },
  {
    title: "Master Catalogue & Trade Schemes",
    description:
      "Manage SKU specifications, wholesale case rates, warehouse depot stock, and promotional Buy-X-Get-Y / slab schemes across FMCG brands.",
    href: "/distributor/catalogue",
    badge: "Catalogue Engine",
    icon: Package,
    accent: "text-[#79565D]",
    accentBg: "bg-[#F4EFF0]",
  },
  {
    title: "Order Desk Super-View",
    description:
      "Direct oversight of the Order Desk processing queue, order approvals, inventory reservations, and delivery scheduling.",
    href: "/order-desk",
    badge: "Live Queue",
    icon: Inbox,
    accent: "text-[#205234]",
    accentBg: "bg-[#EEF6F1]",
  },
  {
    title: "Van Loading Sheet & Picklist",
    description:
      "Aggregate approved dispatches into delivery-route picklists and van packing manifests with 1-click CSV download.",
    href: "/order-desk/van-loading",
    badge: "Dispatches",
    icon: Truck,
    accent: "text-[#1E4B72]",
    accentBg: "bg-[#EFF5FB]",
  },
  {
    title: "14-Day Dormant Retailers",
    description:
      "Identify at-risk inactive kiranas with zero orders over 14 days and initiate direct WhatsApp re-engagement outreach.",
    href: "/order-desk/dormant-retailers",
    badge: "Retention",
    icon: UserX,
    accent: "text-[#8C2828]",
    accentBg: "bg-[#FBF0F0]",
  },
  {
    title: "Staff & Operator Invitations",
    description:
      "Issue single-use invitations for Order Desk operators and beat salesmen with role-based access tokens.",
    href: "/distributor/staff",
    badge: "Access Control",
    icon: ShieldCheck,
    accent: "text-[#7A4E12]",
    accentBg: "bg-[#FCF6EC]",
  },
  {
    title: "Tally Voucher Export",
    description:
      "Generate and download Tally-compatible sales voucher XML/CSV files for approved and dispatched orders.",
    href: "/distributor/tally-export",
    badge: "Accounting Sync",
    icon: FileSpreadsheet,
    accent: "text-[#1E4B72]",
    accentBg: "bg-[#EFF5FB]",
  },
];

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

export default function DistributorDashboardPage() {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLiveCounts = useCallback(async () => {
    try {
      setLoading(true);
      const [salesMetrics, retailersRes, salesmenRes] = await Promise.all([
        apiRequest<{
          total_revenue: number;
          confirmed_revenue: number;
          total_orders: number;
        }>("/distributor/sales/metrics"),
        apiRequest<{ total: number }>("/distributor/retailers?limit=1"),
        apiRequest<{ total: number }>("/distributor/salesmen"),
      ]);

      setMetrics({
        totalRetailers: retailersRes.total || 0,
        totalSalesmen: salesmenRes.total || 0,
        totalOrders: salesMetrics.total_orders || 0,
        totalRevenue: salesMetrics.total_revenue || 0,
        confirmedRevenue: salesMetrics.confirmed_revenue || 0,
      });
    } catch (err) {
      console.error("Failed to load distributor overview metrics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Distributor Executive Console | Orderly";
    fetchLiveCounts();
  }, [fetchLiveCounts]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E7E6E0] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-[#969892]">
              Executive Control Center
            </span>
            <span className="text-[#E7E6E0]">·</span>
            <span className="text-xs text-[#205234] font-semibold">
              {loading
                ? "Connecting..."
                : `${metrics?.totalRetailers || 0} Registered Kirana Stores · ${metrics?.totalSalesmen || 0} Active Salesmen`}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#242724]">
            Distributor Management Console
          </h1>
          <p className="mt-0.5 text-xs text-[#666864]">
            Live operational suite for wholesale trade schemes, field salesman beats, kirana credit, and dispatches.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/distributor/sales"
            className="inline-flex items-center gap-2 rounded-[4px] bg-[#205234] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#183f28] transition-colors"
          >
            <TrendingUp size={14} />
            <span>Sales Performance</span>
          </Link>

          <Link
            href="/order-desk"
            className="inline-flex items-center gap-2 rounded-[4px] bg-[#79565D] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#67474E] transition-colors"
          >
            <Inbox size={14} />
            <span>Open Order Desk</span>
          </Link>
        </div>
      </div>

      {/* Real Live KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#666864]">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Kirana Network
            </span>
            <Store size={15} className="text-[#79565D]" />
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-[#242724]">
            {loading ? "..." : metrics?.totalRetailers || 0}
          </p>
          <p className="mt-0.5 text-[10px] text-[#969892]">Verified accounts</p>
        </div>

        <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#666864]">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Field Salesmen
            </span>
            <Users size={15} className="text-[#79565D]" />
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-[#242724]">
            {loading ? "..." : metrics?.totalSalesmen || 0}
          </p>
          <p className="mt-0.5 text-[10px] text-[#969892]">Active beat operators</p>
        </div>

        <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#666864]">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Wholesale Orders
            </span>
            <ShoppingCart size={15} className="text-[#205234]" />
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-[#242724]">
            {loading ? "..." : metrics?.totalOrders || 0}
          </p>
          <p className="mt-0.5 text-[10px] text-[#969892]">Booked in database</p>
        </div>

        <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[#666864]">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Confirmed GMV
            </span>
            <TrendingUp size={15} className="text-[#205234]" />
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-[#205234]">
            {loading ? "..." : formatCurrency(metrics?.confirmedRevenue || 0)}
          </p>
          <p className="mt-0.5 text-[10px] text-[#969892]">Approved & dispatched</p>
        </div>
      </div>

      {/* Modules Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {adminModules.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs hover:border-[#79565D] transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-[4px] ${item.accentBg} ${item.accent}`}
                  >
                    <Icon size={18} />
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {item.badge}
                  </Badge>
                </div>
                <h2 className="mt-3.5 font-bold text-sm text-[#242724]">
                  {item.title}
                </h2>
                <p className="mt-1 text-xs text-[#666864] leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-[#F0EFEA] flex items-center justify-between text-xs font-semibold text-[#79565D]">
                <span>Manage Module</span>
                <ArrowRight
                  size={14}
                  className="transition-transform group-hover:translate-x-1"
                />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Governance & Standards */}
      <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-6 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#969892] mb-3">
          <ShieldCheck size={16} className="text-[#79565D]" />
          <span>Jabalpur FMCG Operating Governance</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 text-xs text-[#666864] leading-relaxed">
          <div className="rounded-[4px] border border-[#E7E6E0] bg-[#FAF9F6] p-3.5">
            <p className="font-bold text-[#242724] mb-1">Authenticated Staff Roles</p>
            <p>Staff and salesmen accounts are issued only via encrypted single-use tokens. Public role signup is strictly disallowed.</p>
          </div>
          <div className="rounded-[4px] border border-[#E7E6E0] bg-[#FAF9F6] p-3.5">
            <p className="font-bold text-[#242724] mb-1">Credit Limit Risk Bounds</p>
            <p>All kirana accounts start with sanctioned credit bounds. Orders exceeding limits trigger an Order Desk review lock.</p>
          </div>
          <div className="rounded-[4px] border border-[#E7E6E0] bg-[#FAF9F6] p-3.5">
            <p className="font-bold text-[#242724] mb-1">Daily ERP Export</p>
            <p>Approved dispatches and invoices map 1:1 with Tally ERP 9 / Tally Prime sales voucher schemas.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
