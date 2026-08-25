import db, { strategies } from "@/db";
import { eq } from "drizzle-orm";

/**
 * Script di migrazione: imposta timeExitHours=48 su TUTTE le strategie
 * paper_active, sovrascrivendo qualsiasi valore precedente (24h, 96h, ecc.)
 *
 * È una soluzione definitiva — non importa come sono state create o modificate,
 * tutte le nuove aperture avranno time_exit a 48h.
 */
async function main() {
  const active = db.select().from(strategies).where(eq(strategies.status, "paper_active")).all();
  console.log(`🔍 Trovate ${active.length} strategie paper_active`);

  let updated = 0;
  for (const s of active) {
    const params = JSON.parse(s.parametersJson || "{}");
    const oldVal = params.timeExitHours ?? params.timeExit ?? "N/A";
    params.timeExitHours = 48;
    delete params.timeExit; // unified field

    db.update(strategies)
      .set({ parametersJson: JSON.stringify(params) })
      .where(eq(strategies.id, s.id))
      .run();

    console.log(`  ✅ ${s.name} — timeExit: ${oldVal} → 48h`);
    updated++;
  }

  console.log(`\n✅ Migrazione completata: ${updated} strategie aggiornate a timeExitHours=48`);
}

main().catch(console.error);