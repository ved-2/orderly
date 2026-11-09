"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Store,
  Inbox,
  Building2,
  Users,
  ShieldCheck,
  ArrowRight,
  Package,
  Wallet,
  Truck,
  CheckCircle2,
  FileSpreadsheet,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface UserProfile {
  role: string;
  retailer_id: string | null;
}

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [checkingRole, setCheckingRole] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (user) {
      setCheckingRole(true);
      apiRequest<UserProfile>("/auth/me")
        .then((profile) => {
          if (profile.role === "DISTRIBUTOR_ADMIN") {
            router.replace("/distributor");
          } else if (profile.role === "ORDER_DESK") {
            router.replace("/order-desk");
          } else if (profile.role === "SALESMAN") {
            router.replace("/salesman");
          } else if (profile.retailer_id) {
            router.replace("/retailer/dashboard");
          } else {
            router.replace("/register");
          }
        })
        .catch(() => {
          setCheckingRole(false);
        });
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-[#F6F5F1] text-[#242724] flex flex-col justify-between">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-[#E7E6E0] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3 group">
            <span className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#242724] text-white transition-colors group-hover:bg-[#79565D]">
              <Store size={15} />
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold tracking-tight text-[#242724]">
                orderly<span className="text-[#79565D]">.</span>
              </span>
              <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-wider text-[#969892] border-l border-[#E7E6E0] pl-2">
                Jabalpur FMCG Depot
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/register"
              className="rounded-[4px] bg-[#79565D] px-4 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-[#67474E] transition-colors"
            >
              Sign In / Register
            </Link>
          </div>
        </div>
      </header>

      {/* Main Hero & Role Portals */}
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-12 sm:py-16">
        {/* Hub Context Hero */}
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E7E6E0] bg-white px-3 py-1 text-[11px] font-semibold text-[#666864] shadow-2xs mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-[#205234]" />
            <span>Serving 1,800 Kirana Retailers across Jabalpur</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#242724] leading-tight">
            Distributor-Led FMCG Commerce Platform
          </h1>
          <p className="mt-3 text-xs sm:text-sm text-[#666864] leading-relaxed">
            Orderly bridges kirana shopkeepers directly with distributor warehouses. Wholesale case rates, guaranteed delivery, trade scheme multipliers, and Tally ERP sync.
          </p>
        </div>

        {/* 4 Core Roles Grid */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 1. Retailer Portal */}
          <Link
            href="/retailer/catalogue"
            className="group rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs hover:border-[#79565D] transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#F4EFF0] text-[#79565D]">
                  <Store size={18} />
                </div>
                <Badge variant="accent" className="text-[10px]">
                  Kirana Mobile-First
                </Badge>
              </div>
              <h2 className="mt-3.5 font-bold text-base text-[#242724]">
                Kirana Retailer Portal
              </h2>
              <p className="mt-1 text-xs text-[#666864] leading-relaxed">
                Wholesale catalogue across 4 FMCG brands, case-pricing calculations, live promotions (10+1 free), and 1-click repeat orders.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-[#F0EFEA] flex items-center justify-between text-xs font-semibold text-[#79565D]">
              <span>Shop Catalogue & Orders</span>
              <ArrowRight
                size={14}
                className="transition-transform group-hover:translate-x-1"
              />
            </div>
          </Link>

          {/* 2. Order Desk Workstation */}
          <Link
            href="/order-desk"
            className="group rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs hover:border-[#79565D] transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#EEF6F1] text-[#205234]">
                  <Inbox size={18} />
                </div>
                <Badge variant="success" className="text-[10px]">
                  Operational Terminal
                </Badge>
              </div>
              <h2 className="mt-3.5 font-bold text-base text-[#242724]">
                Order Desk Workstation
              </h2>
              <p className="mt-1 text-xs text-[#666864] leading-relaxed">
                High-density queue for verifying line items, checking kirana credit limits, locking warehouse inventory, and approving dispatches.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-[#F0EFEA] flex items-center justify-between text-xs font-semibold text-[#205234]">
              <span>Open Order Queue</span>
              <ArrowRight
                size={14}
                className="transition-transform group-hover:translate-x-1"
              />
            </div>
          </Link>

          {/* 3. Distributor Console */}
          <Link
            href="/distributor"
            className="group rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs hover:border-[#79565D] transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#EFF5FB] text-[#1E4B72]">
                  <Building2 size={18} />
                </div>
                <Badge variant="info" className="text-[10px]">
                  Admin & ERP
                </Badge>
              </div>
              <h2 className="mt-3.5 font-bold text-base text-[#242724]">
                Distributor Administration
              </h2>
              <p className="mt-1 text-xs text-[#666864] leading-relaxed">
                SKU master management, Buy-X-Get-Y trade schemes, kirana verification, credit sanctions, and Tally Prime accounting export.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-[#F0EFEA] flex items-center justify-between text-xs font-semibold text-[#1E4B72]">
              <span>Management Console</span>
              <ArrowRight
                size={14}
                className="transition-transform group-hover:translate-x-1"
              />
            </div>
          </Link>

          {/* 4. Salesman Beat App */}
          <Link
            href="/salesman"
            className="group rounded-[6px] border border-[#E7E6E0] bg-white p-5 shadow-2xs hover:border-[#79565D] transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#FCF6EC] text-[#7A4E12]">
                  <Users size={18} />
                </div>
                <Badge variant="warning" className="text-[10px]">
                  Beat App
                </Badge>
              </div>
              <h2 className="mt-3.5 font-bold text-base text-[#242724]">
                Field Salesman Beat Entry
              </h2>
              <p className="mt-1 text-xs text-[#666864] leading-relaxed">
                Route ordering for field representatives taking orders at kirana counters with live offline queueing and case rate calculations.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-[#F0EFEA] flex items-center justify-between text-xs font-semibold text-[#7A4E12]">
              <span>Field Beat Portal</span>
              <ArrowRight
                size={14}
                className="transition-transform group-hover:translate-x-1"
              />
            </div>
          </Link>
        </div>

        {/* Operating Pillars */}
        <div className="mt-12 rounded-[6px] border border-[#E7E6E0] bg-white p-6 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#969892] mb-3">
            <ShieldCheck size={16} className="text-[#79565D]" />
            <span>Depot Architecture</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 text-xs text-[#666864]">
            <div>
              <strong className="text-[#242724] block mb-0.5">Accurate Case Pricing</strong>
              Calculated dynamically via units-per-case packaging so wholesale arithmetic matches down to the paisa.
            </div>
            <div>
              <strong className="text-[#242724] block mb-0.5">Transactional Credit Controls</strong>
              Stock reservations and ledger balances are committed only upon explicit Order Desk review.
            </div>
            <div>
              <strong className="text-[#242724] block mb-0.5">Tally Accounting Interop</strong>
              Export approved orders directly formatted for seamless Tally ERP 9 and Tally Prime reconciliation.
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E7E6E0] bg-white py-6 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#666864]">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
            <span className="font-semibold text-[#242724]">
              © 2026 Orderly Commerce Engine
            </span>
            <span className="hidden sm:inline text-[#D5D3CB]">·</span>
            <span>Jabalpur Operations & B2B Depot OS</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-medium text-[#79565D]">
            <Link href="/retailer/catalogue" className="hover:underline">
              Kirana Catalogue
            </Link>
            <Link href="/order-desk" className="hover:underline">
              Order Desk
            </Link>
            <Link href="/salesman" className="hover:underline">
              Salesman Beat
            </Link>
            <Link href="/distributor" className="hover:underline">
              Distributor Portal
            </Link>
            <a href="tel:+917612408890" className="hover:underline text-[#242724] font-semibold">
              Helpline: +91 761 240 8890
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
