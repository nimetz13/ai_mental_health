import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { hashPassword } from "@/lib/security";
import { jsonError } from "@/lib/server";
import { store } from "@/lib/store";
import { Mood, PlanId } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      name?: string;
      password?: string;
      stressor?: string;
      goal?: string;
      mood?: Mood;
      planPreference?: PlanId;
    };

    if (!body.email || !body.name || !body.password || !body.stressor || !body.goal || !body.mood) {
      return jsonError("Missing required registration fields.");
    }

    if (body.password.length < 8) {
      return jsonError("Password must be at least 8 characters.");
    }

    const created = await store.createUser({
      email: body.email,
      name: body.name,
      passwordHash: hashPassword(body.password),
      stressor: body.stressor,
      goal: body.goal,
      mood: body.mood,
      planPreference: body.planPreference || "yearly",
    });

    await setSessionCookie({ userId: created.user.id, email: created.user.email });

    return NextResponse.json({
      ok: true,
      user: {
        id: created.user.id,
        email: created.user.email,
        name: created.user.name,
      },
      profile: created.profile,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Registration failed.");
  }
}
