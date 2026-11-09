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
  Sparkles,
  Mic,
  Camera,
  Check,
  ChevronRight,
  TrendingUp,
  BarChart3,
  Clock,
  ArrowUpRight,
  PhoneCall,
  Layers,
  Boxes,
  FileText,
  Smartphone,
  Zap,
  Award,
  HelpCircle,
  ChevronDown,
  Database,
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
  const [activeTab, setActiveTab] = useState<"ai" | "desk" | "sales" | "tally">("ai");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

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

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#242724] flex flex-col justify-between selection:bg-[#79565D] selection:text-white">
      {/* 1. TOP ANNOUNCEMENT TICKER */}
      <div className="bg-[#242724] text-[#E7E6E0] text-[11px] font-medium py-2 px-4 text-center border-b border-black/10">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#79565D] text-white text-[10px] font-bold tracking-wide uppercase">
            Live Depot OS
          </span>
          <span>
            Digitizing 1,800+ Kirana Stores across Jabalpur & Mahakoshal FMCG Hub.
          </span>
          <span className="hidden sm:inline text-white/40">|</span>
          <Link
            href="/retailer/assistant"
            className="text-white underline underline-offset-2 hover:text-[#D5D3CB] inline-flex items-center gap-1 font-semibold"
          >
            Try AI Voice & Parchi Scan <ArrowRight size={11} />
          </Link>
        </div>
      </div>

      {/* 2. STICKY MODERN HEADER */}
      <header className="sticky top-0 z-40 border-b border-[#E7E6E0] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Logo & Depot Status */}
          <Link href="/" className="flex items-center gap-3 group">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#242724] text-white shadow-sm transition-transform group-hover:scale-105">
              <Store size={17} />
            </span>
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black tracking-tight text-[#242724]">
                  orderly<span className="text-[#79565D]">.</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#79565D] bg-[#F4EFF0] px-1.5 py-0.5 rounded">
                  B2B
                </span>
              </div>
              <span className="hidden sm:block text-[10px] font-medium text-[#7A7C77]">
                Distributor FMCG Operating System
              </span>
            </div>
          </Link>

          {/* Quick Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-[#575955]">
            <a href="#services" className="hover:text-[#242724] transition">
              Services
            </a>
            <a href="#ai-demo" className="hover:text-[#242724] transition">
              AI Voice & Parchi
            </a>
            <a href="#portals" className="hover:text-[#242724] transition">
              Role Portals
            </a>
            <a href="#comparison" className="hover:text-[#242724] transition">
              Why Orderly
            </a>
            <a href="#faq" className="hover:text-[#242724] transition">
              FAQ
            </a>
          </nav>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/register"
              className="hidden sm:inline-flex rounded-lg border border-[#E7E6E0] bg-white px-3.5 py-2 text-xs font-bold text-[#242724] shadow-xs hover:bg-[#F6F5F1] transition"
            >
              Sign In
            </Link>
            <Link
              href="/retailer/catalogue"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#79565D] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#67474E] transition active:scale-95"
            >
              <span>Explore Platform</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </header>

      {/* 3. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 border-b border-[#E7E6E0] bg-gradient-to-b from-white via-[#FAF9F6] to-[#F4F3EE]">
        {/* Subtle grid background pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#E7E6E015_1px,transparent_1px),linear-gradient(to_bottom,#E7E6E015_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center">
            {/* Live innovation badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#DCD9D0] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#50524E] shadow-xs mb-6">
              <span className="flex h-2 w-2 rounded-full bg-[#16A34A] animate-pulse" />
              <span>Next-Gen FMCG Distribution OS</span>
              <span className="text-[#969892]">·</span>
              <span className="text-[#79565D] font-bold">Hinglish AI Voice & Parchi OCR</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-[#1E201E] leading-[1.1] sm:leading-[1.12]">
              Powering Modern Wholesale Commerce for FMCG Distributors & Kiranas
            </h1>

            {/* Subtitle / Value Prop */}
            <p className="mt-5 text-base sm:text-lg text-[#555853] leading-relaxed max-w-2xl mx-auto">
              Eliminate order bottlenecks. Orderly connects Kirana shopkeepers, field salesmen, and warehouse dispatch desks into one unified engine with zero-hallucination AI ordering, real-time credit khata, van loading manifests, and instant Tally Prime sync.
            </p>

            {/* Hero CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link
                href="/retailer/assistant"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[#242724] px-6 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#343734] transition active:scale-95"
              >
                <Sparkles size={16} className="text-[#FFD166]" />
                <span>Try AI Ordering Demo</span>
              </Link>

              <Link
                href="/distributor"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-[#D5D3CB] bg-white px-6 py-3.5 text-sm font-bold text-[#242724] shadow-xs hover:bg-[#F2F1EC] transition"
              >
                <Building2 size={16} className="text-[#79565D]" />
                <span>Distributor Admin Console</span>
              </Link>
            </div>

            {/* Secondary assurance pill */}
            <div className="mt-6 flex items-center justify-center gap-6 text-xs font-medium text-[#7A7C77]">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-[#16A34A]" /> Zero setup fees
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-[#16A34A]" /> Paisa-accurate case math
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-[#16A34A]" /> Instant Tally export
              </span>
            </div>
          </div>

          {/* 4. INTERACTIVE SIMULATOR / VISUAL SHOWCASE */}
          <div id="ai-demo" className="mt-14 max-w-5xl mx-auto rounded-2xl border border-[#DCD9D0] bg-white shadow-xl overflow-hidden">
            {/* Interactive Tab Switcher */}
            <div className="border-b border-[#E7E6E0] bg-[#F7F6F2] px-4 py-3 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => setActiveTab("ai")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === "ai"
                      ? "bg-white text-[#242724] shadow-xs border border-[#E7E6E0]"
                      : "text-[#6C6E69] hover:text-[#242724]"
                  }`}
                >
                  <Sparkles size={13} className="text-[#79565D]" />
                  <span>AI Voice & Parchi OCR</span>
                </button>

                <button
                  onClick={() => setActiveTab("desk")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === "desk"
                      ? "bg-white text-[#242724] shadow-xs border border-[#E7E6E0]"
                      : "text-[#6C6E69] hover:text-[#242724]"
                  }`}
                >
                  <Inbox size={13} className="text-[#205234]" />
                  <span>Order Desk & Van Loading</span>
                </button>

                <button
                  onClick={() => setActiveTab("sales")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === "sales"
                      ? "bg-white text-[#242724] shadow-xs border border-[#E7E6E0]"
                      : "text-[#6C6E69] hover:text-[#242724]"
                  }`}
                >
                  <Users size={13} className="text-[#7A4E12]" />
                  <span>Salesman Beat App</span>
                </button>

                <button
                  onClick={() => setActiveTab("tally")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === "tally"
                      ? "bg-white text-[#242724] shadow-xs border border-[#E7E6E0]"
                      : "text-[#6C6E69] hover:text-[#242724]"
                  }`}
                >
                  <FileSpreadsheet size={13} className="text-[#1E4B72]" />
                  <span>Tally & Khata Ledger</span>
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold text-[#7A7C77]">
                <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
                <span>Simulated Depot Environment</span>
              </div>
            </div>

            {/* Tab 1: AI Assistant Screen */}
            {activeTab === "ai" && (
              <div className="p-6 sm:p-8 bg-gradient-to-b from-white to-[#FAF9F6]">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-5 space-y-4">
                    <Badge variant="accent" className="text-[10px] uppercase font-bold tracking-wider">
                      Zero Hallucination Architecture
                    </Badge>
                    <h3 className="text-xl sm:text-2xl font-black text-[#1E201E]">
                      Speak in Hindi or Snap a Handwritten Kirana Slip
                    </h3>
                    <p className="text-xs sm:text-sm text-[#5B5D58] leading-relaxed">
                      Shopkeepers don't type lengthy SKUs. They speak in Hindi/Hinglish (e.g. <em>&quot;50 packet sunflower oil aur 10 case chai chahiye&quot;</em>) or upload a photo of their physical notebook slip.
                    </p>
                    <ul className="space-y-2 text-xs font-semibold text-[#3C3E3A]">
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-[#16A34A]" />
                        <span>Acoustic Echo Filter prevents speaker feedback loops</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-[#16A34A]" />
                        <span>Deterministic Postgres candidate ranking (never LLM guesses)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-[#16A34A]" />
                        <span>Gemini Vision OCR validates genuine Kirana parchi</span>
                      </li>
                    </ul>
                    <div className="pt-2">
                      <Link
                        href="/retailer/assistant"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#79565D] hover:underline"
                      >
                        <span>Open Retailer Voice Assistant</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>

                  <div className="md:col-span-7 bg-[#242724] rounded-xl p-5 text-white shadow-inner font-mono text-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#79565D] text-white">
                          <Mic size={12} />
                        </span>
                        <span className="font-bold text-[11px] text-[#E7E6E0]">Orderly Voice & Vision Core</span>
                      </div>
                      <span className="text-[10px] text-[#A0A29D]">Hybrid Semantic Matcher · Active</span>
                    </div>

                    {/* Chat Simulation */}
                    <div className="space-y-2 text-[11px]">
                      <div className="bg-white/10 rounded-lg p-2.5 max-w-[85%]">
                        <span className="text-[#FFD166] font-bold block mb-0.5">Kirana Merchant (Voice Note):</span>
                        &quot;Bhaiya 50 packet DailyDrop Sunflower Oil aur 2 case Assam Tea jod do.&quot;
                      </div>

                      <div className="bg-[#79565D]/30 border border-[#79565D]/50 rounded-lg p-2.5 max-w-[90%] ml-auto text-right">
                        <span className="text-[#A2E2BC] font-bold block mb-0.5">Orderly AI Assistant:</span>
                        ✅ 2 SKUs matched with 100% confidence. Added ₹6,840 to draft cart.
                      </div>

                      {/* Matched Items Card */}
                      <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2 font-sans">
                        <div className="flex items-center justify-between text-white text-xs font-bold">
                          <span>DailyDrop Refined Sunflower Oil (1L)</span>
                          <span className="text-[#A2E2BC]">50 Packets · ₹7,500</span>
                        </div>
                        <div className="flex items-center justify-between text-[#BDBBB3] text-[11px]">
                          <span>DailyDrop Assam Tea (250g · 40 pcs/case)</span>
                          <span className="text-[#A2E2BC]">2 Cases (80 pcs) · ₹9,440</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Order Desk Screen */}
            {activeTab === "desk" && (
              <div className="p-6 sm:p-8 bg-gradient-to-b from-white to-[#FAF9F6]">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-5 space-y-4">
                    <Badge variant="success" className="text-[10px] uppercase font-bold tracking-wider">
                      Warehouse Logistics Engine
                    </Badge>
                    <h3 className="text-xl sm:text-2xl font-black text-[#1E201E]">
                      Order Desk Terminal & Automated Van Loading
                    </h3>
                    <p className="text-xs sm:text-sm text-[#5B5D58] leading-relaxed">
                      Distributor operators review live incoming orders, verify kirana credit limits, lock inventory, and auto-generate route-wise vehicle loading sheets for delivery drivers.
                    </p>
                    <ul className="space-y-2 text-xs font-semibold text-[#3C3E3A]">
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-[#16A34A]" />
                        <span>Automatic Case & Weight Consolidation for loading vans</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-[#16A34A]" />
                        <span>Instant Stock Allocation without double-booking</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-[#16A34A]" />
                        <span>Dormant retailer alert detection (&gt;14 days without reorder)</span>
                      </li>
                    </ul>
                    <div className="pt-2">
                      <Link
                        href="/order-desk"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#205234] hover:underline"
                      >
                        <span>Open Order Desk Workstation</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>

                  <div className="md:col-span-7 bg-[#FAF9F6] border border-[#E7E6E0] rounded-xl p-5 shadow-sm space-y-3 font-sans">
                    <div className="flex items-center justify-between border-b border-[#E7E6E0] pb-2.5">
                      <div className="flex items-center gap-2">
                        <Truck size={16} className="text-[#205234]" />
                        <span className="font-bold text-xs text-[#242724]">Van Loading Manifest · Jabalpur North Route</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase bg-[#EEF6F1] text-[#205234] px-2 py-0.5 rounded">
                        Driver: Raju Sharma (MP-20-G-1422)
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between bg-white border border-[#E7E6E0] p-2.5 rounded-lg">
                        <div>
                          <span className="font-bold text-[#242724] block">Shree Ganesh Stores (Lordganj)</span>
                          <span className="text-[11px] text-[#7A7C77]">3 Cases Oil, 1 Case Tea · ₹14,200</span>
                        </div>
                        <span className="text-[10px] font-bold text-[#16A34A] bg-[#EEF6F1] px-2 py-1 rounded">
                          APPROVED & LOADED
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-white border border-[#E7E6E0] p-2.5 rounded-lg">
                        <div>
                          <span className="font-bold text-[#242724] block">Gupta Super Kirana (Gorakhpur)</span>
                          <span className="text-[11px] text-[#7A7C77]">5 Cases Sugar, 2 Cases Soap · ₹18,900</span>
                        </div>
                        <span className="text-[10px] font-bold text-[#16A34A] bg-[#EEF6F1] px-2 py-1 rounded">
                          APPROVED & LOADED
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Salesman Beat Screen */}
            {activeTab === "sales" && (
              <div className="p-6 sm:p-8 bg-gradient-to-b from-white to-[#FAF9F6]">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-5 space-y-4">
                    <Badge variant="warning" className="text-[10px] uppercase font-bold tracking-wider">
                      Field Force Enablement
                    </Badge>
                    <h3 className="text-xl sm:text-2xl font-black text-[#1E201E]">
                      Field Salesman Beat & Counter Ordering App
                    </h3>
                    <p className="text-xs sm:text-sm text-[#5B5D58] leading-relaxed">
                      Salesmen visit 30+ kirana stores daily. The Orderly Salesman App provides instant beat lists, offline-first ordering, voice-order intake, and live target achievement tracking.
                    </p>
                    <ul className="space-y-2 text-xs font-semibold text-[#3C3E3A]">
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-[#16A34A]" />
                        <span>Daily Beat Routing by Market (Lordganj, Wright Town, Gorakhpur)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-[#16A34A]" />
                        <span>Book orders on behalf of kirana with customer credit validation</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-[#16A34A]" />
                        <span>Voice & Photo note scanning on the road</span>
                      </li>
                    </ul>
                    <div className="pt-2">
                      <Link
                        href="/salesman"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7A4E12] hover:underline"
                      >
                        <span>Open Field Salesman Portal</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>

                  <div className="md:col-span-7 bg-[#FCF6EC]/50 border border-[#F0DFCA] rounded-xl p-5 shadow-sm space-y-3 font-sans">
                    <div className="flex items-center justify-between border-b border-[#F0DFCA] pb-2.5">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-[#7A4E12]" />
                        <span className="font-bold text-xs text-[#242724]">Today&apos;s Beat: Gorakhpur Route (Tuesday)</span>
                      </div>
                      <span className="text-[10px] font-bold bg-[#FCF6EC] text-[#7A4E12] border border-[#F0DFCA] px-2 py-0.5 rounded">
                        18 / 24 Stores Visited
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="bg-white border border-[#E7E6E0] p-3 rounded-lg flex items-center justify-between">
                        <div>
                          <span className="font-bold text-[#242724] block">Radha Krishna Stores</span>
                          <span className="text-[11px] text-[#7A7C77]">Available Credit: ₹45,000 · Terms: 14 Days</span>
                        </div>
                        <span className="text-[10px] font-bold text-[#16A34A] bg-[#EEF6F1] px-2 py-1 rounded">
                          Order Booked (₹8,450)
                        </span>
                      </div>

                      <div className="bg-white border border-[#E7E6E0] p-3 rounded-lg flex items-center justify-between">
                        <div>
                          <span className="font-bold text-[#242724] block">Kalyan Provision Stores</span>
                          <span className="text-[11px] text-[#7A7C77]">Available Credit: ₹22,000 · Terms: 7 Days</span>
                        </div>
                        <span className="text-[10px] font-bold text-[#1E4B72] bg-[#EFF5FB] px-2 py-1 rounded">
                          In Progress
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Tally Screen */}
            {activeTab === "tally" && (
              <div className="p-6 sm:p-8 bg-gradient-to-b from-white to-[#FAF9F6]">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-5 space-y-4">
                    <Badge variant="info" className="text-[10px] uppercase font-bold tracking-wider">
                      Accounting & ERP Sync
                    </Badge>
                    <h3 className="text-xl sm:text-2xl font-black text-[#1E201E]">
                      One-Click Tally Prime & ERP 9 Export
                    </h3>
                    <p className="text-xs sm:text-sm text-[#5B5D58] leading-relaxed">
                      Zero manual voucher typing. Approved orders and dispatch batches export seamlessly into Tally-compliant Sales Voucher formats, matching HSN codes, GST slabs, and buyer ledgers.
                    </p>
                    <ul className="space-y-2 text-xs font-semibold text-[#3C3E3A]">
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-[#16A34A]" />
                        <span>Direct CSV & XML export formatted for Tally Sales Register</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-[#16A34A]" />
                        <span>Automated CGST/SGST ledger splits and discounts</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={14} className="text-[#16A34A]" />
                        <span>Live Khata outstanding ledger tracking per retailer</span>
                      </li>
                    </ul>
                    <div className="pt-2">
                      <Link
                        href="/distributor/tally-export"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E4B72] hover:underline"
                      >
                        <span>Open Tally Export Console</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>

                  <div className="md:col-span-7 bg-[#EFF5FB]/50 border border-[#D0E2F0] rounded-xl p-5 shadow-sm space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-[#D0E2F0] pb-2.5">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet size={16} className="text-[#1E4B72]" />
                        <span className="font-bold text-[#242724]">Tally Prime Sales Voucher Batch #2026-03</span>
                      </div>
                      <span className="text-[10px] font-bold text-[#1E4B72] bg-[#EFF5FB] px-2 py-0.5 rounded">
                        38 Orders Reconciled
                      </span>
                    </div>

                    <div className="bg-white border border-[#D0E2F0] rounded-lg p-3 space-y-1.5 text-[11px] text-[#474945]">
                      <div className="text-[#1E4B72] font-bold">VOUCHER_TYPE: &quot;Sales&quot; | GUID: ORD-2026-0814</div>
                      <div>PARTY_LEDGER: &quot;Aggarwal Provision (RET-004)&quot;</div>
                      <div>ITEM: &quot;DailyDrop Sunflower Oil 1L&quot; | QTY: 50 | RATE: ₹150.00</div>
                      <div>TAX: CGST 2.5% (₹187.50) + SGST 2.5% (₹187.50)</div>
                      <div className="text-[#16A34A] font-bold pt-1 border-t border-[#F0EFEA]">
                        STATUS: READY FOR TALLY IMPORT · 0 ERRORS
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5. TRUST & SCALE METRICS BAR */}
      <section className="border-b border-[#E7E6E0] bg-white py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 text-center">
            <div className="space-y-1 border-r border-[#E7E6E0] last:border-r-0">
              <div className="text-3xl sm:text-4xl font-black text-[#242724] tracking-tight">
                1,800+
              </div>
              <div className="text-xs font-semibold text-[#7A7C77] uppercase tracking-wider">
                Kirana Retailers
              </div>
            </div>

            <div className="space-y-1 border-r border-[#E7E6E0] last:border-r-0">
              <div className="text-3xl sm:text-4xl font-black text-[#242724] tracking-tight">
                ₹4.8 Cr+
              </div>
              <div className="text-xs font-semibold text-[#7A7C77] uppercase tracking-wider">
                Monthly GMV Routed
              </div>
            </div>

            <div className="space-y-1 border-r border-[#E7E6E0] last:border-r-0">
              <div className="text-3xl sm:text-4xl font-black text-[#242724] tracking-tight">
                99.8%
              </div>
              <div className="text-xs font-semibold text-[#7A7C77] uppercase tracking-wider">
                FMCG SKU Match Accuracy
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black text-[#242724] tracking-tight">
                &lt; 3 Min
              </div>
              <div className="text-xs font-semibold text-[#7A7C77] uppercase tracking-wider">
                Order-To-Dispatch Time
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. WHAT SERVICES ORDERLY PROVIDES (CORE VALUE PILLARS) */}
      <section id="services" className="py-16 sm:py-24 bg-[#FAF9F6] border-b border-[#E7E6E0]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="accent" className="mb-3 text-[11px] font-bold tracking-wider uppercase">
              End-To-End B2B Capabilities
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-[#1E201E] tracking-tight">
              Everything Your FMCG Distribution Network Needs to Scale
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#5B5D58] leading-relaxed">
              From the rural kirana shop to the distributor’s central warehouse, Orderly replaces scattered paper chits and chaotic WhatsApp messages with structured automation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Service 1 */}
            <div className="rounded-xl border border-[#E7E6E0] bg-white p-6 shadow-xs hover:border-[#79565D] transition-all group flex flex-col justify-between">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#F4EFF0] text-[#79565D] mb-4 group-hover:scale-105 transition-transform">
                  <Sparkles size={20} />
                </div>
                <h3 className="text-base font-bold text-[#1E201E]">
                  AI Voice & Handwritten Slip OCR
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[#5B5D58] leading-relaxed">
                  Kiranas can dictate in Hindi or snap a photo of their scribbled order slip. Our vision and audio AI normalizes regional packaging units and maps them straight to active inventory.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#F0EFEA] text-[11px] font-bold text-[#79565D] flex items-center justify-between">
                <span>Multilingual & Vision AI</span>
                <ArrowRight size={13} />
              </div>
            </div>

            {/* Service 2 */}
            <div className="rounded-xl border border-[#E7E6E0] bg-white p-6 shadow-xs hover:border-[#79565D] transition-all group flex flex-col justify-between">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#EEF6F1] text-[#205234] mb-4 group-hover:scale-105 transition-transform">
                  <Boxes size={20} />
                </div>
                <h3 className="text-base font-bold text-[#1E201E]">
                  Paisa-Accurate Case Math
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[#5B5D58] leading-relaxed">
                  Calculate wholesale pricing dynamically via units-per-case packaging. Handles trade schemes (10+1 free, 5% cash discount) and tax breakdowns automatically down to the paisa.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#F0EFEA] text-[11px] font-bold text-[#205234] flex items-center justify-between">
                <span>Wholesale Arithmetic</span>
                <ArrowRight size={13} />
              </div>
            </div>

            {/* Service 3 */}
            <div className="rounded-xl border border-[#E7E6E0] bg-white p-6 shadow-xs hover:border-[#79565D] transition-all group flex flex-col justify-between">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#EFF5FB] text-[#1E4B72] mb-4 group-hover:scale-105 transition-transform">
                  <Truck size={20} />
                </div>
                <h3 className="text-base font-bold text-[#1E201E]">
                  Van Loading & Route Sheets
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[#5B5D58] leading-relaxed">
                  Consolidate approved orders by driver and delivery sector. Generate ready-to-load vehicle manifests with aggregated case counts and physical order check-offs.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#F0EFEA] text-[11px] font-bold text-[#1E4B72] flex items-center justify-between">
                <span>Dispatch Logistics</span>
                <ArrowRight size={13} />
              </div>
            </div>

            {/* Service 4 */}
            <div className="rounded-xl border border-[#E7E6E0] bg-white p-6 shadow-xs hover:border-[#79565D] transition-all group flex flex-col justify-between">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#FCF6EC] text-[#7A4E12] mb-4 group-hover:scale-105 transition-transform">
                  <Smartphone size={20} />
                </div>
                <h3 className="text-base font-bold text-[#1E201E]">
                  Salesman Beat Automation
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[#5B5D58] leading-relaxed">
                  Empower field reps with beat lists, GPS visit logs, customer credit balances, and offline order capture so work never stops in low-connectivity market alleys.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#F0EFEA] text-[11px] font-bold text-[#7A4E12] flex items-center justify-between">
                <span>Field Rep Mobility</span>
                <ArrowRight size={13} />
              </div>
            </div>

            {/* Service 5 */}
            <div className="rounded-xl border border-[#E7E6E0] bg-white p-6 shadow-xs hover:border-[#79565D] transition-all group flex flex-col justify-between">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#F4EFF0] text-[#79565D] mb-4 group-hover:scale-105 transition-transform">
                  <Wallet size={20} />
                </div>
                <h3 className="text-base font-bold text-[#1E201E]">
                  Automated Khata & Credit Caps
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[#5B5D58] leading-relaxed">
                  Safeguard working capital. Enforce credit limits per merchant, track aging payment ledgers, and prevent unapproved dispatches to overdue accounts.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#F0EFEA] text-[11px] font-bold text-[#79565D] flex items-center justify-between">
                <span>Credit Governance</span>
                <ArrowRight size={13} />
              </div>
            </div>

            {/* Service 6 */}
            <div className="rounded-xl border border-[#E7E6E0] bg-white p-6 shadow-xs hover:border-[#79565D] transition-all group flex flex-col justify-between">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#EEF6F1] text-[#205234] mb-4 group-hover:scale-105 transition-transform">
                  <FileSpreadsheet size={20} />
                </div>
                <h3 className="text-base font-bold text-[#1E201E]">
                  1-Click Tally Prime Sync
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[#5B5D58] leading-relaxed">
                  Export ready-to-import Tally CSV and XML batches. Eliminates duplicate data entry for accountants, ensuring ledger parity between warehouse and books.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#F0EFEA] text-[11px] font-bold text-[#205234] flex items-center justify-between">
                <span>Tally ERP Compatible</span>
                <ArrowRight size={13} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. THE 4 ROLE PORTALS (WHO ORDERLY IS BUILT FOR) */}
      <section id="portals" className="py-16 sm:py-24 bg-white border-b border-[#E7E6E0]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="accent" className="mb-3 text-[11px] font-bold tracking-wider uppercase">
              Role-Based Workspaces
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-[#1E201E] tracking-tight">
              Tailored Workspaces for Every FMCG Stakeholder
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#5B5D58] leading-relaxed">
              Orderly equips each member of your distribution chain with a purpose-built workspace engineered for their daily workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* 1. Kirana Merchant */}
            <Link
              href="/retailer/catalogue"
              className="group rounded-xl border border-[#E7E6E0] bg-[#FAF9F6] p-5 shadow-xs hover:border-[#79565D] hover:bg-white transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F4EFF0] text-[#79565D]">
                    <Store size={19} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-[#F4EFF0] text-[#79565D] px-2 py-0.5 rounded">
                    Retailer
                  </span>
                </div>
                <h3 className="font-bold text-base text-[#1E201E]">
                  Kirana Retailer App
                </h3>
                <p className="mt-2 text-xs text-[#5B5D58] leading-relaxed">
                  Mobile-first shop portal. Multilingual AI voice ordering, handwritten parchi scan, live wholesale prices, and ledger khata.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-[#E7E6E0] flex items-center justify-between text-xs font-bold text-[#79565D]">
                <span>Shop Catalogue</span>
                <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* 2. Field Salesman */}
            <Link
              href="/salesman"
              className="group rounded-xl border border-[#E7E6E0] bg-[#FAF9F6] p-5 shadow-xs hover:border-[#7A4E12] hover:bg-white transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FCF6EC] text-[#7A4E12]">
                    <Users size={19} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-[#FCF6EC] text-[#7A4E12] px-2 py-0.5 rounded">
                    Sales Force
                  </span>
                </div>
                <h3 className="font-bold text-base text-[#1E201E]">
                  Salesman Beat App
                </h3>
                <p className="mt-2 text-xs text-[#5B5D58] leading-relaxed">
                  Daily beat routes, store visit checks, on-behalf-of-kirana ordering, offline queue, and real-time sales performance.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-[#E7E6E0] flex items-center justify-between text-xs font-bold text-[#7A4E12]">
                <span>Field Beat Portal</span>
                <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* 3. Order Desk */}
            <Link
              href="/order-desk"
              className="group rounded-xl border border-[#E7E6E0] bg-[#FAF9F6] p-5 shadow-xs hover:border-[#205234] hover:bg-white transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EEF6F1] text-[#205234]">
                    <Inbox size={19} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-[#EEF6F1] text-[#205234] px-2 py-0.5 rounded">
                    Operations
                  </span>
                </div>
                <h3 className="font-bold text-base text-[#1E201E]">
                  Order Desk Terminal
                </h3>
                <p className="mt-2 text-xs text-[#5B5D58] leading-relaxed">
                  High-density order verification queue, stock availability reservations, credit compliance, and van loading sheets.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-[#E7E6E0] flex items-center justify-between text-xs font-bold text-[#205234]">
                <span>Order Desk Workstation</span>
                <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* 4. Distributor Admin */}
            <Link
              href="/distributor"
              className="group rounded-xl border border-[#E7E6E0] bg-[#FAF9F6] p-5 shadow-xs hover:border-[#1E4B72] hover:bg-white transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EFF5FB] text-[#1E4B72]">
                    <Building2 size={19} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-[#EFF5FB] text-[#1E4B72] px-2 py-0.5 rounded">
                    Admin & ERP
                  </span>
                </div>
                <h3 className="font-bold text-base text-[#1E201E]">
                  Distributor Console
                </h3>
                <p className="mt-2 text-xs text-[#5B5D58] leading-relaxed">
                  Full control: SKU catalog masters, Trade Schemes (Buy X Get Y), salesman staff invitations, and Tally Prime export.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-[#E7E6E0] flex items-center justify-between text-xs font-bold text-[#1E4B72]">
                <span>Management Console</span>
                <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* 8. COMPARISON (BEFORE VS ORDERLY) */}
      <section id="comparison" className="py-16 sm:py-24 bg-[#FAF9F6] border-b border-[#E7E6E0]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="accent" className="mb-3 text-[11px] font-bold tracking-wider uppercase">
              Proven Impact
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-[#1E201E] tracking-tight">
              Why Traditional FMCG Distribution Is Broken
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#5B5D58] leading-relaxed">
              Compare the friction of fragmented communication channels against the unified power of Orderly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Traditional Method */}
            <div className="rounded-2xl border border-red-200 bg-red-50/30 p-6 sm:p-8 space-y-4">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-700 bg-red-100 px-3 py-1 rounded-full">
                <span>The Traditional Way</span>
              </div>
              <h3 className="text-lg font-bold text-[#242724]">Scattered, Slow & Error-Prone</h3>
              <ul className="space-y-3 text-xs sm:text-sm text-[#5B5D58]">
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold">✕</span>
                  <span><strong>Chaotic WhatsApp Chats</strong>: Audio messages get lost, quantities get misheard, wrong products get delivered.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold">✕</span>
                  <span><strong>Paper Parchi Hassle</strong>: Handwritten scribbles take hours to decipher and punch manually into computers.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold">✕</span>
                  <span><strong>Blind Van Loading</strong>: Drivers load trucks without structured manifests, causing stock mismatches on the road.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold">✕</span>
                  <span><strong>Hours of Manual Tally Typing</strong>: Accountants re-type every line item into Tally daily, delaying financial closings.</span>
                </li>
              </ul>
            </div>

            {/* The Orderly Way */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-6 sm:p-8 space-y-4">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                <span>The Orderly Way</span>
              </div>
              <h3 className="text-lg font-bold text-[#242724]">Automated, Instant & Accurate</h3>
              <ul className="space-y-3 text-xs sm:text-sm text-[#3C3E3A]">
                <li className="flex items-start gap-2.5">
                  <Check size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                  <span><strong>Multilingual Voice & Vision AI</strong>: Instant SKU matching with zero hallucinations against live database stock.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                  <span><strong>Exact Case Mathematics</strong>: Automatic wholesale pricing, trade schemes, and discounts down to the paisa.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                  <span><strong>1-Click Van Loading Sheets</strong>: Driver manifests organized by route and kirana store sequence.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                  <span><strong>Direct Tally Prime Sync</strong>: Export sales vouchers in one click, keeping books and warehouse inventory 100% matched.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 9. FREQUENTLY ASKED QUESTIONS */}
      <section id="faq" className="py-16 sm:py-24 bg-white border-b border-[#E7E6E0]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <Badge variant="accent" className="mb-3 text-[11px] font-bold tracking-wider uppercase">
              Frequently Asked Questions
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-[#1E201E] tracking-tight">
              Got Questions? We&apos;ve Got Answers.
            </h2>
          </div>

          <div className="space-y-3">
            {[
              {
                q: "How does the AI Assistant avoid adding the wrong products or hallucinating?",
                a: "Unlike generic AI chatbots that guess answers, Orderly uses a strict Deterministic Hybrid Grounding Engine. The LLM only extracts entities (e.g. quantity, brand, pack size). The actual product matching is executed against your real PostgreSQL catalog with exact unit conversion (liters, kilograms, packets, cases) and stock checks. If an item is ambiguous, it asks for clarification instead of guessing.",
              },
              {
                q: "Can my field salesmen book orders when offline in poor network areas?",
                a: "Yes! The Orderly Field Salesman App features offline cart queuing. Reps can take orders at kirana counters without active connectivity; as soon as their phone detects signal, all pending orders sync automatically to the depot.",
              },
              {
                q: "How does Orderly connect with Tally ERP 9 / Tally Prime?",
                a: "Orderly includes a dedicated Tally export module. Once the Order Desk approves orders, you can download pre-formatted Tally XML or CSV batches mapped with your exact buyer ledger names, HSN codes, and tax rates. You can import them into Tally in seconds without manual entry.",
              },
              {
                q: "What brands and products are currently supported in the catalog?",
                a: "Orderly supports any FMCG brand. Our Jabalpur depot deployment is pre-seeded with leading staples, edible oils, beverages, soaps, and confectionery across DailyDrop, FreshFarm, HomeBright, and SweetBite.",
              },
              {
                q: "How does kirana credit limit enforcement work?",
                a: "Each kirana store has a sanctioned credit limit and payment terms (e.g., 7 or 14 days). When an order is placed, the system checks their current outstanding ledger. If the order exceeds their available credit, the Order Desk receives a credit alert to approve or hold before loading onto the delivery van.",
              },
            ].map((faq, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-[#E7E6E0] bg-[#FAF9F6] overflow-hidden transition"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 font-bold text-sm text-[#1E201E] hover:bg-white transition"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    size={16}
                    className={`text-[#7A7C77] transition-transform duration-200 shrink-0 ${
                      expandedFaq === idx ? "rotate-180 text-[#79565D]" : ""
                    }`}
                  />
                </button>
                {expandedFaq === idx && (
                  <div className="px-5 pb-4 pt-1 text-xs sm:text-sm text-[#5B5D58] leading-relaxed border-t border-[#E7E6E0] bg-white">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 10. HIGH-CONVERTING BOTTOM CTA */}
      <section className="bg-[#242724] text-white py-16 sm:py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#79565D25_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 text-center space-y-6">
          <Badge variant="accent" className="text-[11px] font-bold tracking-wider uppercase bg-[#79565D] text-white border-none">
            Get Started in 60 Seconds
          </Badge>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Ready to Digitize Your FMCG Distribution Network?
          </h2>

          <p className="text-sm sm:text-base text-[#D5D3CB] max-w-2xl mx-auto leading-relaxed">
            Join hundreds of forward-thinking FMCG distributors and kirana merchants who save hours every day with Orderly.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[#79565D] px-8 py-3.5 text-sm font-bold text-white shadow-lg hover:bg-[#67474E] transition active:scale-95"
            >
              <span>Create Retailer Account</span>
              <ArrowRight size={15} />
            </Link>

            <Link
              href="/retailer/catalogue"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-8 py-3.5 text-sm font-bold text-white hover:bg-white/20 transition"
            >
              <span>Browse FMCG Catalogue</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 11. FOOTER */}
      <footer className="border-t border-[#E7E6E0] bg-white py-10 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 text-xs text-[#5B5D58]">
            {/* Col 1 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-[#242724] text-white">
                  <Store size={13} />
                </span>
                <span className="font-black text-sm text-[#242724]">orderly.</span>
              </div>
              <p className="text-xs text-[#7A7C77] leading-relaxed">
                Enterprise B2B FMCG distribution platform for Indian supply chain networks. Connecting kirana counters to wholesale depots.
              </p>
              <div className="pt-1">
                <a
                  href="tel:+917612408890"
                  className="inline-flex items-center gap-1.5 font-bold text-[#242724] hover:text-[#79565D]"
                >
                  <PhoneCall size={12} />
                  <span>Support: +91 761 240 8890</span>
                </a>
              </div>
            </div>

            {/* Col 2 */}
            <div className="space-y-2">
              <span className="font-bold text-xs uppercase tracking-wider text-[#242724] block mb-1">
                Portals & Workspaces
              </span>
              <div className="flex flex-col space-y-1.5">
                <Link href="/retailer/catalogue" className="hover:text-[#79565D] transition">Kirana Catalogue</Link>
                <Link href="/retailer/assistant" className="hover:text-[#79565D] transition">AI Voice Ordering</Link>
                <Link href="/salesman" className="hover:text-[#79565D] transition">Salesman Beat App</Link>
                <Link href="/order-desk" className="hover:text-[#79565D] transition">Order Desk Workstation</Link>
                <Link href="/distributor" className="hover:text-[#79565D] transition">Distributor Administration</Link>
              </div>
            </div>

            {/* Col 3 */}
            <div className="space-y-2">
              <span className="font-bold text-xs uppercase tracking-wider text-[#242724] block mb-1">
                Capabilities
              </span>
              <div className="flex flex-col space-y-1.5">
                <a href="#ai-demo" className="hover:text-[#79565D] transition">Multilingual AI Voice Core</a>
                <a href="#ai-demo" className="hover:text-[#79565D] transition">Handwritten Parchi OCR</a>
                <Link href="/order-desk/van-loading" className="hover:text-[#79565D] transition">Van Loading Manifests</Link>
                <Link href="/distributor/tally-export" className="hover:text-[#79565D] transition">Tally Prime XML / CSV Export</Link>
                <Link href="/retailer/credit" className="hover:text-[#79565D] transition">Credit Khata Ledger</Link>
              </div>
            </div>

            {/* Col 4 */}
            <div className="space-y-2">
              <span className="font-bold text-xs uppercase tracking-wider text-[#242724] block mb-1">
                Regional Hub
              </span>
              <p className="text-[11px] text-[#7A7C77] leading-relaxed">
                Orderly Technologies Pvt. Ltd.<br />
                Jabalpur FMCG Distribution Terminal<br />
                Madhya Pradesh, India · 482002
              </p>
              <div className="pt-2 text-[10px] text-[#969892]">
                GST Compliant · Tally Prime Certified Interop
              </div>
            </div>
          </div>

          <div className="border-t border-[#E7E6E0] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#7A7C77]">
            <span>© 2026 Orderly Technologies Pvt. Ltd. All rights reserved.</span>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="hover:underline cursor-pointer">Privacy Policy</span>
              <span>·</span>
              <span className="hover:underline cursor-pointer">Terms of Service</span>
              <span>·</span>
              <span className="hover:underline cursor-pointer">Security Overview</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
