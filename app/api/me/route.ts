import { NextResponse } from "next/server";
import { buildInsights } from "@/lib/insights";
import { requireUser } from "@/lib/server";
import { store } from "@/lib/store";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) {
    return auth.response;
  }

  const dashboard = await store.getDashboardData(auth.record.user.id);
  return NextResponse.json({
    authenticated: true,
    dashboard,
    insights: buildInsights(dashboard),
    access:
      dashboard.subscription?.status === "active" || dashboard.subscription?.status === "trialing",
  });
}
