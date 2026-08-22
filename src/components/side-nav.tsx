"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, TrendingUp, LayoutGrid, HelpCircle, Zap, Receipt, BookOpen, BarChart3, Sliders, Shield, FileText, Calendar } from "lucide-react";

const navItems = [
  { href: "/", label: "Panoramica", icon: Home },
  { href: "/strategie", label: "Libreria Strategie", icon: LayoutGrid },
  { href: "/builder", label: "Strategy Builder", icon: TrendingUp },
  { href: "/come-funziona", label: "Come funziona A7", icon: HelpCircle },
  { href: "/segnali", label: "Segnali Live", icon: Zap },
  { href: "/paper-trades", label: "Paper Trades", icon: Receipt },
  { href: "/diario", label: "Diario Decisioni", icon: BookOpen },
  { href: "/performance", label: "Performance", icon: BarChart3 },
  { href: "/regole", label: "Regole & Parametri", icon: Sliders },
  { href: "/rischio", label: "Rischio & Esecuzione", icon: Shield },
  { href: "/report", label: "Report", icon: FileText },
  { href: "/agenda", label: "Agenda", icon: Calendar },
];

export function SideNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed left-0 top-0 h-screen w-64 bg-[#0a0a1a] border-r border-[#1e1e3a] overflow-y-auto z-50">
      <div className="p-4 border-b border-[#1e1e3a]">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            A7
          </div>
          <div>
            <div className="text-white font-bold text-lg">A7</div>
            <div className="text-[#94a3b8] text-xs">Trading System creato da Alessandro Lorettu</div>
          </div>
        </Link>
      </div>

      <div className="p-3 space-y-1 pb-20">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                  : "text-[#94a3b8] hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-[#1e1e3a]">
        <div className="text-xs text-[#94a3b8]">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>Paper Trading</span>
          </div>
          <div className="text-[#64748b]">v0.1.0</div>
        </div>
      </div>
    </nav>
  );
}