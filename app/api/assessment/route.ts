import { NextResponse } from "next/server";
import { generateAssessmentResult } from "@/lib/ai";
import { jsonError } from "@/lib/server";
import { Mood } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      stressor?: string;
      goal?: string;
      mood?: Mood;
      timing?: string;
      frequency?: string;
      coping?: string;
    };

    if (!body.stressor || !body.goal || !body.mood || !body.timing || !body.frequency || !body.coping) {
      return jsonError("Missing assessment answers.");
    }

    const assessment = await generateAssessmentResult({
      name: body.name,
      stressor: body.stressor,
      goal: body.goal,
      mood: body.mood,
      timing: body.timing,
      frequency: body.frequency,
      coping: body.coping,
    });

    return NextResponse.json({ assessment });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Assessment failed.");
  }
}
