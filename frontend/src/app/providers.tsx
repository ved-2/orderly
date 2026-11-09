"use client";

import { useEffect, type ReactNode } from "react";
import { AuthProvider } from "@/contexts/auth-context";

export default function Providers({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => console.log("Orderly PWA service worker registered"))
        .catch((err) => console.warn("Service worker registration failed:", err));
    }
  }, []);

  return <AuthProvider>{children}</AuthProvider>;
}
