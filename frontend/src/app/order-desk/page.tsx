"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Inbox,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  Building2,
  Boxes,
  LogOut,
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

interface QueueStats {
  pendingCount: number;
  approvedToday: number;
}

const ALLOWED_ROLES = new Set(["ORDER_DESK", "DISTRIBUTOR_ADMIN"]);

export default function OrderDeskDashboard() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setProfileLoading(false);
      return;
    }

    let isMounted = true;

    async function loadData() {
      try {
        setProfileLoading(true);
        setError(null);
        const data = await apiRequest<UserProfile>("/auth/me");
        if (isMounted) {
          setProfile(data);
          // Fetch pending queue count
          if (ALLOWED_ROLES.has(data.role)) {
            apiRequest<{ total: number }>("/orders/desk/pending?limit=1&offset=0")
              .then((res) => {
                if (isMounted) setQueueCount(res.total);
              })
              .catch(() => {});
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load staff credentials."
          );
        }
      } finally {
        if (isMounted) setProfileLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [user, authLoading]);

  if (authLoading || profileLoading) {
    return (
      <main className="min-h-screen bg-[#F6F5F1] p-8">
        <div className="mx-auto max-w-6xl">
          <div className="h-8 w-48 animate-pulse rounded bg-[#E7E6E0]" />
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="h-32 animate-pulse rounded bg-[#E7E6E0]" />
            <div className="h-32 animate-pulse rounded bg-[#E7E6E0]" />
            <div className="h-32 animate-pulse rounded bg-[#E7E6E0]" />
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#F6F5F1] flex items-center justify-center p-4">
        <div className="mx-auto max-w-md w-full rounded-[6px] border border-[#E7E6E0] bg-white p-6 shadow-2xs text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F4EFF0] text-[#79565D]">
            <Building2 size={22} />
          </div>
          <h1 className="mt-4 text-base font-bold text-[#242724]">
            Order Desk Authentication
          </h1>
          <p className="mt-1 text-xs text-[#666864]">
            Staff credentials required to access the distributor order processing workstation.
          </p>
          <div className="mt-6">
            <Link
              href="/register"
              className="inline-block rounded-[4px] bg-[#79565D] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#67474E] transition-colors"
            >
              Sign In with Staff Account
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
          <h1 className="text-sm font-bold text-[#8C2828]">
            Authentication Failed
          </h1>
          <p className="mt-1 text-xs text-[#8C2828] opacity-80">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-[4px] bg-[#8C2828] px-4 py-2 text-xs font-semibold text-white"
          >
            Retry Connection
          </button>
        </div>
      </main>
    );
  }

  if (!ALLOWED_ROLES.has(profile.role)) {
    return (
      <main className="min-h-screen bg-[#F6F5F1] flex items-center justify-center p-4">
        <div className="mx-auto max-w-md w-full rounded-[6px] border border-[#EED7B3] bg-[#FCF6EC] p-6 text-center">
          <AlertTriangle size={24} className="mx-auto text-[#7A4E12]" />
          <h1 className="mt-3 text-sm font-bold text-[#7A4E12]">
            Order Desk Authorization Required
          </h1>
          <p className="mt-1 text-xs text-[#7A4E12] opacity-85">
            This operational terminal is restricted to ORDER_DESK or DISTRIBUTOR_ADMIN staff.
          </p>
          <div className="mt-4 border-t border-[#EED7B3] pt-3 text-[11px] text-[#7A4E12]">
            Signed in as: <strong>{profile.email}</strong> (Role: {profile.role})
          </div>
          <button
            onClick={() => logout()}
            className="mt-5 rounded-[4px] bg-[#242724] px-4 py-2 text-xs font-semibold text-white"
          >
            Sign out & Switch Account
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F6F5F1] text-[#242724]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-[#E7E6E0] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 h-14">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#242724] text-white">
              <Boxes size={15} />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-sm tracking-tight text-[#242724]">
                  orderly<span className="text-[#79565D]">.</span>desk
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#969892]">
                  Jabalpur Operations
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-[#242724]">{profile.email}</p>
              <p className="text-[10px] font-mono text-[#969892] uppercase">{profile.role}</p>
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

      {/* Main Workstation Shell */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        {/* Banner Section */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E7E6E0] pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-[#969892]">
                Terminal 01 · Jabalpur Hub
              </span>
              <span className="text-[#E7E6E0]">·</span>
              <Badge variant="success">Operational</Badge>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#242724]">
              Order Processing Workstation
            </h1>
            <p className="mt-0.5 text-xs text-[#666864]">
              Inspect retailer drafts, verify credit limits & inventory locks, and approve dispatches.
            </p>
          </div>

          <Link
            href="/order-desk/orders"
            className="inline-flex items-center gap-2 rounded-[4px] bg-[#79565D] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#67474E] transition-colors"
          >
            <Inbox size={14} />
            <span>Open Incoming Queue</span>
            {queueCount !== null && (
              <span className="ml-1 rounded-[3px] bg-white/20 px-1.5 py-0.2 font-mono text-[11px]">
                {queueCount}
              </span>
            )}
          </Link>
        </div>

        {/* Station Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between text-[#969892]">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Pending Verification
              </span>
              <Clock size={16} className="text-[#7A4E12]" />
            </div>
            <p className="mt-3 text-3xl font-bold font-mono text-[#242724] tabular-nums">
              {queueCount ?? "—"}
            </p>
            <p className="mt-1 text-[11px] text-[#666864]">
              Submitted kirana baskets waiting for approval
            </p>
          </div>

          <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between text-[#969892]">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Depot Inventory Sync
              </span>
              <ShieldCheck size={16} className="text-[#205234]" />
            </div>
            <p className="mt-3 text-sm font-bold text-[#242724]">
              Transactional Locks Active
            </p>
            <p className="mt-1 text-[11px] text-[#666864]">
              Units reserved automatically on approval to prevent stockouts
            </p>
          </div>

          <div className="rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between text-[#969892]">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Accounting Export
              </span>
              <FileSpreadsheet size={16} className="text-[#1E4B72]" />
            </div>
            <p className="mt-3 text-sm font-bold text-[#242724]">
              Tally XML / Prime Ready
            </p>
            <p className="mt-1 text-[11px] text-[#666864]">
              Approved vouchers format matched for daily ERP import
            </p>
          </div>
        </div>

        {/* Workstation Modules Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/order-desk/orders"
            className="group rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs hover:border-[#79565D] transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-[4px] bg-[#F4EFF0] text-[#79565D]">
                <Inbox size={20} />
              </div>
              <ArrowRight
                size={16}
                className="text-[#969892] group-hover:translate-x-1 group-hover:text-[#79565D] transition-all"
              />
            </div>
            <h2 className="mt-4 font-bold text-base text-[#242724]">
              Submitted Orders Queue
            </h2>
            <p className="mt-1 text-xs text-[#666864] leading-relaxed">
              Review line items, confirm wholesale case rates, inspect trade promotion schemes, and approve or place holds on orders.
            </p>
            <p className="mt-4 text-xs font-semibold text-[#79565D] group-hover:underline">
              Enter Order Queue &rarr;
            </p>
          </Link>

          {profile.role === "DISTRIBUTOR_ADMIN" && (
            <Link
              href="/distributor/tally-export"
              className="group rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs hover:border-[#79565D] transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-[4px] bg-[#EFF5FB] text-[#1E4B72]">
                  <FileSpreadsheet size={20} />
                </div>
                <ArrowRight
                  size={16}
                  className="text-[#969892] group-hover:translate-x-1 group-hover:text-[#1E4B72] transition-all"
                />
              </div>
              <h2 className="mt-4 font-bold text-base text-[#242724]">
                Tally Voucher Export
              </h2>
              <p className="mt-1 text-xs text-[#666864] leading-relaxed">
                Export approved sales vouchers and payment credits directly formatted for Tally ERP 9 / Tally Prime.
              </p>
              <p className="mt-4 text-xs font-semibold text-[#1E4B72] group-hover:underline">
                Open Export Utility &rarr;
              </p>
            </Link>
          )}

          <div className="rounded-[6px] border border-[#E7E6E0] bg-[#FAF9F6] p-5">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#969892]">
              Order Processing Checklist
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-[#666864]">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-[#205234]" />
                <span>Verify Kirana Credit Limit & Unpaid Invoices</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-[#205234]" />
                <span>Confirm Physical Case Stock at Jabalpur Depot</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-[#205234]" />
                <span>Auto-Apply 10+1 or Flat Cash Discounts</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-[#205234]" />
                <span>Print Pick-List and Dispatch Delivery Truck</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
