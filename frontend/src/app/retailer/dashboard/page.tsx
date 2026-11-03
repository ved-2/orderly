
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Store,
  Package,
  ShoppingBag,
  ClipboardList,
  CreditCard,
  LogOut,
  Loader2,
  ArrowRight,
  CircleUserRound,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";

interface UserProfile {
  id: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
}

export default function RetailerDashboard() {
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
        const data = await apiRequest<UserProfile>("/auth/me");

        if (cancelled) return;

        if (data.role !== "RETAILER") {
          setError("This dashboard is only available to retailer accounts.");
          return;
        }

        setProfile(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your account.",
          );
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    }

    void loadProfile();

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
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f2]">
        <Loader2 className="animate-spin text-slate-700" size={26} />
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f2] px-5">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-7">
          <h1 className="text-xl font-semibold">Unable to open dashboard</h1>
          <p className="mt-3 text-sm text-slate-600">
            {error || "Your account profile could not be loaded."}
          </p>
          <button
            onClick={handleLogout}
            className="mt-6 rounded-md bg-slate-900 px-4 py-2.5 text-sm text-white"
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  const navigation = [
    { label: "Overview", icon: Store },
    { label: "Product catalogue", icon: Package },
    { label: "My orders", icon: ClipboardList },
    { label: "Shopping cart", icon: ShoppingBag },
    { label: "Credit account", icon: CreditCard },
  ];

  return (
    <main className="min-h-screen bg-[#f5f5f2] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-white">
              <Store size={19} />
            </div>
            <span className="text-xl font-semibold tracking-tight">
              orderly
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] md:grid-cols-[240px_1fr]">
        <aside className="border-b border-slate-200 bg-white p-5 md:min-h-[calc(100vh-64px)] md:border-b-0 md:border-r">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Workspace
          </p>

          <nav className="space-y-1">
            {navigation.map((item, index) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm ${
                    index === 0
                      ? "bg-slate-900 font-medium text-white"
                      : "text-slate-500"
                  }`}
                >
                  <Icon size={17} />
                  {item.label}
                  {index !== 0 && (
                    <span className="ml-auto text-[10px] uppercase tracking-wide">
                      Soon
                    </span>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="mt-10 border-t border-slate-200 pt-5">
            <div className="flex items-center gap-3">
              <CircleUserRound size={20} className="text-slate-500" />
              <div className="min-w-0">
                <p className="text-xs font-medium">Signed in as</p>
                <p className="truncate text-xs text-slate-500">
                  {profile.email}
                </p>
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0 p-5 sm:p-8 lg:p-10">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              Retailer workspace
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Welcome to Orderly.
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              Manage your purchases and distributor orders from one place.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Your account
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  Retailer account connected
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Your authenticated account is connected to Orderly.
                </p>
              </div>

              <span className="w-fit rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800">
                Account active
              </span>
            </div>

            <div className="mt-7 grid gap-5 border-t border-slate-100 pt-6 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">Email address</p>
                <p className="mt-1 break-all text-sm font-medium">
                  {profile.email}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Account role</p>
                <p className="mt-1 text-sm font-medium">
                  {profile.role}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Getting started
            </p>

            <h2 className="mt-2 text-xl font-semibold">
              Your product catalogue is coming next.
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
              Soon you will be able to browse distributor products,
              compare your shop prices, view active schemes and place
              orders directly.
            </p>

            <div className="mt-6 flex items-center gap-2 text-sm font-medium text-slate-400">
              Catalogue module
              <ArrowRight size={16} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
