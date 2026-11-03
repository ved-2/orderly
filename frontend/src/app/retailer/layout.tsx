"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Store,
  Wallet,
} from "lucide-react";

const navigation = [
  { label: "Overview", href: "/retailer/dashboard", icon: LayoutDashboard },
  { label: "Catalogue", href: "/retailer/catalogue", icon: Package },
  { label: "My Orders", href: "/retailer/orders", icon: ShoppingBag },
  { label: "Credit Account", href: "/retailer/credit", icon: Wallet },
];

export default function RetailerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();

  // The dashboard currently renders this same shell itself.
  if (pathname === "/retailer/dashboard") return children;

  return (
    <div className="min-h-screen w-full bg-[#f7f7f5] text-neutral-900">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
        <div className="flex h-14 w-full items-center px-4 sm:px-6">
          <Link href="/retailer/dashboard" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center bg-neutral-900 text-white">
              <Store size={17} />
            </span>
            <span className="text-lg font-bold tracking-tight">orderly</span>
          </Link>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-56px)] w-full">
        <aside className="hidden w-60 shrink-0 border-r border-neutral-200 bg-white p-4 md:block">
          <p className="mb-4 px-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
            Workspace
          </p>
          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;

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

        <main className="min-w-0 flex-1 pb-24 md:pb-0">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(0,0,0,0.06)] md:hidden">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

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
              <Icon size={16} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
