import { PlanId } from "@/lib/types";

export const appConfig = {
  name: "North Star",
  appUrl: process.env.APP_URL || "http://localhost:3000",
  sessionCookie: "northstar_session",
  googleOauthStateCookie: "northstar_google_oauth_state",
  sessionTtlSeconds: 60 * 60 * 24 * 14,
  sessionSecret: process.env.SESSION_SECRET || "dev-only-session-secret-change-me",
  openAiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  dataFilePath: process.env.DATA_FILE_PATH || "data/north-star.json",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
};

export const planCatalog: Record<
  PlanId,
  {
    label: string;
    price: string;
    cadence: string;
    pitch: string;
    badge?: string;
    originalPrice?: string;
    note?: string;
  }
> = {
  free: {
    label: "Free",
    price: "$0",
    cadence: "forever",
    pitch: "Try the product with lighter support and no payment friction.",
    note: "Good for testing the ritual before committing.",
  },
  monthly: {
    label: "Monthly",
    price: "$14",
    cadence: "per month",
    pitch: "Fastest way to start getting nightly support.",
    note: "Full access with flexible commitment.",
  },
  yearly: {
    label: "Yearly",
    price: "$96",
    cadence: "per year",
    pitch: "Best for habit-building and calmer weeks over time.",
    badge: "Save 43%",
    originalPrice: "$168",
    note: "Equivalent to $8 per month on the annual plan.",
  },
};
