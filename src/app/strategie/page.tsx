"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Power, PowerOff } from "lucide-react";

interface StrategyData {
  id: number;
  name: string;
  status: string;
  category: string;
  source: string;
  sourceDescription: string;
  statusReason: string | null;
  isDemo: boolean;
}

export default function StrategiePage() {
  const [strategies, setStrategies] = useState<StrategyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<number | null>(null);

  const fetchStrategies = () => {
    setLoading(true);
    fetch("/api/strategies")
      .then(r => r.json())
      .then(setStrategies)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStrategies();
  }, []);

  const toggleStrategy = async (s: StrategyData) => {
    setToggling(s.id);
    const newStatus = s.status === "paper_active" ? "research" : "paper_active";
    try {
      const res = await fetch("/api/strategies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id, status: newStatus }),
      });
      const data = await res.json();
      if (data.ok) {
        setStrategies(prev => prev.map(p => p.id === s.id ? { ...p, status: newStatus } : p));
      }
    } catch {}
    setToggling(null);
  };

  if (loading) {
    return <div className="flex justify-center pt-20"><RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" /></div>;
  }

  // Raggruppa: paper_active in cima, poi research, poi il resto
  const ordered = [...strategies].sort((a, b) => {
    const order = ["paper_active", "research", "backtesting", "watch", "live_eligible", "rejected"];
    return order.indexOf(a.status) - order.indexOf(b.status);
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Libreria Strategie</h1>
        <p className="text-[#94a3b8] text-sm mt-1">
          {strategies.filter(s => s.status === "paper_active").length} attive · {strategies.length} totali
        </p>
      </div>

      <div className="grid gap-4">
        {ordered.map((s) => {
          const isActive = s.status === "paper_active";
          const statusColors: Record<string, string> = {
            research: "text-yellow-400 border-yellow-400/30",
            backtesting: "text-blue-400 border-blue-400/30",
            paper_active: "text-green-400 border-green-400/30",
            watch: "text-purple-400 border-purple-400/30",
            rejected: "text-red-400 border-red-400/30",
            live_eligible: "text-indigo-400 border-indigo-400/30",
          };
          const sourceLabels: Record<string, string> = {
            web_research: "Ricerca Web",
            builder: "Builder Manuale",
            tradingview_webhook: "Webhook TV",
          };

          return (
            <div key={s.id} className={`glass-card p-4 border-l-4 ${isActive ? "border-l-green-500/50" : "border-l-[#1e1e3a]"}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold truncate">{s.name}</h3>
                    {/* Toggle ON/OFF */}
                    <button
                      onClick={() => toggleStrategy(s)}
                      disabled={toggling === s.id}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? "bg-green-600/20 text-green-400 hover:bg-green-600/30"
                          : "bg-[#1e1e3a] text-[#64748b] hover:bg-[#2a2a4a] hover:text-white"
                      }`}
                      title={isActive ? "Disattiva strategia" : "Attiva strategia"}
                    >
                      {toggling === s.id ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : isActive ? (
                        <Power size={12} />
                      ) : (
                        <PowerOff size={12} />
                      )}
                      {isActive ? "ON" : "OFF"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded border ${statusColors[s.status] || "text-gray-400"}`}>
                      {s.status}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded border border-[#1e1e3a] text-[#94a3b8]">
                      {sourceLabels[s.source] || s.source}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded border border-[#1e1e3a] text-[#94a3b8]">
                      {s.category}
                    </span>
                    {s.isDemo && (
                      <span className="text-xs px-2 py-0.5 rounded border border-yellow-400/30 text-yellow-400">
                        DEMO
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {s.sourceDescription && (
                <p className="text-sm text-[#94a3b8] mt-2 line-clamp-2">{s.sourceDescription}</p>
              )}
              {s.statusReason && (
                <p className="text-xs text-[#64748b] mt-2 italic">{s.statusReason}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}