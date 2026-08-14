import db, { tradingViewWebhookLogs } from "@/db";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const logs = await db
    .select()
    .from(tradingViewWebhookLogs)
    .orderBy(desc(tradingViewWebhookLogs.receivedAt))
    .limit(100);

  return NextResponse.json(logs);
}