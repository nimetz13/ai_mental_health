import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { hashPassword } from "@/lib/security";
import { jsonError } from "@/lib/server";
import { store } from "@/lib/store";
import { Mood, PlanId } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      stressor?: string;
      goal?: string;
      mood?: Mood;
      planPreference?: PlanId;
    };

    if (!body.name || !body.stressor || !body.goal || !body.mood) {
      return jsonError("Missing Google sign-in context.");
    }

    const normalizedName = body.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".");
    const email = `${normalizedName || "north.star.user"}+demo@gmail.com`;
    const existing = await store.findUserByEmail(email);

    if (existing) {
      await setSessionCookie({ userId: existing.id, email: existing.email });
      return NextResponse.json({
        ok: true,
        mode: "login",
        user: {
          id: existing.id,
          email: existing.email,
          name: existing.name,
        },
      });
    }

    const created = await store.createUser({
      email,
      name: body.name,
      passwordHash: hashPassword(`google-demo-${Date.now()}`),
      stressor: body.stressor,
      goal: body.goal,
      mood: body.mood,
      planPreference: body.planPreference || "yearly",
    });

    await setSessionCookie({ userId: created.user.id, email: created.user.email });

    return NextResponse.json({
      ok: true,
      mode: "register",
      user: {
        id: created.user.id,
        email: created.user.email,
        name: created.user.name,
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Google sign-in failed.");
  }
}
