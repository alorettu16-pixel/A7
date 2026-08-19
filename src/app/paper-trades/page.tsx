"use client";
import { useEffect, useState } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Activity, Timer } from "lucide-react";

interface TradeData {
  id: number; strategyId: number; asset: string; side: string;
  entryPrice: number; currentPrice: number; simulatedPositionSize: number;
  feesApplied: number; slippageApplied: number;
  unrealizedPnl: number; realizedPnl: number; status: string;
  openedAt: string; closedAt: string | null;
  strategyName: string;
  pnlCurve: { time: string; pnl: number }[];
  timeExitHours?: number;
}

// ─── Countdown Timer ────────────────────────────────────────────────────────
function CountdownTimer({ endMs, maxHours }: { endMs: number; maxHours: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const remaining = Math.max(0, endMs - now);
  const total = maxHours * 60 * 60 * 1000;
  const elapsed = total - remaining;
  const pct = Math.min(100, (elapsed / total) * 100);

  if (remaining <= 0) {
    return <span className="text-red-400 font-medium text-xs">SCADUTA</span>;
  }

  const h = Math.floor(remaining / (1000 * 60 * 60));
  const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((remaining % (1000 * 60)) / 1000);

  const color = h < 12 ? "text-red-400" : h < 24 ? "text-yellow-400" : "text-[#94a3b8]";

  return (
    <div className="flex items-center gap-1.5">
      <Timer size={10} className={color} />
      <span className={`font-mono text-xs ${color}`}>
        {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </span>
      <div className="w-10 h-1 bg-[#1e1e3a] rounded-full overflow-hidden ml-1">
        <div className={`h-full rounded-full transition-all duration-1000 ${color.replace("text-", "bg-")}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function PaperTradesPage() {
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const res = await fetch("/api/trades");
        setTrades(await res.json());
      } catch {}
      setLoading(false);
    };
    fetchTrades();
    const iv = setInterval(fetchTrades, 15000);
    return () => clearInterval(iv);
  }, []);

  if (loading) return <div className="flex justify-center pt-20"><RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" /></div>;

  const openTrades = trades
    .filter(t => t.status === "open")
    .sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime());
  const closedTrades = trades
    .filter(t => t.status === "closed")
    .sort((a, b) => new Date(a.closedAt ?? a.openedAt).getTime() - new Date(b.closedAt ?? b.openedAt).getTime());
  const totalPnl = trades.reduce((s, t) => s + (t.realizedPnl || 0) + (t.unrealizedPnl || 0), 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Paper Trades</h1>
        <p className="text-[#94a3b8] text-sm mt-1">{trades.length} totali · {openTrades.length} aperti · PnL {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}$</p>
      </div>

      {openTrades.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">Posizioni Aperte</h2>
          <div className="grid gap-3">
            {openTrades.map(t => {
              const pnl = (t.unrealizedPnl || 0);
              const pnlClass = pnl > 0 ? "border-green-500/40 bg-green-500/5" : pnl < 0 ? "border-red-500/40 bg-red-500/5" : "border-gray-500/20";
              const pnlPct = t.entryPrice > 0 ? (t.side === "long" ? (t.currentPrice - t.entryPrice) / t.entryPrice * 100 : (t.entryPrice - t.currentPrice) / t.entryPrice * 100) : 0;
              const slPct = (t as any).slPct ?? 2;
              const tpPct = (t as any).tpPct ?? 4;
              const distToSL = slPct + pnlPct;
              const distToTP = tpPct - pnlPct;
              const toSLbar = Math.max(0, Math.min(100, ((slPct - distToSL) / slPct) * 100));
              const toTPbar = Math.max(0, Math.min(100, (pnlPct / tpPct) * 100));
              return (
                <div key={t.id} className={`glass-card p-4 border-l-4 ${pnlClass} animate-slide-in`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {t.side === "long" ? <TrendingUp className="text-green-400" size={20} /> : <TrendingDown className="text-red-400" size={20} />}
                      <span className="text-white font-semibold">{t.asset}</span>
                      <span className={t.side === "long" ? "text-green-400" : "text-red-400"}>{t.side.toUpperCase()}</span>
                      <span className="text-[#64748b] text-xs">#{t.id}</span>
                    </div>
                    <span className={`font-bold text-lg ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}$ ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)</span>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm text-[#94a3b8]">
                    <div>Entry: <span className="text-white">${t.entryPrice.toFixed(2)}</span></div>
                    <div>Corrente: <span className="text-white">${t.currentPrice.toFixed(2)}</span></div>
                    <div>Size: <span className="text-white">${t.simulatedPositionSize.toFixed(2)}</span></div>
                    <div>
                      <CountdownTimer
                        endMs={new Date(t.openedAt).getTime() + ((t as any).timeExitHours ?? 96) * 60 * 60 * 1000}
                        maxHours={(t as any).timeExitHours ?? 96}
                      />
                    </div>
                  </div>
                  {/* SL/TP Progress Bars */}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <span className="text-red-400">SL {slPct}%</span>
                        <span className="text-[#64748b]">{distToSL > 0 ? distToSL.toFixed(2) + "%" : "⛔"}</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1e1e3a] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-red-500/60 transition-all duration-1000" style={{ width: `${toSLbar}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <span className="text-green-400">TP {tpPct}%</span>
                        <span className="text-[#64748b]">{distToTP > 0 ? distToTP.toFixed(2) + "%" : "✅"}</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1e1e3a] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-green-500/60 transition-all duration-1000" style={{ width: `${toTPbar}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-[#64748b] mt-2">Aperto: {new Date(t.openedAt).toLocaleString()} · {t.strategyName}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {closedTrades.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Trade Conclusi ({closedTrades.length})</h2>
          <div className="space-y-2">
            {closedTrades.map(t => (
              <div key={t.id} className="glass-card p-3 text-sm animate-slide-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Activity size={14} className="text-gray-400" />
                    <span className="text-white">{t.asset}</span>
                    <span className={t.side === "long" ? "text-green-400" : "text-red-400"}>{t.side.toUpperCase()}</span>
                    <span className="text-[#94a3b8]">#{t.id}</span>
                  </div>
                  <span className={(t.realizedPnl || 0) >= 0 ? "text-green-400" : "text-red-400"}>
                    {(t.realizedPnl || 0) >= 0 ? "+" : ""}{(t.realizedPnl || 0).toFixed(2)}$
                  </span>
                </div>
                <div className="text-xs text-[#64748b] mt-1">
                  Entry ${t.entryPrice.toFixed(2)} · Exit ${t.currentPrice.toFixed(2)} · {t.strategyName} · {new Date(t.openedAt).toLocaleDateString()} → {t.closedAt ? new Date(t.closedAt).toLocaleDateString() : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {trades.length === 0 && (
        <div className="glass-card p-8 text-center text-[#64748b]">
          <Activity size={40} className="mx-auto mb-3 opacity-30" />
          <p>Nessun paper trade ancora.</p>
          <p className="text-sm mt-1">Esegui <code className="text-indigo-400">npm run signals:generate</code> per generare i primi segnali o invia un webhook di test.</p>
        </div>
      )}
    </div>
  );
}