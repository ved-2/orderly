"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  TrendingUp,
  Users,
  Store,
  Package,
  FileSpreadsheet,
  ShieldAlert,
  Inbox,
  Truck,
  UserX,
  LogOut,
  ExternalLink,
  Menu,
  X,
  ChevronRight,
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

const primaryNavItems = [
  {
    label: "Sales & Revenue",
    href: "/distributor/sales",
    icon: TrendingUp,
    badge: "Live",
  },
  {
    label: "Field Salesmen & Beats",
    href: "/distributor/salesman",
    icon: Users,
    badge: null,
  },
  {
    label: "Kirana Network & Credit",
    href: "/distributor/retailers",
    icon: Store,
    badge: null,
  },
  {
    label: "Catalogue & Schemes",
    href: "/distributor/catalogue",
    icon: Package,
    badge: null,
  },
  {
    label: "Staff & Invitations",
    href: "/distributor/staff",
    icon: ShieldAlert,
    badge: null,
  },
  {
    label: "Tally ERP Export",
    href: "/distributor/tally-export",
    icon: FileSpreadsheet,
    badge: null,
  },
];

const operationalShortcuts = [
  {
    label: "Order Desk Queue",
    href: "/order-desk",
    icon: Inbox,
  },
  {
    label: "Van Loading Sheet",
    href: "/order-desk/van-loading",
    icon: Truck,
  },
  {
    label: "14-Day Inactive Stores",
    href: "/order-desk/dormant-retailers",
    icon: UserX,
  },
  {
    label: "Salesman Field Beat",
    href: "/salesman",
    icon: ExternalLink,
  },
];

