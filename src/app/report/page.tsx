"use client";
import { useEffect, useState } from "react";
import { RefreshCw, FileText } from "lucide-react";

export default function ReportPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/report").then(r => r.json()).then(setReports).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center pt-20"><RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Report</h1>
        <p className="text-[#94a3b8] text-sm mt-1">{reports.length} report generati</p>
      </div>
      {reports.length === 0 ? (
        <div className="glass-card p-8 text-center text-[#64748b]">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p>Nessun report ancora. Esegui <code className="text-indigo-400">npm run report:daily</code></p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="glass-card p-4 animate-slide-in">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-semibold">Report {r.date}</h3>
                <span className="text-xs text-[#64748b]">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div className="bg-[#0a0a1a] rounded-lg p-2"><span className="text-[#64748b]">PnL:</span> <span className={(r.paperPnl || 0) >= 0 ? "text-green-400" : "text-red-400"}>{(r.paperPnl || 0).toFixed(2)}$</span></div>
                <div className="bg-[#0a0a1a] rounded-lg p-2"><span className="text-[#64748b]">Win Rate:</span> <span className="text-white">{r.winRate?.toFixed(1)}%</span></div>
                <div className="bg-[#0a0a1a] rounded-lg p-2"><span className="text-[#64748b]">Posizioni:</span> <span className="text-white">{r.openPositions}</span></div>
                <div className="bg-[#0a0a1a] rounded-lg p-2"><span className="text-[#64748b]">Segnali:</span> <span className="text-white">{r.newSignals}</span></div>
              </div>
              {r.summary && <p className="text-xs text-[#94a3b8] mt-2">{r.summary}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}