import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";

const CWD = process.cwd();

export async function POST(request: NextRequest) {
  const { command } = await request.json();
  
  const scripts: Record<string, string> = {
    seed: "npx tsx src/scripts/seed.ts",
    backtest: "npx tsx src/scripts/run-backtest.ts",
    signals: "npx tsx src/scripts/generate-signals.ts",
    pnl: "npx tsx src/scripts/update-pnl.ts",
    report: "npx tsx src/scripts/daily-report.ts",
    webhook: "npx tsx src/scripts/test-webhook.ts",
  };

  const cmd = scripts[command as string];
  if (!cmd) {
    return NextResponse.json({ ok: false, error: `Comando sconosciuto: ${command}` });
  }

  try {
    const output = execSync(cmd, { cwd: CWD, timeout: 120000, encoding: "utf-8" });
    return NextResponse.json({ ok: true, output });
  } catch (err: any) {
    return NextResponse.json({ ok: false, output: err.stdout || err.stderr || String(err) });
  }
}