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
  Settings,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";
import { getCartItemCount, getCartSubtotal } from "@/lib/cart";
import {
  AIAssistantProvider,
  useAIAssistant,
} from "@/contexts/ai-assistant-context";
import { AIAssistantChatDrawer } from "@/components/ai-assistant/chat-drawer";
import { AIAssistantVoiceModal } from "@/components/ai-assistant/voice-modal";

/* ------------------------------------------------------------------ */
/*  Navigation definitions                                             */
/* ------------------------------------------------------------------ */

const sidebarNavigation = [
  { label: "Home", href: "/retailer/dashboard", icon: Home },
  { label: "AI Assistant", href: "/retailer/assistant", icon: Sparkles },
  { label: "Catalogue", href: "/retailer/catalogue", icon: Package },
  { label: "Orders", href: "/retailer/orders", icon: ShoppingBag },
  { label: "Credit", href: "/retailer/credit", icon: Wallet },
];

const mobileNavLeft = [
  { label: "Home", href: "/retailer/dashboard", icon: Home },
  { label: "Catalogue", href: "/retailer/catalogue", icon: Package },
];

const mobileNavRight = [
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
/*  Layout Inner                                                       */
/* ------------------------------------------------------------------ */

function RetailerLayoutInner({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const { openAssistant, isOpen: isAIOpen } = useAIAssistant();

  const [cartCount, setCartCount] = useState(0);
  const [cartSubtotal, setCartSubtotal] = useState(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [currentHash, setCurrentHash] = useState("");
  const isAssistantPage = pathname === "/retailer/assistant";

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

  useEffect(() => {
    const syncHash = () => setCurrentHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  // Load user profile
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setProfileLoading(false);
      return;
    }

    let active = true;
    apiRequest<UserProfile>("/auth/me")
      .then((p) => {
        if (active) setProfile(p);
      })
      .catch((err) => {
        console.error("Failed to load retailer profile:", err);
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user, authLoading]);

  const handleLogout = async () => {
    await logout();
    router.replace("/register");
  };

  const isNavActive = (href: string) => {
    if (href.includes("#")) {
      const [path, hash] = href.split("#");
      return pathname === path && currentHash === `#${hash}`;
    }
    return (
      pathname === href &&
      ![...mobileNavLeft, ...mobileNavRight].some((item) => {
        if (!item.href.includes("#")) return false;
        const [path, hash] = item.href.split("#");
        return path === href && currentHash === `#${hash}`;
      })
    );
  };

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
            Connecting to Kirana Retailer Portal...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-[6px] border border-[#E7E6E0] bg-white p-6 text-center shadow-2xs space-y-4">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-[4px] bg-[#F4EFF0] text-[#79565D]">
            <Store size={20} />
          </div>
          <h1 className="text-base font-bold text-[#242724]">
            Kirana Retailer Portal
          </h1>
          <p className="text-xs text-[#666864] leading-relaxed">
            Please sign in with your Kirana Store account to access wholesale distributor pricing, trade schemes, and order placement.
          </p>
          <div className="pt-2">
            <Link
              href="/register"
              className="inline-block rounded-[4px] bg-[#79565D] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#67474E] transition-colors shadow-2xs"
            >
              Sign In with Kirana Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F6F5F1] text-[#242724]">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-40 h-14 border-b border-[#E7E6E0] bg-[#FFFFFF]/95 backdrop-blur-md">
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
      <div className={`flex w-full pt-14 ${isAssistantPage ? "h-[100dvh] overflow-hidden" : "min-h-screen"}`}>

        {/* Desktop Sidebar */}
        <aside className="hidden md:flex fixed top-14 left-0 bottom-0 w-60 z-30 flex-col justify-between border-r border-[#E7E6E0] bg-[#FFFFFF] p-4 overflow-y-auto">
          {/* Main Nav Items */}
          <div>
            <p className="mb-3 px-3 text-[10px] font-medium uppercase tracking-widest text-[#969892]">
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
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-[4px] text-xs font-medium transition-colors duration-150 ${
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-[4px] text-xs font-medium transition-colors duration-150 ${
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
        <main className={`min-w-0 flex-1 md:pl-60 ${isAssistantPage ? "flex flex-col h-full min-h-0 overflow-hidden pb-[4.5rem] md:pb-0" : "pb-24 md:pb-8"}`}>{children}</main>
      </div>

      {/* Global AI Assistant Chat Drawer & Voice Modal */}
      <AIAssistantChatDrawer />
      <AIAssistantVoiceModal />

      {/* Mobile Bottom Navigation Bar — exactly 5 items: Home, Catalogue, AI (middle), Orders, Credit */}
      <nav
        aria-label="Retailer navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex items-end justify-around rounded-t-[24px] border-t border-white/75 bg-[linear-gradient(120deg,rgba(255,255,255,0.95),rgba(244,239,240,0.9)_55%,rgba(237,230,240,0.95))] px-1 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.4rem)] shadow-[0_-8px_28px_rgba(61,48,49,0.12)] backdrop-blur-2xl md:hidden"
      >
        {/* Left 2 items: Home, Catalogue */}
        {mobileNavLeft.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(item.href);

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`group flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5 text-[10px] font-medium transition-colors ${
                active ? "text-[#79565D]" : "text-[#666864] hover:text-[#242724]"
              }`}
            >
              <div
                className={`grid size-9 place-items-center rounded-full transition-all duration-200 ${
                  active
                    ? "-mt-5 size-11 border-[3px] border-[#F6F5F1] bg-[linear-gradient(145deg,#79565D,#9C7683)] text-white shadow-[0_5px_14px_rgba(121,86,93,0.32)]"
                    : "text-[#666864] group-hover:bg-white/70"
                }`}
              >
                <Icon size={active ? 19 : 18} strokeWidth={active ? 2.2 : 1.8} />
              </div>
              <span className={`truncate leading-tight ${active ? "font-semibold text-[#67474E]" : ""}`}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Center: AI Assistant Link */}
        <Link
          href="/retailer/assistant"
          aria-label="Open AI Assistanting Assistant"
          className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5 text-[10px] font-medium transition-colors text-[#79565D]"
        >
          <div className={`-mt-6 size-12 grid place-items-center rounded-full border-[3px] border-[#F6F5F1] transition-transform active:scale-95 ${
            pathname === "/retailer/assistant"
              ? "bg-[#242724] text-white shadow-[0_6px_18px_rgba(36,39,36,0.35)]"
              : "bg-[linear-gradient(135deg,#79565D,#9C7683)] text-white shadow-[0_6px_18px_rgba(121,86,93,0.4)]"
          }`}>
            <Sparkles size={20} />
          </div>
          <span className={`truncate leading-tight font-semibold ${
            pathname === "/retailer/assistant" ? "text-[#242724]" : "text-[#67474E]"
          }`}>
            AI Order
          </span>
        </Link>

        {/* Right 2 items: Orders, Credit */}
        {mobileNavRight.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(item.href);

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`group flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5 text-[10px] font-medium transition-colors ${
                active ? "text-[#79565D]" : "text-[#666864] hover:text-[#242724]"
              }`}
            >
              <div
                className={`grid size-9 place-items-center rounded-full transition-all duration-200 ${
                  active
                    ? "-mt-5 size-11 border-[3px] border-[#F6F5F1] bg-[linear-gradient(145deg,#79565D,#9C7683)] text-white shadow-[0_5px_14px_rgba(121,86,93,0.32)]"
                    : "text-[#666864] group-hover:bg-white/70"
                }`}
              >
                <Icon size={active ? 19 : 18} strokeWidth={active ? 2.2 : 1.8} />
              </div>
              <span className={`truncate leading-tight ${active ? "font-semibold text-[#67474E]" : ""}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function RetailerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AIAssistantProvider>
      <RetailerLayoutInner>{children}</RetailerLayoutInner>
    </AIAssistantProvider>
  );
}
