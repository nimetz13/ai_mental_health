export type Mood = "Spent" | "Tense" | "Restless" | "Steady" | "Hopeful";

export type PlanId = "free" | "monthly" | "yearly";

export type SafetyLevel = "normal" | "elevated" | "critical";
export type MemoryCategory =
  | "identity"
  | "relationship"
  | "trigger"
  | "goal"
  | "coping"
  | "health"
  | "context";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
};

export type UserProfile = {
  userId: string;
  stressor: string;
  goal: string;
  mood: Mood;
  planPreference: PlanId;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionStatus =
  | "inactive"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export type UserSubscription = {
  userId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  provider: "demo" | "stripe";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Conversation = {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredMessage = {
  id: string;
  conversationId: string;
  role: "system" | "assistant" | "user";
  content: string;
  safetyLevel: SafetyLevel;
  createdAt: string;
};

export type CheckIn = {
  id: string;
  userId: string;
  mood: Mood;
  energy: number;
  sleepHours: number;
  stressLevel: number;
  note: string;
  createdAt: string;
};

export type JournalEntry = {
  id: string;
  userId: string;
  prompt: string;
  content: string;
  summary: string;
  createdAt: string;
};

export type MemoryItem = {
  id: string;
  userId: string;
  content: string;
  category: MemoryCategory;
  source: "onboarding" | "chat" | "journal" | "manual";
  createdAt: string;
  updatedAt: string;
};

export type DashboardData = {
  user: Omit<AppUser, "passwordHash">;
  profile: UserProfile | null;
  subscription: UserSubscription | null;
  conversations: Conversation[];
  currentConversation: {
    conversation: Conversation | null;
    messages: StoredMessage[];
  };
  checkIns: CheckIn[];
  journalEntries: JournalEntry[];
  memories: MemoryItem[];
};
