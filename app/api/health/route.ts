import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    storage: process.env.DATABASE_URL ? "postgres" : "file",
    billing: process.env.STRIPE_SECRET_KEY ? "stripe" : "demo",
    ai: process.env.OPENAI_API_KEY ? "openai" : "fallback",
  });
}
