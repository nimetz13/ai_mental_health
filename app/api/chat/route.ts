import { NextResponse } from "next/server";

type ChatPayload = {
  message?: string;
  profile?: {
    name?: string;
    stressor?: string;
    goal?: string;
    mood?: string;
  };
};

const crisisPattern =
  /\b(suicide|kill myself|end my life|self harm|self-harm|hurt myself|want to die)\b/i;

function buildFallbackReply(message: string, profile?: ChatPayload["profile"]) {
  const name = profile?.name?.trim() || "there";
  const goal = profile?.goal?.trim();
  const stressor = profile?.stressor?.trim();

  if (crisisPattern.test(message)) {
    return `I am really glad you said that, ${name}. This sounds urgent, and you deserve human support right now. If you might act on these thoughts, call or text 988 now, or go to the nearest emergency room. If you are outside the US, contact your local emergency line or a trusted person who can stay with you.`;
  }

  const lower = message.toLowerCase();

  if (lower.includes("anxious") || lower.includes("panic") || lower.includes("overwhelm")) {
    return `Let's slow this down together, ${name}. Try this: inhale for 4, exhale for 6, five times. Then name 3 things you can see and 2 things you can feel. ${goal ? `After that, we can focus on your goal: ${goal.toLowerCase()}.` : "After that, tell me which part feels heaviest right now."}`;
  }

  if (lower.includes("work") || lower.includes("burnout") || lower.includes("stress")) {
    return `It makes sense that this feels heavy${stressor ? `, especially with ${stressor.toLowerCase()}` : ""}. A useful next step is to separate what is urgent, what is important, and what can wait until tomorrow. If you want, send me the top three things on your mind and I will help you sort them.`;
  }

  return `I hear you, ${name}. You do not need to solve everything in one step. Tell me what happened, what feeling is strongest right now, and what would feel like a small win in the next 20 minutes.`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatPayload;
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reply: buildFallbackReply(message, body.profile),
        mode: "fallback",
      });
    }

    const profileSummary = [
      body.profile?.name ? `Name: ${body.profile.name}` : null,
      body.profile?.stressor ? `Main stressor: ${body.profile.stressor}` : null,
      body.profile?.goal ? `Desired outcome: ${body.profile.goal}` : null,
      body.profile?.mood ? `Current mood: ${body.profile.mood}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:
              "You are a supportive AI companion for a mental wellness app. Be warm, concise, practical, and emotionally validating. Do not claim to be a therapist. Prefer short grounding steps, gentle reflection, and concrete next actions. If the user expresses self-harm or suicide risk, strongly encourage immediate human help and include the US 988 hotline.",
          },
          {
            role: "system",
            content: profileSummary || "No saved profile context.",
          },
          {
            role: "user",
            content: message,
          },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({
        reply: buildFallbackReply(message, body.profile),
        mode: "fallback",
      });
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return NextResponse.json({
      reply:
        data.choices?.[0]?.message?.content?.trim() ||
        buildFallbackReply(message, body.profile),
      mode: "openai",
    });
  } catch {
    return NextResponse.json(
      {
        reply:
          "I'm here with you. Take one slow breath in, and a longer breath out. Tell me what feels most intense right now, and we can unpack it one step at a time.",
        mode: "fallback",
      },
      { status: 200 },
    );
  }
}
