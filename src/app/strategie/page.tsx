"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

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

  useEffect(() => {
    fetch("/api/strategies")
      .then(r => r.json())
      .then(setStrategies)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center pt-20"><RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" /></div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Libreria Strategie</h1>
        <p className="text-[#94a3b8] text-sm mt-1">{strategies.length} strategie totali</p>
      </div>

      <div className="grid gap-4">
        {strategies.map((s) => {
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
            <div key={s.id} className="glass-card p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-white font-semibold">{s.name}</h3>
                  <div className="flex gap-2 mt-1">
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