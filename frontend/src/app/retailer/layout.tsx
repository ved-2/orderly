"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Package,
  ShoppingBag,
  ShoppingCart,
  LogOut,
  Store,
  Wallet,
  Sparkles,
  Settings,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";
import { getCartItemCount, getCartSubtotal } from "@/lib/cart";

/* ------------------------------------------------------------------ */
/*  Navigation definitions                                             */
/* ------------------------------------------------------------------ */

const sidebarNavigation = [
  { label: "Home", href: "/retailer/dashboard", icon: Home },
  { label: "Catalogue", href: "/retailer/catalogue", icon: Package },
  { label: "AI Ordering", href: "/retailer/dashboard#ai-ordering", icon: Sparkles },
  { label: "Orders", href: "/retailer/orders", icon: ShoppingBag },
  { label: "Credit", href: "/retailer/credit", icon: Wallet },
];

const mobileNavigation = [
  { label: "Home", href: "/retailer/dashboard", icon: Home },
  { label: "Catalogue", href: "/retailer/catalogue", icon: Package },
  { label: "AI", href: "/retailer/dashboard#ai-ordering", icon: Sparkles },
  { label: "Orders", href: "/retailer/orders", icon: ShoppingBag },
  { label: "Credit", href: "/retailer/credit", icon: Wallet },
];

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface UserProfile {
  id: string;
  email: string;
  role: string;
  retailer_id: string | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/* ------------------------------------------------------------------ */
/*  Layout                                                             */
/* ------------------------------------------------------------------ */

export default function RetailerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [cartCount, setCartCount] = useState(0);
  const [cartSubtotal, setCartSubtotal] = useState(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Sync cart counter
  useEffect(() => {
    const syncCart = () => {
      setCartCount(getCartItemCount());
      setCartSubtotal(getCartSubtotal());
    };
    syncCart();
    window.addEventListener("orderly-cart-updated", syncCart);
    window.addEventListener("storage", syncCart);

    return () => {
      window.removeEventListener("orderly-cart-updated", syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, []);

  // Load user profile
  useEffect(() => {
    let active = true;
    if (user) {
      apiRequest<UserProfile>("/auth/me")
        .then((p) => {
          if (active) setProfile(p);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [user]);

  const handleLogout = async () => {
    await logout();
    router.replace("/register");
  };

  const isNavActive = (href: string) => {
    if (href.includes("#")) {
      return false;
    }
    return pathname === href;
  };

  return (
    <div className="min-h-screen w-full bg-[#F6F5F1] text-[#242724]">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-[#E7E6E0] bg-[#FFFFFF]/90 backdrop-blur-md">
        <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6">
          {/* Brand Mark */}
          <div className="flex items-center gap-3">
            <Link href="/retailer/dashboard" className="flex items-center gap-2 group">
              <span className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#242724] text-white transition-colors group-hover:bg-[#79565D]">
                <Store size={15} />
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-bold tracking-tight text-[#242724]">
                  orderly<span className="text-[#79565D]">.</span>
                </span>
                <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-wider text-[#969892] border-l border-[#E7E6E0] pl-2">
                  Jabalpur FMCG Hub
                </span>
              </div>
            </Link>
          </div>

          {/* Right Controls: Cart & Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Cart Trigger */}
            <Link
              href="/retailer/cart"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-[4px] border text-xs font-semibold transition-all duration-150 ${
                cartCount > 0
                  ? "border-[#79565D] bg-[#F4EFF0] text-[#67474E] hover:bg-[#EBDDE0]"
                  : "border-[#E7E6E0] bg-white text-[#666864] hover:bg-[#F0EFEA]"
              }`}
            >
              <ShoppingCart size={15} className={cartCount > 0 ? "text-[#79565D]" : "text-[#666864]"} />
              <span className="tabular-nums font-bold">{cartCount}</span>
              {cartSubtotal > 0 && (
                <span className="hidden sm:inline border-l border-[#D5D3CB] pl-1.5 font-mono text-[#242724]">
                  {formatCurrency(cartSubtotal)}
                </span>
              )}
            </Link>

            {/* Logout */}
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
        {/* Desktop Sidebar (Fixed / Stiff) */}
        <aside className="hidden w-56 shrink-0 border-r border-[#E7E6E0] bg-[#FFFFFF] p-4 md:flex flex-col justify-between sticky top-14 h-[calc(100vh-56px)] overflow-y-auto">
          {/* Main Nav Items */}
          <div>
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-[#969892]">
              Kirana Workspace
            </p>
            <nav className="space-y-1">
              {sidebarNavigation.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-[4px] text-xs font-semibold transition-colors duration-150 ${
                      active
                        ? "bg-[#242724] text-white shadow-2xs"
                        : "text-[#666864] hover:bg-[#F0EFEA] hover:text-[#242724]"
                    }`}
                  >
                    <Icon size={16} className={active ? "text-white" : "text-[#79565D]"} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Bottom Pinned Settings & Shop Profile */}
          <div className="border-t border-[#E7E6E0] pt-2 mt-auto space-y-1">
            <Link
              href="/retailer/settings"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-[4px] text-xs font-semibold transition-colors duration-150 ${
                pathname === "/retailer/settings"
                  ? "bg-[#242724] text-white shadow-2xs"
                  : "text-[#666864] hover:bg-[#F0EFEA] hover:text-[#242724]"
              }`}
            >
              <Settings size={16} className={pathname === "/retailer/settings" ? "text-white" : "text-[#79565D]"} />
              Settings
            </Link>

            <div className="pt-2 px-1 text-[11px] text-[#666864] border-t border-[#F0EFEA]">
              <p className="font-semibold text-[#242724] truncate">
                {profile?.email || "Kirana Account"}
              </p>
              <p className="text-[10px] text-[#969892] mt-0.5">
                Jabalpur Central Depot
              </p>
            </div>
          </div>
        </aside>

        {/* Dynamic Route Content */}
        <main className="min-w-0 flex-1 pb-24 md:pb-8">{children}</main>
      </div>

      {/* Mobile Bottom Navigation Bar — exactly 5 items: Home, Catalogue, AI, Orders, Credit */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[#E7E6E0] bg-[#FFFFFF] pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_rgba(0,0,0,0.04)] md:hidden">
        {mobileNavigation.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(item.href);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${
                active
                  ? "text-[#79565D]"
                  : "text-[#666864] hover:text-[#242724]"
              }`}
            >
              <div
                className={`p-1 rounded-[4px] ${
                  active ? "bg-[#F4EFF0] text-[#79565D]" : ""
                }`}
              >
                <Icon size={18} />
              </div>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
