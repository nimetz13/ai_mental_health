import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/server";
import { store } from "@/lib/store";
import { Mood, PlanId } from "@/lib/types";

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) {
    return auth.response;
  }

  const body = (await request.json()) as {
    stressor?: string;
    goal?: string;
    mood?: Mood;
    planPreference?: PlanId;
  };

  if (!body.stressor || !body.goal || !body.mood || !body.planPreference) {
    return jsonError("Incomplete profile payload.");
  }

  const profile = await store.updateProfile(auth.record.user.id, {
    stressor: body.stressor,
    goal: body.goal,
    mood: body.mood,
    planPreference: body.planPreference,
    onboardingCompleted: true,
  });

  return NextResponse.json({ ok: true, profile });
}
