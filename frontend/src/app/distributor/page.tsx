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
}

const ALLOWED_ROLES = new Set(["DISTRIBUTOR_ADMIN"]);

const adminModules = [
  {
    title: "Retailer Network & Credit",
    description:
      "Verify incoming kirana shop registrations, assign credit limits, and record payment collections.",
    href: "/distributor/retailers",
    badge: "Verification Queue",
    action: "Manage retailers &rarr;",
  },
  {
    title: "Order Desk Super-View",
    description:
      "Direct oversight of the Order Desk processing queue, order approvals, and stock allocations.",
    href: "/order-desk",
    badge: "Live Operations",
    action: "Open Order Desk &rarr;",
  },
  {
    title: "Master Catalogue & Schemes",
    description:
      "Manage SKU specifications, wholesale pricing, depot stock levels, and promotional Buy-X-Get-Y / slab schemes.",
    href: "/distributor/catalogue",
    badge: "Master Data",
    action: "Manage catalogue &rarr;",
  },
  {
    title: "Tally Accounting Export",
    description:
      "Generate and download Tally-compatible sales voucher CSV files for approved and dispatched orders.",
    href: "/distributor/tally-export",
    badge: "Accounting",
    action: "Export data &rarr;",
  },
  {
    title: "Staff & Salesmen",
    description:
      "Issue single-use invitations for Order Desk operators and field salesmen.",
    href: "/distributor/staff",
    badge: "Access Control",
    action: "Manage staff &rarr;",
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
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm text-gray-500">Authenticating administrator session...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-md border border-gray-200 bg-white p-6">
          <h1 className="text-lg font-semibold text-gray-950">
            Administrator Sign In Required
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Please sign in with your distributor administrator credentials to proceed.
          </p>
          <div className="mt-6">
            <Link
              href="/register"
              className="inline-block bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!profile || !ALLOWED_ROLES.has(profile.role)) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-md border border-amber-200 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            Access Restricted
          </p>
          <h1 className="mt-1 text-lg font-semibold text-gray-950">
            Distributor Administrator Privileges Required
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            This administration center is restricted to Distributor Administrators.
          </p>
          <div className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
            <p>Signed in as: <span className="font-medium text-gray-800">{profile.email}</span></p>
            <p className="mt-1">Current role: <span className="font-medium text-gray-800">{profile.role}</span></p>
          </div>
          <div className="mt-6 flex gap-3">
            <Link
              href="/order-desk"
              className="border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Go to Order Desk
            </Link>
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

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Orderly Platform
            </p>
            <h1 className="text-xl font-semibold text-gray-950">
              Distributor Administration Center
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs font-medium text-gray-900">{profile.email}</p>
              <span className="inline-block border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                Distributor Admin
              </span>
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
            Control Center
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-gray-950">
            Business Operations & Master Controls
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            Manage your network of kirana retailers, credit exposure, live order approvals,
            and accounting synchronization.
          </p>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {adminModules.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group border border-gray-200 bg-white p-6 transition-colors hover:border-gray-400"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-950">
                  {item.title}
                </h3>
                <span className="border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {item.badge}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-500 leading-normal">
                {item.description}
              </p>
              <p
                className="mt-6 text-sm font-medium text-gray-900 group-hover:underline"
                dangerouslySetInnerHTML={{ __html: item.action }}
              />
            </Link>
          ))}
        </section>

        {/* Distributor Operating Principles Card */}
        <section className="mt-8 border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Distributor Governance Notice
          </h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-3 text-xs text-gray-600 leading-relaxed">
            <div className="border-t border-gray-100 pt-3">
              <p className="font-semibold text-gray-900">Zero Public Role Grant</p>
              <p className="mt-1">
                Staff roles (Order Desk, Salesman) can never be self-selected. They must be issued via authenticated admin invitation.
              </p>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <p className="font-semibold text-gray-900">Credit Safeguards</p>
              <p className="mt-1">
                Newly registered kiranas start with ₹0 credit. Stock and credit are only committed upon explicit Order Desk approval.
              </p>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <p className="font-semibold text-gray-900">Tally Integration</p>
              <p className="mt-1">
                Orderly acts as the ordering intelligence layer. Dispatched orders are synchronized to Tally via structured batch CSV export.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
