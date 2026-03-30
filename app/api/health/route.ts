import { NextResponse } from "next/server";

export async function GET() {
  const serverlessFileStorage = !process.env.DATABASE_URL && Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    storage: process.env.DATABASE_URL ? "postgres" : serverlessFileStorage ? "ephemeral-file" : "file",
    billing: process.env.STRIPE_SECRET_KEY ? "stripe" : "demo",
    ai: process.env.OPENAI_API_KEY ? "openai" : "fallback",
  });
}
