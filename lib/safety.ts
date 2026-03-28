import { Mood, SafetyLevel } from "@/lib/types";

const criticalPattern =
  /\b(suicide|kill myself|end my life|self[- ]harm|hurt myself|want to die|can't go on)\b/i;
const elevatedPattern =
  /\b(panic|hopeless|worthless|can't sleep|burnout|overwhelmed|spiraling|breakdown)\b/i;

export function classifySafetyLevel(message: string): SafetyLevel {
  if (criticalPattern.test(message)) {
    return "critical";
  }

  if (elevatedPattern.test(message)) {
    return "elevated";
  }

  return "normal";
}

export function getSafetyCopy(level: SafetyLevel) {
  if (level === "critical") {
    return {
      title: "Urgent support recommended",
      description:
        "This signal suggests immediate human support is needed. The assistant should shift into crisis-safe guidance only.",
      resources: [
        "US and Canada: call or text 988 now.",
        "If you may act on these thoughts, go to the nearest emergency room or call local emergency services.",
        "Reach out to one trusted person who can stay with you right now.",
      ],
    };
  }

  if (level === "elevated") {
    return {
      title: "High-stress state detected",
      description:
        "The product should prioritize regulation, shorter replies, and specific next steps over open-ended reflection.",
      resources: [
        "Guide the user into breathing or grounding first.",
        "Keep suggestions small enough to complete in under five minutes.",
      ],
    };
  }

  return {
    title: "Stable support mode",
    description:
      "The user can continue with normal support, gentle reflection, and a short action plan.",
    resources: [],
  };
}

export function buildMoodPrompt(mood: Mood, goal: string) {
  if (mood === "Spent") {
    return `The user feels spent. Help them reduce guilt and define what enough means tonight while protecting energy for tomorrow. Goal: ${goal}.`;
  }

  if (mood === "Tense") {
    return `The user feels tense. Start with body regulation, then move into reflection once they are less activated. Goal: ${goal}.`;
  }

  if (mood === "Restless") {
    return `The user feels restless. Give them structure and interrupt avoidance patterns gently. Goal: ${goal}.`;
  }

  if (mood === "Hopeful") {
    return `The user feels hopeful. Reinforce what is working and turn the moment into a repeatable routine. Goal: ${goal}.`;
  }

  return `The user feels steady. Help them protect this state and avoid escalation later in the day. Goal: ${goal}.`;
}
