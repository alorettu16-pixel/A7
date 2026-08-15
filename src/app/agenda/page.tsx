"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Calendar } from "lucide-react";

export default function AgendaPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agenda").then(r => r.json()).then(setReports).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center pt-20"><RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Agenda</h1>
        <p className="text-[#94a3b8] text-sm mt-1">{reports.length} report giornalieri</p>
      </div>
      {reports.length === 0 ? (
        <div className="glass-card p-8 text-center text-[#64748b]">
          <Calendar size={40} className="mx-auto mb-3 opacity-30" />
          <p>Nessun report ancora. Il report viene generato automaticamente a fine giornata.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => {
            const pnl = r.paperPnl || 0;
            const isPositive = pnl >= 0;
            let summary = {};
            try { summary = JSON.parse(r.summary || "{}"); } catch {}
            const stratDetails = Object.values(summary) as { name: string; opened: number; closed: number; pnl: number }[];

            return (
              <div key={r.id} className="glass-card p-4 animate-slide-in">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={18} className="text-indigo-400" />
                    <span className="text-white font-semibold">{r.date}</span>
                  </div>
                  <span className={`text-lg font-bold ${isPositive ? "text-green-400" : "text-red-400"}`}>
                    {isPositive ? "+" : ""}{pnl.toFixed(2)}$
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="bg-[#0a0a1a]/50 rounded-lg p-2">
                    <div className="text-[#64748b] text-xs">Posizioni</div>
                    <div className="text-white font-medium">{r.openPositions ?? "?"}</div>
                  </div>
                  <div className="bg-[#0a0a1a]/50 rounded-lg p-2">
                    <div className="text-[#64748b] text-xs">Chiusi</div>
                    <div className="text-white font-medium">{r.newSignals ?? "?"}</div>
                  </div>
                  <div className="bg-[#0a0a1a]/50 rounded-lg p-2">
                    <div className="text-[#64748b] text-xs">Win Rate</div>
                    <div className="text-white font-medium">{r.winRate != null ? r.winRate.toFixed(1) + "%" : "N/A"}</div>
                  </div>
                  <div className="bg-[#0a0a1a]/50 rounded-lg p-2">
                    <div className="text-[#64748b] text-xs">Strategie</div>
                    <div className="text-white font-medium">{r.activeStrategies ?? "?"}</div>
                  </div>
                </div>
                {stratDetails.length > 0 && (
                  <div className="mt-3 text-xs text-[#64748b] space-y-1">
                    {stratDetails.map((s: any, i: number) => (
                      <div key={i} className="flex justify-between">
                        <span>{s.name?.slice(0, 35)}</span>
                        <span className={s.pnl >= 0 ? "text-green-400" : "text-red-400"}>
                          {s.pnl >= 0 ? "+" : ""}{s.pnl?.toFixed(1) ?? "0.0"}$
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}