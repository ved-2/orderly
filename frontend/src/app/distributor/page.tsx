"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  LogOut,
  CheckCircle2,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface UserProfile {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
}

const ALLOWED_ROLES = new Set(["DISTRIBUTOR_ADMIN"]);

const adminModules = [
  {
    title: "Kirana Network & Credit",
    description:
      "Verify incoming kirana shop registrations, set credit limits, review outstanding ledgers, and log payment collections.",
    href: "/distributor/retailers",
    badge: "Retailer Roster",
    icon: Store,
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
    title: "Master Catalogue & Schemes",
    description:
      "Manage SKU specifications, wholesale case rates, warehouse depot stock, and promotional Buy-X-Get-Y / slab schemes across 4 brands.",
    href: "/distributor/catalogue",
    badge: "Catalogue Engine",
    icon: Package,
    accent: "text-[#79565D]",
    accentBg: "bg-[#F4EFF0]",
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
  {
    title: "Staff & Salesmen Invitations",
    description:
      "Issue single-use invitations for Order Desk operators and beat salesmen with role-based access tokens.",
    href: "/distributor/staff",
    badge: "Access Control",
    icon: Users,
    accent: "text-[#7A4E12]",
    accentBg: "bg-[#FCF6EC]",
  },
];

export default function DistributorDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setProfileLoading(false);
      return;
    }

    let isMounted = true;
    async function fetchProfile() {
      try {
        setProfileLoading(true);
        setError(null);
        const data = await apiRequest<UserProfile>("/auth/me");
        if (isMounted) setProfile(data);
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Authentication error"
          );
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

  if (authLoading || profileLoading) {
    return (
      <main className="min-h-screen bg-[#F6F5F1] p-8">
        <div className="mx-auto max-w-7xl">
          <div className="h-8 w-48 animate-pulse rounded bg-[#E7E6E0]" />
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-44 animate-pulse rounded bg-[#E7E6E0]" />
            <div className="h-44 animate-pulse rounded bg-[#E7E6E0]" />
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#F6F5F1] flex items-center justify-center p-4">
        <div className="mx-auto max-w-md w-full rounded-[6px] border border-[#E7E6E0] bg-white p-6 text-center shadow-2xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F4EFF0] text-[#79565D]">
            <Building2 size={22} />
          </div>
          <h1 className="mt-4 text-base font-bold text-[#242724]">
            Distributor Admin Portal
          </h1>
          <p className="mt-1 text-xs text-[#666864]">
            Authorized executive sign-in required.
          </p>
          <div className="mt-6">
            <Link
              href="/register"
              className="inline-block rounded-[4px] bg-[#79565D] px-5 py-2.5 text-xs font-semibold text-white"
            >
              Sign In
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="min-h-screen bg-[#F6F5F1] flex items-center justify-center p-4">
        <div className="mx-auto max-w-md w-full rounded-[6px] border border-[#EDBCBC] bg-[#FBF0F0] p-6 text-center">
          <h1 className="text-sm font-bold text-[#8C2828]">Authentication Error</h1>
          <p className="mt-1 text-xs text-[#8C2828] opacity-80">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-[4px] bg-[#8C2828] px-4 py-2 text-xs font-semibold text-white"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!ALLOWED_ROLES.has(profile.role)) {
    return (
      <main className="min-h-screen bg-[#F6F5F1] flex items-center justify-center p-4">
        <div className="mx-auto max-w-md w-full rounded-[6px] border border-[#EED7B3] bg-[#FCF6EC] p-6 text-center">
          <h1 className="text-sm font-bold text-[#7A4E12]">Access Restricted</h1>
          <p className="mt-1 text-xs text-[#7A4E12] opacity-85">
            This module requires DISTRIBUTOR_ADMIN permissions.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link
              href="/order-desk"
              className="rounded-[4px] border border-[#E7E6E0] bg-white px-3 py-1.5 text-xs font-semibold text-[#242724]"
            >
              Order Desk
            </Link>
            <button
              onClick={() => logout()}
              className="rounded-[4px] bg-[#242724] px-3 py-1.5 text-xs font-semibold text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F6F5F1] text-[#242724]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-[#E7E6E0] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 h-14">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#242724] text-white transition-colors group-hover:bg-[#79565D]">
              <Building2 size={15} />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-sm tracking-tight text-[#242724]">
                  orderly<span className="text-[#79565D]">.</span>admin
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#969892]">
                  Jabalpur FMCG Distribution
                </span>
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-[#242724]">{profile.email}</p>
              <Badge variant="accent" className="text-[9px]">
                Distributor Admin
              </Badge>
            </div>
            <button
              onClick={() => logout()}
              title="Sign Out"
              className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-[#E7E6E0] text-[#666864] hover:bg-[#F0EFEA] hover:text-[#242724] transition-colors"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E7E6E0] pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-[#969892]">
                Executive Control Center
              </span>
              <span className="text-[#E7E6E0]">·</span>
              <span className="text-xs text-[#666864]">1,800 Retailers · 4 Brands</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#242724]">
              Distributor Management Console
            </h1>
            <p className="mt-0.5 text-xs text-[#666864]">
              Master control for trade schemes, wholesale catalog, retailer verification, credit limits, and staff.
            </p>
          </div>

          <Link
            href="/order-desk/orders"
            className="inline-flex items-center gap-2 rounded-[4px] bg-[#79565D] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#67474E] transition-colors"
          >
            <Inbox size={14} />
            <span>Open Order Desk</span>
          </Link>
        </div>

        {/* Modules Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
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

        {/* Distributor Governance & Operating Standards */}
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
              <p>All kirana accounts start with ₹0 sanctioned credit. Orders exceeding limits trigger an Order Desk review lock.</p>
            </div>
            <div className="rounded-[4px] border border-[#E7E6E0] bg-[#FAF9F6] p-3.5">
              <p className="font-bold text-[#242724] mb-1">Daily ERP Export</p>
              <p>Approved dispatches and invoices map 1:1 with Tally ERP 9 / Tally Prime sales voucher schemas.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#E7E6E0] bg-white py-4 px-4 sm:px-6 mt-12">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#666864]">
          <span>© {new Date().getFullYear()} Orderly Distribution OS · Jabalpur FMCG Depot</span>
          <div className="flex items-center gap-4 text-[11px] font-medium text-[#79565D]">
            <Link href="/order-desk" className="hover:underline">Order Desk Queue</Link>
            <Link href="/distributor/tally-export" className="hover:underline">Tally Export</Link>
            <Link href="/salesman" className="hover:underline">Salesman Beat</Link>
            <Link href="/" className="hover:underline text-[#242724]">Portal Switcher</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
