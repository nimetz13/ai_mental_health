import { createId } from "@/lib/security";
import { MemoryCategory, MemoryItem } from "@/lib/types";

type MemoryCandidate = {
  content: string;
  category: MemoryCategory;
  source: MemoryItem["source"];
};

function cleanSentence(input: string) {
  return input.replace(/\s+/g, " ").trim().replace(/[.!,;:]+$/, "");
}

function splitSentences(input: string) {
  return input
    .split(/(?<=[.!?])\s+/)
    .map(cleanSentence)
    .filter((sentence) => sentence.length >= 12);
}

export function buildOnboardingMemories(input: {
  stressor: string;
  goal: string;
}) {
  return [
    {
      content: `Primary reason for using North Star: ${input.stressor}`,
      category: "context" as const,
      source: "onboarding" as const,
    },
    {
      content: `Desired outcome: ${input.goal}`,
      category: "goal" as const,
      source: "onboarding" as const,
    },
  ];
}

export function extractMemoryCandidates(message: string): MemoryCandidate[] {
  const candidates: MemoryCandidate[] = [];
  const sentences = splitSentences(message).slice(0, 3);

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();

    if (
      /\b(i work as|i am a|i'm a|my job is|i lead|i manage)\b/i.test(sentence)
    ) {
      candidates.push({ content: sentence, category: "identity", source: "chat" });
      continue;
    }

    if (
      /\b(my partner|my wife|my husband|my mom|my mother|my dad|my father|my family|my daughter|my son|my friend)\b/i.test(
        sentence,
      )
    ) {
      candidates.push({ content: sentence, category: "relationship", source: "chat" });
      continue;
    }

    if (
      /\b(i get triggered by|i struggle with|i always spiral when|i panic when|i can't sleep|i cannot sleep|i have panic attacks|i shut down when)\b/i.test(
        sentence,
      )
    ) {
      candidates.push({ content: sentence, category: "trigger", source: "chat" });
      continue;
    }

    if (
      /\b(i want to|i need to|my goal is|i'm trying to|i am trying to)\b/i.test(sentence)
    ) {
      candidates.push({ content: sentence, category: "goal", source: "chat" });
      continue;
    }

    if (
      /\b(it helps when|what helps is|breathing helps|walking helps|journaling helps|talking helps)\b/i.test(
        sentence,
      )
    ) {
      candidates.push({ content: sentence, category: "coping", source: "chat" });
      continue;
    }

    if (
      /\b(adhd|depression|anxiety|panic|insomnia|burnout|grief|trauma)\b/i.test(sentence)
    ) {
      candidates.push({ content: sentence, category: "health", source: "chat" });
    }
  }

  return candidates.slice(0, 2);
}

export function mergeMemories(
  existing: MemoryItem[],
  candidates: MemoryCandidate[],
  userId: string,
) {
  const now = new Date().toISOString();
  const created: MemoryItem[] = [];

  for (const candidate of candidates) {
    const normalized = candidate.content.toLowerCase();
    const duplicate = existing.find(
      (item) =>
        item.category === candidate.category &&
        item.content.toLowerCase() === normalized,
    );

    if (duplicate) {
      duplicate.updatedAt = now;
      continue;
    }

    created.push({
      id: createId("mem"),
      userId,
      content: candidate.content,
      category: candidate.category,
      source: candidate.source,
      createdAt: now,
      updatedAt: now,
    });
  }

  return created;
}
