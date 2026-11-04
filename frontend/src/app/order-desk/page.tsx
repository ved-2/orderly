"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

const ALLOWED_ROLES = new Set(["ORDER_DESK", "DISTRIBUTOR_ADMIN"]);

const navigation = [
  {
    label: "Pending Orders",
    href: "/order-desk/orders",
    description: "Review, verify, and process incoming submitted orders.",
    badge: "Active Queue",
  },
];

export default function OrderDeskDashboard() {
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

    async function loadProfile() {
      try {
        setProfileLoading(true);
        setError(null);
        const data = await apiRequest<UserProfile>("/auth/me");
        if (isMounted) {
          setProfile(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load staff profile. Please try again."
          );
        }
      } finally {
        if (isMounted) {
          setProfileLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [user, authLoading]);

  // 1. Loading state
  if (authLoading || profileLoading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm text-gray-500">Authenticating staff session...</p>
        </div>
      </main>
    );
  }

  // 2. Unauthenticated state
  if (!user) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-md border border-gray-200 bg-white p-6 shadow-xs">
          <h1 className="text-lg font-semibold text-gray-950">
            Sign In Required
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Please sign in with your staff account to access the Order Desk workspace.
          </p>
          <div className="mt-6">
            <Link
              href="/register"
              className="inline-block bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Go to sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 3. Error loading profile
  if (error || !profile) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-md border border-red-200 bg-white p-6">
          <h1 className="text-lg font-semibold text-red-950">
            Profile Verification Failed
          </h1>
          <p className="mt-2 text-sm text-red-700">
            {error || "Could not retrieve user credentials from server."}
          </p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => router.refresh()}
              className="border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  }

  // 4. Role authorization check
  if (!ALLOWED_ROLES.has(profile.role)) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-md border border-amber-200 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            Access Restricted
          </p>
          <h1 className="mt-1 text-lg font-semibold text-gray-950">
            Staff Authorization Required
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            This workspace is restricted to Order Desk staff and Distributor Administrators.
          </p>
          <div className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
            <p>Signed in as: <span className="font-medium text-gray-800">{profile.email}</span></p>
            <p className="mt-1">Current role: <span className="font-medium text-gray-800">{profile.role}</span></p>
          </div>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => logout()}
              className="bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Sign out and switch account
            </button>
          </div>
        </div>
      </main>
    );
  }

  // 5. Authorized Order Desk Dashboard
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Orderly Operations
            </p>
            <h1 className="text-xl font-semibold text-gray-950">
              Order Desk
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs font-medium text-gray-900">{profile.email}</p>
              <p className="text-xs text-gray-500">Role: {profile.role}</p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Workspace
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-gray-950">
            Order Review and Approval
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            Inspect newly submitted retailer orders, revalidate pricing and inventory stock,
            and approve or reject orders for dispatch.
          </p>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group border border-gray-200 bg-white p-5 transition-colors hover:border-gray-400"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-950">{item.label}</h3>
                <span className="border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {item.badge}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-500 leading-normal">
                {item.description}
              </p>
              <p className="mt-6 text-sm font-medium text-gray-900 group-hover:underline">
                Open queue &rarr;
              </p>
            </Link>
          ))}

          <div className="border border-gray-200 bg-white p-5">
            <h3 className="font-semibold text-gray-950">Operational Policy</h3>
            <p className="mt-2 text-sm text-gray-500 leading-normal">
              Inventory reservations and credit deductions occur transactionally upon order approval.
              Prices must match active distributor or retailer rates.
            </p>
            <p className="mt-6 text-xs text-gray-400">
              System Policy: Order Desk v1.0
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
