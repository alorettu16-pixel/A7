"use client";
import { useEffect, useState } from "react";
import { RefreshCw, BarChart3 } from "lucide-react";

interface BacktestSummary {
  id: number; strategyId: number; strategyName: string;
  asset: string; timeframe: string;
  sharpeRatio: number; maxDrawdown: number; winRate: number;
  profitFactor: number; tradeCount: number; totalReturn: number; passed: boolean;
  isOutOfSample: boolean;
}

export default function PerformancePage() {
  const [data, setData] = useState<{strategies: any[]; backtests: BacktestSummary[]}>({strategies: [], backtests: []});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/strategies").then(r => r.json()).then(strategies => {
      fetch("/api/backtests").then(r => r.json()).then(backtests => {
        setData({strategies, backtests});
        setLoading(false);
      });
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center pt-20"><RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" /></div>;

  const passed = data.backtests.filter(b => b.passed);
  const activeStrats = data.strategies.filter((s: any) => s.status === "paper_active");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Performance</h1>
        <p className="text-[#94a3b8] text-sm mt-1">{activeStrats.length} strategie attive · {passed.length} backtest superati</p>
      </div>

      {activeStrats.length === 0 && (
        <div className="glass-card p-8 text-center text-[#64748b]">
          <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
          <p>Nessuna strategia attiva. Esegui <code className="text-indigo-400">npm run backtest:run</code> per backtestare.</p>
        </div>
      )}

      {activeStrats.map((s: any) => {
        const bt = data.backtests.filter(b => b.strategyId === s.id);
        return (
          <div key={s.id} className="glass-card p-4 mb-4 animate-slide-in">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">{s.name}</h3>
              <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/30">ACTIVE</span>
            </div>
            {bt.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {bt.map(b => (
                  <div key={b.id} className="bg-[#0a0a1a] rounded-lg p-3">
                    <div className="text-[#94a3b8] text-xs mb-1">{b.asset} {b.timeframe} {b.isOutOfSample ? "(OOS)" : "(IS)"}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-[#64748b]">Sharpe:</span> <span className="text-white">{b.sharpeRatio?.toFixed(2)}</span></div>
                      <div><span className="text-[#64748b]">Drawdown:</span> <span className="text-white">{(b.maxDrawdown * 100).toFixed(1)}%</span></div>
                      <div><span className="text-[#64748b]">Win Rate:</span> <span className="text-white">{(b.winRate * 100).toFixed(1)}%</span></div>
                      <div><span className="text-[#64748b]">PF:</span> <span className="text-white">{b.profitFactor?.toFixed(2)}</span></div>
                      <div><span className="text-[#64748b]">Trades:</span> <span className="text-white">{b.tradeCount}</span></div>
                      <div><span className="text-[#64748b]">Return:</span> <span className={(b.totalReturn || 0) >= 0 ? "text-green-400" : "text-red-400"}>{(b.totalReturn || 0).toFixed(2)}$</span></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#64748b]">Backtest non ancora disponibili</p>
            )}
          </div>
        );
      })}
    </div>
  );
}