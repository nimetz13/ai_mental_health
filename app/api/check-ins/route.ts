import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/server";
import { store } from "@/lib/store";
import { Mood } from "@/lib/types";

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) {
    return auth.response;
  }

  const body = (await request.json()) as {
    mood?: Mood;
    energy?: number;
    sleepHours?: number;
    stressLevel?: number;
    note?: string;
  };

  if (
    !body.mood ||
    typeof body.energy !== "number" ||
    typeof body.sleepHours !== "number" ||
    typeof body.stressLevel !== "number"
  ) {
    return jsonError("Incomplete check-in payload.");
  }

  const checkIn = await store.createCheckIn(auth.record.user.id, {
    mood: body.mood,
    energy: body.energy,
    sleepHours: body.sleepHours,
    stressLevel: body.stressLevel,
    note: body.note || "",
  });

  return NextResponse.json({ ok: true, checkIn });
}
