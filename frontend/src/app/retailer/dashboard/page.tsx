
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Wallet,
  Store,
  LogOut,
  ArrowRight,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";

interface UserProfile {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  retailer_id: string | null;
  retailer_registration_status: string | null;
}

const navigation = [
  { label: "Overview", href: "/retailer/dashboard", icon: LayoutDashboard },
  { label: "Catalogue", href: "/retailer/catalogue", icon: Package },
  { label: "My Orders", href: "/retailer/orders", icon: ShoppingBag },
  { label: "Credit Account", href: "/retailer/credit", icon: Wallet },
];

export default function RetailerDashboardPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/register");
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      try {
        const result = await apiRequest<UserProfile>("/auth/me");

        if (cancelled) return;

        if (result.role !== "RETAILER" || !result.retailer_id) {
          router.replace("/register");
          return;
        }

        setProfile(result);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your dashboard."
          );
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user, loading, router]);

  async function handleLogout() {
    await logout();
    router.replace("/register");
  }

  if (loading || profileLoading) {
    return (
      <main className="min-h-screen w-full bg-[#f7f7f5] p-4">
        <div className="h-20 animate-pulse bg-neutral-200" />
        <div className="mt-5 h-40 animate-pulse bg-neutral-200" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f5] p-5">
        <div className="w-full max-w-md border border-neutral-200 bg-white p-5">
          <h2 className="font-semibold">Unable to open dashboard</h2>
          <p className="mt-2 text-sm text-neutral-500">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 bg-neutral-900 px-5 py-2.5 text-sm text-white"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!profile) return null;

  return (
    <main className="min-h-screen w-full bg-[#f7f7f5] text-neutral-900">

      {/* Top header */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
        <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6">
          <Link
            href="/retailer/dashboard"
            className="flex items-center gap-2"
          >
            <div className="flex h-8 w-8 items-center justify-center bg-neutral-900 text-white">
              <Store size={17} />
            </div>
            <span className="text-lg font-bold tracking-tight">
              orderly
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden max-w-[220px] truncate text-sm text-neutral-500 sm:block">
              {profile.email}
            </span>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 border border-neutral-200 px-3 py-2 text-xs font-medium hover:bg-neutral-50"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Sign out</span>
            </button>

          </div>
        </div>

        {/* Mobile navigation */}
        <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(0,0,0,0.06)] md:hidden">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/retailer/dashboard";

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-3 text-[11px] font-medium ${
                  active
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Main layout */}
      <div className="flex min-h-[calc(100vh-56px)] w-full">

        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-neutral-200 bg-white p-4 md:block">
          <p className="mb-4 px-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
            Workspace
          </p>

          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/retailer/dashboard";

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-3 text-sm ${
                    active
                      ? "bg-neutral-900 font-medium text-white"
                      : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  <Icon size={17} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Dashboard content */}
        <section className="min-w-0 flex-1 px-4 py-5 pb-24 sm:px-6 lg:px-8 md:pb-5">

          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-neutral-500">
                Retailer workspace / Overview
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                Welcome back
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                Manage your products and distributor orders.
              </p>
            </div>

            <Link
              href="/retailer/catalogue"
              className="inline-flex items-center gap-2 bg-neutral-900 px-4 py-3 text-sm font-medium text-white hover:bg-neutral-700"
            >
              Browse products
              <ArrowRight size={16} />
            </Link>
          </div>

          {/* Account status */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-neutral-200 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-medium">Shop registration</p>
              <p className="mt-1 text-xs text-neutral-500">
                {profile.retailer_registration_status === "PENDING_REVIEW"
                  ? "Your shop details are awaiting distributor review."
                  : profile.retailer_registration_status === "ACTIVE"
                    ? "Your shop registration is approved."
                    : profile.retailer_registration_status}
              </p>
            </div>

            <span className="border border-neutral-300 px-3 py-1.5 text-xs font-medium">
              {profile.retailer_registration_status === "ACTIVE"
                ? "Approved"
                : profile.retailer_registration_status === "PENDING_REVIEW"
                  ? "Under review"
                  : profile.retailer_registration_status ?? "Unknown"}
            </span>
          </div>

          {/* Main actions */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">

            <Link
              href="/retailer/catalogue"
              className="group border border-neutral-200 bg-white p-5 transition-colors hover:border-neutral-400"
            >
              <div className="flex items-start justify-between">
                <Package size={21} />
                <ArrowRight
                  size={17}
                  className="text-neutral-400 transition-transform group-hover:translate-x-1"
                />
              </div>
              <h2 className="mt-6 font-semibold">Product catalogue</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Explore products, prices and available offers.
              </p>
            </Link>

            <Link
              href="/retailer/orders"
              className="group border border-neutral-200 bg-white p-5 transition-colors hover:border-neutral-400"
            >
              <div className="flex items-start justify-between">
                <ShoppingBag size={21} />
                <ArrowRight
                  size={17}
                  className="text-neutral-400 transition-transform group-hover:translate-x-1"
                />
              </div>
              <h2 className="mt-6 font-semibold">My orders</h2>
              <p className="mt-1 text-sm text-neutral-500">
                View your order history and order status.
              </p>
            </Link>

            <Link
              href="/retailer/credit"
              className="group border border-neutral-200 bg-white p-5 transition-colors hover:border-neutral-400"
            >
              <div className="flex items-start justify-between">
                <Wallet size={21} />
                <ArrowRight
                  size={17}
                  className="text-neutral-400 transition-transform group-hover:translate-x-1"
                />
              </div>
              <h2 className="mt-6 font-semibold">Credit account</h2>
              <p className="mt-1 text-sm text-neutral-500">
                View your credit account and outstanding balance.
              </p>
            </Link>

          </div>

          {/* Empty state for future order data */}
          <section className="mt-5 border border-neutral-200 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Recent activity</h2>
              <Link
                href="/retailer/orders"
                className="text-xs font-medium text-neutral-600 underline underline-offset-4"
              >
                View orders
              </Link>
            </div>

            <div className="py-10 text-center">
              <ShoppingBag
                size={25}
                className="mx-auto text-neutral-400"
              />
              <p className="mt-3 text-sm font-medium">
                Your orders will appear here
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Start browsing the catalogue to place your first order.
              </p>
              <Link
                href="/retailer/catalogue"
                className="mt-4 inline-block border border-neutral-300 px-4 py-2.5 text-sm font-medium hover:bg-neutral-50"
              >
                Explore products
              </Link>
            </div>
          </section>

          <footer className="mt-8 border-t border-neutral-200 py-4 text-xs text-neutral-400">
            Orderly · Retailer workspace
          </footer>
        </section>
      </div>
    </main>
  );
}
