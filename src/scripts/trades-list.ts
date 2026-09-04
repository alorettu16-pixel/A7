/**
 * trades-list.ts — Elenca trades chiusi con filtri e ordinamento.
 *
 * Usage:
 *   npm run trades:list                           # tutti i closed, ordinati per PnL decrescente
 *   npm run trades:list -- --today                # solo trades chiusi oggi
 *   npm run trades:list -- --date 2026-09-04      # solo trades chiusi in una data
 *   npm run trades:list -- --sort pnl             # ordina per PnL (default, decrescente)
 *   npm run trades:list -- --sort pnl:asc         # PnL crescente
 *   npm run trades:list -- --sort date            # più recenti prima
 *   npm run trades:list -- --sort date:asc        # più vecchi prima
 *   npm run trades:list -- --sort asset           # alfabetico per asset
 *   npm run trades:list -- --asset BTC            # filtra per asset
 *   npm run trades:list -- --side long            # filtra per side
 *   npm run trades:list -- --limit 10             # mostra solo primi 10
 *   npm run trades:list -- --json                 # output JSON (per altre pipeline)
 *   npm run trades:list -- --csv                  # output CSV
 *   npm run trades:list -- --help                 # mostra tutti i flag
 *
 * Combinazioni supportate (es. --today --sort date --json)
 */

import db, { paperTrades, strategies } from "@/db";
import { eq } from "drizzle-orm";

type SortField = "pnl" | "date" | "asset";
type SortDir = "desc" | "asc";

