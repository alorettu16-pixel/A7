"use client";
import { useEffect, useState } from "react";
import { RefreshCw, BarChart3 } from "lucide-react";

interface DiarioEntry {
  id: number; strategyId: number; decision: string; confidenceScore: number;
  reasonsJson: string; risksJson: string; createdAt: string;
  strategyName?: string; signalAsset?: string; signalSide?: string;
}

export default function DiarioPage() {
  const [entries, setEntries] = useState<DiarioEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/diary").then(r => r.json()).then(setEntries).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center pt-20"><RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Diario delle Decisioni</h1>
        <p className="text-[#94a3b8] text-sm mt-1">{entries.length} decisioni registrate</p>
      </div>
      {entries.length === 0 ? (
        <div className="glass-card p-8 text-center text-[#64748b]">
          <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
          <p>Nessuna decisione ancora.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(e => (
            <div key={e.id} className="glass-card p-3 text-sm animate-slide-in">
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">{e.strategyName || `Strategy #${e.strategyId}`}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  e.decision === "paper_copy" ? "bg-green-500/10 text-green-400 border border-green-500/30" :
                  e.decision === "watchlist" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30" :
                  "bg-red-500/10 text-red-400 border border-red-500/30"
                }`}>{e.decision}</span>
              </div>
              <div className="flex gap-4 mt-1 text-xs text-[#64748b]">
                <span>Confidenza: {((e.confidenceScore || 0) * 100).toFixed(0)}%</span>
                <span>{new Date(e.createdAt).toLocaleString()}</span>
              </div>
              <div className="text-xs text-[#94a3b8] mt-1 line-clamp-2">{e.reasonsJson || "—"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}