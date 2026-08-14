import db, { dailyReports } from "@/db";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const reports = await db.select().from(dailyReports).orderBy(desc(dailyReports.createdAt)).limit(50);
  return NextResponse.json(reports);
}