export default function DistributorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        console.error("Failed to load distributor profile:", err);
      } finally {
        if (isMounted) setProfileLoading(false);
      }
    }

    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [user, authLoading]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-[6px] border border-[#E7E6E0] bg-white p-6 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-[4px] bg-[#E7E6E0]" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3 w-32 animate-pulse rounded bg-[#E7E6E0]" />
              <div className="h-2.5 w-44 animate-pulse rounded bg-[#E7E6E0]" />
            </div>
          </div>
          <p className="mt-4 text-[11px] text-[#969892]">
            Connecting to Distributor Master Console...
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
            Distributor Admin Portal
          </h1>
          <p className="mt-1 text-xs text-[#666864] leading-relaxed">
            Executive administrator authorization is required to access wholesale pricing, trade schemes, and field salesmen beats.
          </p>
          <div className="mt-5">
            <Link
              href="/register"
              className="inline-block rounded-[4px] bg-[#79565D] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#67474E] transition-colors shadow-2xs"
            >
              Sign In with Distributor Account
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
          <h1 className="text-sm font-bold text-[#8C2828]">Access Restricted</h1>
          <p className="mt-1.5 text-xs text-[#666864] leading-relaxed">
            Your account ({profile?.email}) is registered as{" "}
            <strong className="font-semibold text-[#242724]">{profile?.role}</strong>. Only Distributor Administrators may access this management console.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link
              href="/order-desk"
              className="rounded-[4px] border border-[#E7E6E0] bg-white px-3.5 py-2 text-xs font-semibold text-[#242724] hover:bg-[#F0EFEA]"
            >
              Order Desk
            </Link>
            <button
              onClick={() => logout()}
              className="rounded-[4px] bg-[#79565D] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#67474E]"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F6F5F1] text-[#242724] flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-[#E7E6E0] bg-white/95 backdrop-blur-md">
        <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile Drawer Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden flex h-8 w-8 items-center justify-center rounded-[4px] border border-[#E7E6E0] text-[#666864] hover:bg-[#F0EFEA]"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>

            {/* Logo */}
            <Link href="/distributor" className="flex items-center gap-2.5 group">
              <span className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#242724] text-white transition-colors group-hover:bg-[#79565D]">
                <Building2 size={15} />
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-bold tracking-tight text-[#242724]">
                  orderly<span className="text-[#79565D]">.admin</span>
                </span>
                <span className="text-[11px] font-semibold text-[#666864] border-l border-[#E7E6E0] pl-2 hidden sm:inline-block">
                  Jabalpur FMCG Depot
                </span>
              </div>
            </Link>
          </div>

          {/* User profile & actions */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-[#242724]">{profile?.email}</p>
              <Badge variant="accent" className="text-[9px]">
                Distributor Executive
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

      {/* Main Body with Sidebar + Content */}
      <div className="flex-1 flex w-full">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 flex-col border-r border-[#E7E6E0] bg-white shrink-0 p-4 justify-between">
          <div className="space-y-6">
            {/* Primary Navigation */}
            <div>
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#969892] mb-2">
                Distributor Console
              </p>
              <nav className="space-y-1">
                {primaryNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/distributor"
                      ? pathname === "/distributor"
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center justify-between rounded-[4px] px-3 py-2 text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-[#79565D] text-white font-semibold shadow-2xs"
                          : "text-[#666864] hover:bg-[#FAF9F6] hover:text-[#242724]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon size={16} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-[#EEF6F1] text-[#205234]"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Operational Shortcuts */}
            <div className="border-t border-[#F0EFEA] pt-4">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#969892] mb-2">
                Operations & Field
              </p>
              <nav className="space-y-1">
                {operationalShortcuts.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center justify-between rounded-[4px] px-3 py-2 text-xs transition-colors ${
                        isActive
                          ? "bg-[#F4EFF0] text-[#79565D] font-semibold"
                          : "text-[#666864] hover:bg-[#FAF9F6] hover:text-[#242724]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon size={15} />
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight size={12} className="opacity-50" />
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Quick Depot Badge */}
          <div className="rounded-[4px] border border-[#E7E6E0] bg-[#FAF9F6] p-3 text-[11px] text-[#666864]">
            <div className="flex items-center gap-1.5 font-bold text-[#242724]">
              <span className="h-2 w-2 rounded-full bg-[#205234]" />
              <span>Jabalpur Operations Hub</span>
            </div>
            <p className="mt-1 text-[10px] text-[#969892]">
              FMCG Depot OS · Central MP Beat
            </p>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-72 max-w-[80vw] bg-white h-full p-4 flex flex-col justify-between shadow-xl z-10 overflow-y-auto">
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-[#E7E6E0] pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-[#79565D]" />
                    <span className="font-bold text-sm text-[#242724]">
                      Distributor Navigation
                    </span>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 text-[#666864] hover:text-[#242724]"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#969892] mb-2">
                    Core Console
                  </p>
                  <nav className="space-y-1">
                    {primaryNavItems.map((item) => {
                      const Icon = item.icon;
                      const isActive =
                        item.href === "/distributor"
                          ? pathname === "/distributor"
                          : pathname.startsWith(item.href);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center justify-between rounded-[4px] px-3 py-2 text-xs font-medium ${
                            isActive
                              ? "bg-[#79565D] text-white font-semibold"
                              : "text-[#666864] hover:bg-[#FAF9F6]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon size={16} />
                            <span>{item.label}</span>
                          </div>
                          {item.badge && (
                            <span className="rounded bg-[#EEF6F1] px-1.5 py-0.5 text-[9px] font-bold text-[#205234]">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </nav>
                </div>

                <div className="border-t border-[#F0EFEA] pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#969892] mb-2">
                    Operations & Field
                  </p>
                  <nav className="space-y-1">
                    {operationalShortcuts.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname.startsWith(item.href);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center justify-between rounded-[4px] px-3 py-2 text-xs ${
                            isActive
                              ? "bg-[#F4EFF0] text-[#79565D] font-semibold"
                              : "text-[#666864] hover:bg-[#FAF9F6]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon size={15} />
                            <span>{item.label}</span>
                          </div>
                          <ChevronRight size={12} className="opacity-50" />
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              </div>

              <div className="border-t border-[#E7E6E0] pt-4">
                <button
                  onClick={() => logout()}
                  className="flex w-full items-center gap-2 rounded-[4px] border border-[#E7E6E0] px-3 py-2 text-xs font-semibold text-[#666864] hover:bg-[#F0EFEA]"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 min-w-0 bg-[#F6F5F1] overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