interface CliArgs {
  today: boolean;
  date: string | null;
  sort: SortField;
  sortDir: SortDir;
  asset: string | null;
  side: string | null;
  limit: number | null;
  json: boolean;
  csv: boolean;
  help: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const out: CliArgs = {
    today: false,
    date: null,
    sort: "pnl",
    sortDir: "desc",
    asset: null,
    side: null,
    limit: null,
    json: false,
    csv: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--today":
        out.today = true;
        break;
      case "--date":
        out.date = args[++i] || null;
        break;
      case "--sort":
        const val = args[++i] || "pnl";
        const parts = val.split(":");
        out.sort = parts[0] as SortField;
        out.sortDir = (parts[1] as SortDir) || "desc";
        break;
      case "--asset":
        out.asset = (args[++i] || "").toUpperCase();
        break;
      case "--side":
        out.side = (args[++i] || "").toLowerCase();
        break;
      case "--limit":
        out.limit = parseInt(args[++i] || "0", 10) || null;
        break;
      case "--json":
        out.json = true;
        break;
      case "--csv":
        out.csv = true;
        break;
      case "--help":
        out.help = true;
        break;
    }
  }

  return out;
}

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}${pnl.toFixed(2)}$`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 19).replace("T", " ");
}

function getPnlEmoji(pnl: number): string {
  if (pnl > 20) return "🟢";
  if (pnl > 0) return "✅";
  if (pnl === 0) return "⚪";
  if (pnl > -20) return "🔴";
  return "💀";
}

function computePnlPct(entry: number, exit: number, side: string): number {
  if (side === "long") return ((exit - entry) / entry) * 100;
  return ((entry - exit) / entry) * 100;
}

function main() {
  const opts = parseArgs();

  if (opts.help) {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  A7 — Elenco Trades Chiusi (trades-list)               ║
╚══════════════════════════════════════════════════════════╝

USO:
  npm run trades:list                 tutti i chiusi, ordinati per PnL ↓
  npm run trades:list -- [FLAGS]

FLAG       DEFAULT   DESCRIZIONE
─── ──── ───── ───────────────────────────────────────────
--today    —          Solo trades chiusi oggi
--date     —          Data specifica (YYYY-MM-DD)
--sort     pnl        Campo: pnl | date | asset
                     Seguire con :asc per crescente (es. --sort pnl:asc)
--asset    —          Filtra per asset (es. --asset BTC)
--side     —          Filtra per side (long | short)
--limit    —          Mostra solo primi N risultati
--json     —          Output JSON (pipeline-friendly)
--csv      —          Output CSV
--help     —          Questo messaggio

ESEMPI:
  npm run trades:list -- --today --sort date
  npm run trades:list -- --date 2026-09-04 --sort pnl
  npm run trades:list -- --asset BTC --side long --limit 5
  npm run trades:list -- --json
  npm run trades:list -- --csv
`);
    return;
  }

  // Carica strategie per avere i nomi
  const allStrategies = db.select().from(strategies).all();
  const stratMap: Record<number, string> = {};
  for (const s of allStrategies) {
    stratMap[s.id] = s.name;
  }

  // Chiudi in una data specifica
  const now = new Date();
  let dateFilter: string | null = null;

  if (opts.today) {
    dateFilter = now.toISOString().slice(0, 10);
  } else if (opts.date) {
    dateFilter = opts.date;
  }

  // Query DB
  if (dateFilter) {
    // closedAt è in formato ISO, filtra per giorno
    const dayStart = dateFilter + "T00:00:00.000Z";
    const dayEnd = dateFilter + "T23:59:59.999Z";
    // Usiamo la query JS per semplicità
  }

  const allTrades = db.select().from(paperTrades).all();

  // Filtra solo chiusi
  let trades = allTrades.filter(t => t.status === "closed");

  // Filtro data
  if (dateFilter) {
    const dayStart = dateFilter + "T00:00:00.000Z";
    const dayEnd = dateFilter + "T23:59:59.999Z";
    trades = trades.filter(t => {
      const d = t.closedAt || "";
      return d >= dayStart && d <= dayEnd;
    });
  }

  // Filtro asset
  if (opts.asset) {
    trades = trades.filter(t => t.asset.toUpperCase() === opts.asset);
  }

  // Filtro side
  if (opts.side) {
    trades = trades.filter(t => t.side === opts.side);
  }

  // Ordinamento
  const sortDir = opts.sortDir === "asc" ? 1 : -1;

  trades.sort((a, b) => {
    const aPnl = a.realizedPnl || 0;
    const bPnl = b.realizedPnl || 0;

    switch (opts.sort) {
      case "pnl":
        return (aPnl - bPnl) * sortDir;
      case "date": {
        const aDate = a.closedAt || a.openedAt || "";
        const bDate = b.closedAt || b.openedAt || "";
        return aDate.localeCompare(bDate) * sortDir;
      }
      case "asset": {
        const comp = a.asset.localeCompare(b.asset);
        return comp * sortDir;
      }
      default:
        return (aPnl - bPnl) * sortDir;
    }
  });

  // Limite
  if (opts.limit && opts.limit > 0) {
    trades = trades.slice(0, opts.limit);
  }

  // Calcola totali
  const totalPnl = trades.reduce((s, t) => s + (t.realizedPnl || 0), 0);
  const wins = trades.filter(t => (t.realizedPnl || 0) > 0).length;
  const losses = trades.filter(t => (t.realizedPnl || 0) < 0).length;
  const best = trades.length > 0 ? Math.max(...trades.map(t => t.realizedPnl || 0)) : 0;
  const worst = trades.length > 0 ? Math.min(...trades.map(t => t.realizedPnl || 0)) : 0;

  // ─── Output ──────────────────────────────────────────────

  if (opts.json) {
    const output = trades.map(t => ({
      id: t.id,
      asset: t.asset,
      side: t.side,
      strategy: stratMap[t.strategyId] || "?",
      entryPrice: t.entryPrice,
      exitPrice: t.currentPrice,
      size: t.simulatedPositionSize,
      pnl: t.realizedPnl || 0,
      pnlPct: computePnlPct(t.entryPrice, t.currentPrice, t.side),
      openedAt: t.openedAt,
      closedAt: t.closedAt,
    }));

    const result = {
      count: trades.length,
      totalPnl,
      wins,
      losses,
      bestTrade: best,
      worstTrade: worst,
      trades: output,
    };

    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (opts.csv) {
    console.log("id,asset,side,strategy,entryPrice,exitPrice,size,pnl,pnlPct,openedAt,closedAt");
    for (const t of trades) {
      const pnl = t.realizedPnl || 0;
      const pnlPct = computePnlPct(t.entryPrice, t.currentPrice, t.side);
      console.log(
        `${t.id},${t.asset},${t.side},"${stratMap[t.strategyId] || "?"}",${t.entryPrice},${t.currentPrice},${t.simulatedPositionSize},${pnl.toFixed(2)},${pnlPct.toFixed(2)},${t.openedAt || ""},${t.closedAt || ""}`
      );
    }
    return;
  }

  // ─── Output tabellare console ──────────────────────────────
  const dateLabel = dateFilter ? dateFilter : "tutti i giorni";

  console.log(`\n╔══════════════════════════════════════════════════════════════════╗`);
  console.log(`║  A7 — Trades Chiusi (${dateLabel})                              ║`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝`);
  console.log(`   Filtri: ${opts.asset ? `asset=${opts.asset} ` : ""}${opts.side ? `side=${opts.side} ` : ""}`);
  console.log(`   Ordine: ${opts.sort === "pnl" ? "per PnL" : opts.sort === "date" ? "per data" : "per asset"} ${opts.sortDir === "desc" ? "↓" : "↑"}`);
  console.log(`   Trovati: ${trades.length} trades  |  Wins: ${wins}  Losses: ${losses}`);
  console.log(`   PnL tot: ${formatPnl(totalPnl)}  |  Best: ${formatPnl(best)}  Worst: ${formatPnl(worst)}`);

  if (trades.length === 0) {
    console.log("\n   (nessun trade chiuso)\n");
    return;
  }

  console.log(`\n┌──────┬────────┬───────┬──────────────────────────┬───────────┬───────────┬──────────┬────────────┬────────────┐`);
  console.log(`│ ID   │ Asset  │ Side  │ Strategia                │ Entry     │ Exit      │ PnL      │ PnL%       │ Chiuso     │`);
  console.log(`├──────┼────────┼───────┼──────────────────────────┼───────────┼───────────┼──────────┼────────────┼────────────┤`);

  for (const t of trades) {
    const pnl = t.realizedPnl || 0;
    const pnlPct = computePnlPct(t.entryPrice, t.currentPrice, t.side);
    const stratName = (stratMap[t.strategyId] || "?").slice(0, 24);
    const emoji = getPnlEmoji(pnl);
    const pnlStr = formatPnl(pnl).padStart(8);
    const pnlPctStr = `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`.padStart(10);
    const closedStr = formatDate(t.closedAt);

    console.log(
      `│ ${String(t.id).padEnd(4)} │ ${t.asset.padEnd(6)} │ ${t.side.padEnd(5)} │ ${stratName.padEnd(24)} │ ${String(t.entryPrice).padStart(9)} │ ${String(t.currentPrice).padStart(9)} │ ${emoji}${pnlStr} │ ${pnlPctStr} │ ${closedStr} │`
    );
  }

  console.log(`└──────┴────────┴───────┴──────────────────────────┴───────────┴───────────┴──────────┴────────────┴────────────┘\n`);
}

main();