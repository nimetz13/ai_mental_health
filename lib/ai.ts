import { appConfig } from "@/lib/config";
import { buildMoodPrompt, classifySafetyLevel, getSafetyCopy } from "@/lib/safety";
import { MemoryItem, StoredMessage, UserProfile } from "@/lib/types";

function getConversationSummary(messages: StoredMessage[]) {
  return messages
    .slice(-8)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n");
}

function deriveSupportMode(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("panic") || lower.includes("overwhelm") || lower.includes("anxious")) {
    return "regulate";
  }
  if (lower.includes("why") || lower.includes("understand")) {
    return "reflect";
  }
  if (lower.includes("what should i do") || lower.includes("plan")) {
    return "act";
  }
  return "support";
}

function buildFallbackReply(message: string) {
  const level = classifySafetyLevel(message);
  if (level === "critical") {
    return "I am really glad you said that. This sounds urgent, and you deserve immediate human support right now. Call or text 988 now if you are in the US or Canada, or contact your local emergency number or nearest emergency room. If possible, message one trusted person and ask them to stay with you while you get support.";
  }

  const mode = deriveSupportMode(message);
  if (mode === "regulate") {
    return "Let's make this smaller. Exhale longer than you inhale five times. Then tell me which of these is strongest right now: body tension, looping thoughts, or fear about what happens next.";
  }

  if (mode === "reflect") {
    return "We can unpack this gently. What happened, what meaning did your mind attach to it, and what feeling hit first? Keep it to three short lines and I will help you sort signal from spiral.";
  }

  if (mode === "act") {
    return "Let's turn this into a plan for tonight. We only need one stabilizing action, one thing to postpone, and one sentence of self-permission. Tell me what feels most urgent and I will structure it with you.";
  }

  return "I hear that this is heavy. You do not need to solve the whole thing tonight. Tell me what hurts most right now, and what would feel 10% lighter before you close the app.";
}

function getMemorySummary(memories: MemoryItem[]) {
  return memories
    .slice(0, 8)
    .map((memory) => `- [${memory.category}] ${memory.content}`)
    .join("\n");
}

export async function generateAssistantReply(input: {
  message: string;
  profile: UserProfile | null;
  history: StoredMessage[];
  memories: MemoryItem[];
}) {
  const safetyLevel = classifySafetyLevel(input.message);
  const safety = getSafetyCopy(safetyLevel);

  if (safetyLevel === "critical") {
    return {
      reply: buildFallbackReply(input.message),
      mode: "safety_override" as const,
      safetyLevel,
      safety,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      reply: buildFallbackReply(input.message),
      mode: "fallback" as const,
      safetyLevel,
      safety,
    };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: appConfig.openAiModel,
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content:
            "You are the AI support layer inside a paid mental wellness product. You are not a therapist and must not claim diagnosis, treatment, or certainty. Your job is to help emotionally overloaded professionals regulate, reflect, and choose one useful next step. Use concise, warm language. Keep most replies under 140 words. If the user shows elevated distress, prioritize grounding before analysis. If self-harm risk appears, immediately direct them to human help and crisis resources.",
        },
        {
          role: "system",
          content: input.profile
            ? `User profile:\nStressor: ${input.profile.stressor}\nGoal: ${input.profile.goal}\nMood: ${input.profile.mood}\n${buildMoodPrompt(input.profile.mood, input.profile.goal)}`
            : "No onboarding profile available.",
        },
        {
          role: "system",
          content: `Safety mode: ${safetyLevel}. Conversation context:\n${getConversationSummary(input.history) || "No prior history."}`,
        },
        {
          role: "system",
          content: `Long-term memory about this user:\n${getMemorySummary(input.memories) || "No stored memories yet."}\nUse this context gently. Do not mention memory unless it is helpful and natural.`,
        },
        {
          role: "user",
          content: input.message,
        },
      ],
    }),
  });

  if (!response.ok) {
    return {
      reply: buildFallbackReply(input.message),
      mode: "fallback" as const,
      safetyLevel,
      safety,
    };
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return {
    reply: data.choices?.[0]?.message?.content?.trim() || buildFallbackReply(input.message),
    mode: "openai" as const,
    safetyLevel,
    safety,
  };
}
