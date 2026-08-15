import { NextResponse } from "next/server";
import db, { dailyReports } from "@/db";
import { desc } from "drizzle-orm";

export async function GET() {
  const reports = db.select().from(dailyReports).orderBy(desc(dailyReports.date)).limit(60).all();
  return NextResponse.json(reports);
}