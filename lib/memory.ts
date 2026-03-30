import { createId } from "@/lib/security";
import { MemoryCategory, MemoryItem } from "@/lib/types";

type MemoryCandidate = {
  content: string;
  category: MemoryCategory;
  source: MemoryItem["source"];
};

function matchesAny(sentence: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(sentence));
}

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

  const identityPatterns = [
    /\b(i work as|i am a|i'm a|my job is|i lead|i manage)\b/i,
    /\b(я працюю|я менеджер|я керую|я керівник|я засновник|я розробник)\b/i,
  ];

  const relationshipPatterns = [
    /\b(my partner|my wife|my husband|my mom|my mother|my dad|my father|my family|my daughter|my son|my friend)\b/i,
    /\b(мій партнер|моя партнерка|моя дружина|мій чоловік|моя мама|мій тато|моя сім'я|моя родина|моя донька|мій син|мій друг|моя подруга)\b/i,
  ];

  const triggerPatterns = [
    /\b(i get triggered by|i struggle with|i always spiral when|i panic when|i can't sleep|i cannot sleep|i have panic attacks|i shut down when)\b/i,
    /\b(мене тригерить|я постійно зриваюсь коли|я панікую коли|я не можу спати|у мене панічні атаки|я закриваюсь коли|мені стає гірше коли|я завжди накручую себе коли)\b/i,
  ];

  const goalPatterns = [
    /\b(i want to|i need to|my goal is|i'm trying to|i am trying to)\b/i,
    /\b(я хочу|мені треба|моя ціль|я намагаюсь|я намагаюся)\b/i,
  ];

  const copingPatterns = [
    /\b(it helps when|what helps is|breathing helps|walking helps|journaling helps|talking helps)\b/i,
    /\b(мені допомагає|що допомагає|допомагає дихання|допомагає ходьба|допомагає щоденник|допомагає розмова)\b/i,
  ];

  const healthPatterns = [
    /\b(adhd|depression|anxiety|panic|insomnia|burnout|grief|trauma)\b/i,
    /\b(депресі[яї]|тривог[аию]|панічн(а|і)|безсон(ня|ням)|вигоран(ня|ням)|горе|травм(а|и|ою)|рдгу|сдуг)\b/i,
  ];

  const durationHealthPatterns = [
    /\b(for|since|past)\s+\d+\s+(year|years|month|months|week|weeks)\b/i,
    /\b(останні|вже|близько|майже)\s+\d+\s+(рок(и|ів)|місяц(і|ів)|тижн(і|ів))\b/i,
  ];

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();

    if (matchesAny(sentence, identityPatterns)) {
      candidates.push({ content: sentence, category: "identity", source: "chat" });
      continue;
    }

    if (matchesAny(sentence, relationshipPatterns)) {
      candidates.push({ content: sentence, category: "relationship", source: "chat" });
      continue;
    }

    if (matchesAny(sentence, triggerPatterns)) {
      candidates.push({ content: sentence, category: "trigger", source: "chat" });
      continue;
    }

    if (matchesAny(sentence, goalPatterns)) {
      candidates.push({ content: sentence, category: "goal", source: "chat" });
      continue;
    }

    if (matchesAny(sentence, copingPatterns)) {
      candidates.push({ content: sentence, category: "coping", source: "chat" });
      continue;
    }

    if (
      matchesAny(sentence, healthPatterns) ||
      (matchesAny(sentence, durationHealthPatterns) &&
        /(depression|anxiety|panic|insomnia|burnout|trauma|депресі|тривог|панічн|безсон|вигоран|травм)/i.test(
          lower,
        ))
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
