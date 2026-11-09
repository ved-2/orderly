"use client";

import Link from "next/link";
import {
  Store,
  ArrowLeft,
  Package,
  Inbox,
  Users,
  Home,
  PhoneCall,
  Search,
} from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F6F5F1] text-[#242724] flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-[#E7E6E0] bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#242724] text-white transition-colors group-hover:bg-[#79565D]">
              <Store size={15} />
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold tracking-tight text-[#242724]">
                orderly<span className="text-[#79565D]">.</span>
              </span>
              <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-wider text-[#969892] border-l border-[#E7E6E0] pl-2">
                B2B Distribution OS
              </span>
            </div>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#E7E6E0] bg-white px-3 py-1.5 text-xs font-semibold text-[#242724] hover:bg-[#F0EFEA] transition shadow-2xs"
          >
            <Home size={13} />
            <span>Home</span>
          </Link>
        </div>
      </header>

      {/* Main 404 Content */}
      <main className="mx-auto w-full max-w-xl px-4 py-16 text-center my-auto">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4EFF0] text-[#79565D] mb-5 shadow-xs">
          <Search size={32} />
        </div>

        <p className="font-mono text-sm font-bold uppercase tracking-widest text-[#79565D]">
          404 Error · Page Not Found
        </p>

        <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#242724]">
          Yeh Page Uplabdh Nahi Hai
        </h1>

        <p className="mt-3 text-xs sm:text-sm text-[#666864] leading-relaxed max-w-md mx-auto">
          The link you opened might be broken or the page has been moved. Choose one of the direct portals below:
        </p>

        {/* Portal Shortcuts */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          <Link
            href="/retailer/catalogue"
            className="group rounded-xl border border-[#E7E6E0] bg-white p-3.5 hover:border-[#79565D] hover:shadow-xs transition"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F4EFF0] text-[#79565D] mb-2 group-hover:scale-105 transition-transform">
              <Package size={16} />
            </div>
            <p className="text-xs font-bold text-[#242724]">Kirana Catalogue</p>
            <p className="text-[11px] text-[#666864] mt-0.5">Live stock & rates</p>
          </Link>

          <Link
            href="/order-desk"
            className="group rounded-xl border border-[#E7E6E0] bg-white p-3.5 hover:border-[#205234] hover:shadow-xs transition"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF6F1] text-[#205234] mb-2 group-hover:scale-105 transition-transform">
              <Inbox size={16} />
            </div>
            <p className="text-xs font-bold text-[#242724]">Order Desk</p>
            <p className="text-[11px] text-[#666864] mt-0.5">Queue triage & holds</p>
          </Link>

          <Link
            href="/salesman"
            className="group rounded-xl border border-[#E7E6E0] bg-white p-3.5 hover:border-[#7A4E12] hover:shadow-xs transition"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FCF6EC] text-[#7A4E12] mb-2 group-hover:scale-105 transition-transform">
              <Users size={16} />
            </div>
            <p className="text-xs font-bold text-[#242724]">Salesman Beat</p>
            <p className="text-[11px] text-[#666864] mt-0.5">Offline visits app</p>
          </Link>
        </div>

        {/* Action button */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-[#242724] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#3C3F3C] transition shadow-xs w-full sm:w-auto justify-center"
          >
            <ArrowLeft size={14} />
            <span>Return to Orderly Home</span>
          </Link>

          <a
            href="tel:+917612408890"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E7E6E0] bg-white px-4 py-2.5 text-xs font-semibold text-[#666864] hover:bg-[#FAF9F6] transition shadow-xs w-full sm:w-auto justify-center"
          >
            <PhoneCall size={13} />
            <span>Support: +91 761 240 8890</span>
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E7E6E0] bg-white py-4 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#969892]">
          <span>© {new Date().getFullYear()} Orderly Technologies Pvt. Ltd. · Jabalpur Operations</span>
          <span>Kirana B2B Wholesale Commerce</span>
        </div>
      </footer>
    </div>
  );
}
