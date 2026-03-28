import { PlanId } from "@/lib/types";

export const appConfig = {
  name: "North Star",
  appUrl: process.env.APP_URL || "http://localhost:3000",
  sessionCookie: "northstar_session",
  sessionTtlSeconds: 60 * 60 * 24 * 14,
  sessionSecret: process.env.SESSION_SECRET || "dev-only-session-secret-change-me",
  openAiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  dataFilePath: process.env.DATA_FILE_PATH || "data/north-star.json",
};

export const planCatalog: Record<
  PlanId,
  { label: string; price: string; cadence: string; pitch: string }
> = {
  monthly: {
    label: "Monthly",
    price: "$14",
    cadence: "per month",
    pitch: "Fastest way to start getting nightly support.",
  },
  yearly: {
    label: "Yearly",
    price: "$96",
    cadence: "per year",
    pitch: "Best for habit-building and calmer weeks over time.",
  },
};
