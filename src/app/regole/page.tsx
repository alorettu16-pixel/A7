"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Sliders } from "lucide-react";

export default function RegolePage() {
  const [strategies, setStrategies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/strategies").then(r => r.json()).then(setStrategies).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center pt-20"><RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" /></div>;

  const active = strategies.filter((s: any) => s.status === "paper_active");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Regole & Parametri</h1>
        <p className="text-[#94a3b8] text-sm mt-1">Parametri attivi per ogni strategia</p>
      </div>
      {active.length === 0 ? (
        <div className="glass-card p-8 text-center text-[#64748b]">
          <Sliders size={40} className="mx-auto mb-3 opacity-30" />
          <p>Nessuna strategia attiva.</p>
        </div>
      ) : active.map((s: any) => (
        <div key={s.id} className="glass-card p-4 mb-4 animate-slide-in">
          <h3 className="text-white font-semibold mb-2">{s.name}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div className="bg-[#0a0a1a] rounded-lg p-2"><span className="text-[#64748b]">SL:</span> <span className="text-white ml-1">{s.parametersJson ? JSON.parse(s.parametersJson).slPct || JSON.parse(s.parametersJson).sl || "—" : "—"}%</span></div>
            <div className="bg-[#0a0a1a] rounded-lg p-2"><span className="text-[#64748b]">TP:</span> <span className="text-white ml-1">{s.parametersJson ? JSON.parse(s.parametersJson).tpPct || JSON.parse(s.parametersJson).tp || "—" : "—"}%</span></div>
            <div className="bg-[#0a0a1a] rounded-lg p-2 col-span-2"><span className="text-[#64748b]">Stato:</span> <span className="text-white ml-1">{s.status}</span></div>
          </div>
          <details className="mt-2">
            <summary className="text-xs text-[#64748b] cursor-pointer hover:text-[#94a3b8]">Vedi parametri completi</summary>
            <pre className="bg-[#0a0a1a] rounded-lg p-2 text-xs text-green-400 font-mono mt-1 overflow-x-auto">
              {JSON.stringify(JSON.parse(s.parametersJson || "{}"), null, 2)}
            </pre>
          </details>
        </div>
      ))}
    </div>
  );
}