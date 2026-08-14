"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function AutoRefresh() {
  const pathname = usePathname();

  useEffect(() => {
    // Auto-refresh ogni 30 secondi su tutte le pagine tranne la home (che ha già il suo refresh)
    if (pathname === "/") return;
    const iv = setInterval(() => {
      window.location.reload();
    }, 30000);
    return () => clearInterval(iv);
  }, [pathname]);

  return null;
}