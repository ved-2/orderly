"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Inbox,
  ClipboardList,
  ShieldAlert,
  CheckCircle2,
  FileSpreadsheet,
  Building2,
  LogOut,
  ExternalLink,
  Store,
  RefreshCw,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface UserProfile {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  retailer_id: string | null;
}

interface DeskStatusCounts {
  ALL: number;
  SUBMITTED: number;
  UNDER_REVIEW: number;
  ON_HOLD: number;
  APPROVED: number;
  REJECTED: number;
  DISPATCHED: number;
}

interface DeskListingResponse {
  counts: DeskStatusCounts;
}

const ALLOWED_ROLES = new Set(["ORDER_DESK", "DISTRIBUTOR_ADMIN"]);

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  countKey?: "queue" | "holds" | "approved";
  badgeVariant?: "default" | "success" | "warning" | "danger" | "info" | "accent";
}

const navItems: NavItem[] = [
  {
    label: "Workspace",
    href: "/order-desk",
    icon: Inbox,
  },
  {
    label: "Orders Queue",
    href: "/order-desk/orders",
    icon: ClipboardList,
    countKey: "queue",
    badgeVariant: "warning",
  },
  {
    label: "Credit Holds",
    href: "/order-desk/orders?status=ON_HOLD",
    icon: ShieldAlert,
    countKey: "holds",
    badgeVariant: "danger",
  },
  {
    label: "Confirmed",
    href: "/order-desk/orders?status=APPROVED",
    icon: CheckCircle2,
    countKey: "approved",
    badgeVariant: "success",
  },
  {
    label: "Tally Export",
    href: "/distributor/tally-export",
    icon: FileSpreadsheet,
  },
];

function OrderDeskShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [counts, setCounts] = useState<DeskStatusCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(false);

  const statusParam = searchParams.get("status");

  // Authenticate staff profile
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setProfileLoading(false);
      return;
    }

    let isMounted = true;
    apiRequest<UserProfile>("/auth/me")
      .then((data) => {
        if (isMounted) setProfile(data);
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setProfileLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user, authLoading]);

  // Load status counts for navigation badges
  const loadCounts = useCallback(async () => {
    if (!profile || !ALLOWED_ROLES.has(profile.role)) return;
    try {
      setCountsLoading(true);
      const res = await apiRequest<DeskListingResponse>("/orders/desk?limit=1");
      if (res.counts) {
        setCounts(res.counts);
      }
    } catch {
      // Non-blocking for navigation
    } finally {
      setCountsLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts, pathname, statusParam]);

  const handleLogout = async () => {
    await logout();
    router.replace("/register");
  };

  const isNavActive = (href: string) => {
    if (href === "/order-desk") {
      return pathname === "/order-desk";
    }
    if (href.includes("status=ON_HOLD")) {
      return pathname === "/order-desk/orders" && statusParam === "ON_HOLD";
    }
    if (href.includes("status=APPROVED")) {
      return pathname === "/order-desk/orders" && statusParam === "APPROVED";
    }
    if (href === "/order-desk/orders") {
      return (
        pathname.startsWith("/order-desk/orders") &&
        statusParam !== "ON_HOLD" &&
        statusParam !== "APPROVED"
      );
    }
    if (href === "/distributor/tally-export") {
      return pathname.startsWith("/distributor/tally-export");
    }
    return pathname === href;
  };

  const getBadgeCount = (key?: "queue" | "holds" | "approved") => {
    if (!counts || !key) return null;
    if (key === "queue") {
      const q = (counts.SUBMITTED || 0) + (counts.UNDER_REVIEW || 0);
      return q > 0 ? q : null;
    }
    if (key === "holds") {
      return counts.ON_HOLD > 0 ? counts.ON_HOLD : null;
    }
    if (key === "approved") {
      return counts.APPROVED > 0 ? counts.APPROVED : null;
    }
    return null;
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-[6px] border border-[#E7E6E0] bg-white p-6 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-[4px] bg-[#E7E6E0]" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3 w-28 animate-pulse rounded bg-[#E7E6E0]" />
              <div className="h-2.5 w-40 animate-pulse rounded bg-[#E7E6E0]" />
            </div>
          </div>
          <p className="mt-4 text-[11px] text-[#969892]">
            Connecting to Order Desk Workstation...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-[6px] border border-[#E7E6E0] bg-white p-6 text-center shadow-2xs">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-[4px] bg-[#F4EFF0] text-[#79565D]">
            <Building2 size={20} />
          </div>
          <h1 className="mt-3.5 text-base font-bold text-[#242724]">
            Order Desk Authentication
          </h1>
          <p className="mt-1 text-xs text-[#666864] leading-relaxed">
            Staff credentials are required to review retailer orders, allocate warehouse stock, and process billing vouchers.
          </p>
          <div className="mt-5">
            <Link
              href="/register"
              className="inline-block rounded-[4px] bg-[#79565D] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#67474E] transition-colors shadow-2xs"
            >
              Sign In with Staff Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!ALLOWED_ROLES.has(profile?.role || "")) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-[6px] border border-[#EDBCBC] bg-white p-6 text-center shadow-2xs">
          <h1 className="text-sm font-bold text-[#8C2828]">
            Access Restricted
          </h1>
          <p className="mt-1.5 text-xs text-[#666864] leading-relaxed">
            Your account ({profile?.email}) is registered as{" "}
            <strong className="font-semibold text-[#242724]">{profile?.role}</strong>. Only Order Desk staff and Distributor Administrators may access this operational workstation.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link
              href="/"
              className="rounded-[4px] border border-[#E7E6E0] bg-white px-3.5 py-2 text-xs font-semibold text-[#242724] hover:bg-[#F0EFEA]"
            >
              Return to Home
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-[4px] bg-[#79565D] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#67474E]"
            >
              Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F6F5F1] text-[#242724]">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-[#E7E6E0] bg-white/95 backdrop-blur-md">
        <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6">
          {/* Brand Mark & Depot Identity */}
          <div className="flex items-center gap-3">
            <Link href="/order-desk" className="flex items-center gap-2 group">
              <span className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#242724] text-white transition-colors group-hover:bg-[#79565D]">
                <Store size={15} />
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-bold tracking-tight text-[#242724]">
                  orderly<span className="text-[#79565D]">.</span>
                </span>
                <span className="text-[11px] font-semibold text-[#666864] border-l border-[#E7E6E0] pl-2 hidden sm:inline-block">
                  Order Desk
                </span>
              </div>
            </Link>

            {/* Depot Status Indicator */}
            <div className="hidden md:flex items-center gap-1.5 rounded-full border border-[#E7E6E0] bg-[#FAF9F6] px-2.5 py-0.5 text-[10px] font-medium text-[#666864]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#205234]" />
              <span>Jabalpur Depot</span>
            </div>
          </div>

          {/* Right Header: Profile, Admin Switcher & Sign Out */}
          <div className="flex items-center gap-3">
            {profile?.role === "DISTRIBUTOR_ADMIN" && (
              <Link
                href="/distributor"
                className="hidden sm:flex items-center gap-1 rounded-[4px] border border-[#E7E6E0] bg-[#FAF9F6] px-2.5 py-1 text-[11px] font-medium text-[#666864] hover:bg-[#F0EFEA] hover:text-[#242724] transition-colors"
                title="Switch to Distributor Administration Console"
              >
                <Building2 size={13} />
                <span>Distributor Admin</span>
                <ExternalLink size={11} className="text-[#969892]" />
              </Link>
            )}

            <div className="flex items-center gap-2">
              <Badge variant="accent" className="text-[10px]">
                {profile?.role.replace("_", " ")}
              </Badge>
              <span className="text-xs text-[#666864] hidden lg:inline max-w-[140px] truncate">
                {profile?.email}
              </span>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="flex items-center justify-center h-8 w-8 rounded-[4px] border border-[#E7E6E0] text-[#666864] hover:bg-[#F0EFEA] hover:text-[#242724] transition-colors"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex min-h-[calc(100vh-56px)] w-full">
        {/* Desktop Left Sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-[#E7E6E0] bg-white p-3.5 md:flex flex-col justify-between sticky top-14 h-[calc(100vh-56px)] overflow-y-auto">
          <div>
            <div className="flex items-center justify-between px-2 mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#969892]">
                Workstation Navigation
              </p>
              <button
                type="button"
                onClick={loadCounts}
                title="Refresh queue counts"
                className="text-[#969892] hover:text-[#242724] transition-colors p-0.5"
              >
                <RefreshCw size={11} className={countsLoading ? "animate-spin" : ""} />
              </button>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(item.href);
                const count = getBadgeCount(item.countKey);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between px-3 py-2 rounded-[4px] text-xs font-medium transition-colors ${
                      active
                        ? "bg-[#242724] text-white shadow-2xs font-semibold"
                        : "text-[#666864] hover:bg-[#F0EFEA] hover:text-[#242724]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        size={15}
                        className={active ? "text-white" : "text-[#79565D] shrink-0"}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {count !== null && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full tabular-nums shrink-0 ${
                          active
                            ? "bg-white text-[#242724]"
                            : item.badgeVariant === "danger"
                            ? "bg-[#FBF0F0] text-[#8C2828] border border-[#EDBCBC]"
                            : item.badgeVariant === "warning"
                            ? "bg-[#FCF6EC] text-[#7A4E12] border border-[#EED7B3]"
                            : "bg-[#EEF6F1] text-[#205234] border border-[#C3DEC9]"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Depot Architecture Status Card */}
          <div className="border-t border-[#E7E6E0] pt-3 mt-auto space-y-2">
            <div className="rounded-[4px] border border-[#E7E6E0] bg-[#FAF9F6] p-2.5 text-[11px] text-[#666864]">
              <div className="flex items-center justify-between text-[#242724] font-semibold mb-1">
                <span>Depot Lock Status</span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#205234]" />
              </div>
              <p className="text-[10px] text-[#969892] leading-tight">
                Physical reservations active on warehouse depot stock upon approval.
              </p>
            </div>

            <div className="px-1 text-[11px] text-[#969892]">
              <p className="truncate font-medium text-[#242724]">{profile?.email}</p>
              <p className="text-[10px] text-[#969892] mt-0.5">Orderly Operations v1.0</p>
            </div>
          </div>
        </aside>

        {/* Dynamic Route Content */}
        <main className="min-w-0 flex-1 pb-24 md:pb-8">{children}</main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Order Desk Mobile Navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-[#E7E6E0] bg-white/95 px-1 py-1.5 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] backdrop-blur-md md:hidden"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(item.href);
          const count = getBadgeCount(item.countKey);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2 text-[10px] font-medium transition-colors relative ${
                active ? "text-[#79565D] font-bold" : "text-[#666864] hover:text-[#242724]"
              }`}
            >
              <div className="relative">
                <Icon size={18} />
                {count !== null && (
                  <span className="absolute -top-1.5 -right-2.5 h-3.5 min-w-[14px] px-1 rounded-full bg-[#79565D] text-[9px] font-bold text-white flex items-center justify-center tabular-nums">
                    {count}
                  </span>
                )}
              </div>
              <span className="mt-1 truncate max-w-[62px] text-center leading-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function OrderDeskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F6F5F1] flex items-center justify-center p-6">
          <p className="text-xs text-[#666864]">Loading Order Desk workspace...</p>
        </div>
      }
    >
      <OrderDeskShell>{children}</OrderDeskShell>
    </Suspense>
  );
}
