"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Zap } from "lucide-react";

interface SignalData {
  id: number;
  strategyId: number;
  asset: string;
  side: string;
  signalPrice: number;
  timestamp: string;
  origin: string;
  strategyName?: string;
}

export default function SegnaliPage() {
  const [signals, setSignals] = useState<SignalData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/signals")
      .then(r => r.json())
      .then(setSignals)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center pt-20"><RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" /></div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Segnali Live</h1>
        <p className="text-[#94a3b8] text-sm mt-1">Ultimi segnali generati ({signals.length} totali)</p>
      </div>

      <div className="glass-card p-4">
        {signals.length === 0 ? (
          <p className="text-[#64748b] text-sm">Nessun segnale ancora. Genera segnali con: npm run signals:generate</p>
        ) : (
          <div className="space-y-2">
            {signals.slice(0, 50).map((s) => (
              <div key={s.id} className="bg-[#0a0a1a] rounded-lg p-3 text-sm animate-slide-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Zap size={16} className={s.side === "long" ? "text-green-400" : "text-red-400"} />
                    <span className="text-white font-semibold">{s.asset}</span>
                    <span className={s.side === "long" ? "text-green-400" : "text-red-400"}>
                      {s.side.toUpperCase()}
                    </span>
                    <span className="text-[#94a3b8]">@ {s.signalPrice.toFixed(2)}$</span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${
                      s.origin === "tradingview_webhook" 
                        ? "border-purple-400/30 text-purple-400" 
                        : "border-blue-400/30 text-blue-400"
                    }`}>
                      {s.origin === "tradingview_webhook" ? "TV" : "Interno"}
                    </span>
                  </div>
                  <span className="text-[#64748b] text-xs">
                    {new Date(s.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}