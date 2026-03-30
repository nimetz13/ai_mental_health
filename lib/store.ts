import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { Pool } from "pg";
import { appConfig } from "@/lib/config";
import { buildOnboardingMemories, mergeMemories } from "@/lib/memory";
import { createId } from "@/lib/security";
import {
  AppUser,
  CheckIn,
  Conversation,
  DashboardData,
  JournalEntry,
  MemoryItem,
  Mood,
  PlanId,
  SafetyLevel,
  StoredMessage,
  SubscriptionStatus,
  UserProfile,
  UserSubscription,
} from "@/lib/types";

type SafeUser = Omit<AppUser, "passwordHash">;

type StorePayload = {
  users: AppUser[];
  profiles: UserProfile[];
  subscriptions: UserSubscription[];
  conversations: Conversation[];
  messages: StoredMessage[];
  checkIns: CheckIn[];
  journalEntries: JournalEntry[];
  memories: MemoryItem[];
};

const emptyStore = (): StorePayload => ({
  users: [],
  profiles: [],
  subscriptions: [],
  conversations: [],
  messages: [],
  checkIns: [],
  journalEntries: [],
  memories: [],
});

type RegisterInput = {
  email: string;
  name: string;
  passwordHash: string;
  stressor: string;
  goal: string;
  mood: Mood;
  planPreference: PlanId;
};

type ProfileInput = {
  stressor: string;
  goal: string;
  mood: Mood;
  planPreference: PlanId;
  onboardingCompleted: boolean;
};

type SubscriptionInput = {
  planId: PlanId;
  status: SubscriptionStatus;
  provider: "demo" | "stripe";
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
};

type CreateMessageInput = {
  role: "system" | "assistant" | "user";
  content: string;
  safetyLevel: SafetyLevel;
};

type CheckInInput = {
  mood: Mood;
  energy: number;
  sleepHours: number;
  stressLevel: number;
  note: string;
};

type JournalInput = {
  prompt: string;
  content: string;
  summary: string;
};

type MemoryInput = {
  content: string;
  category: MemoryItem["category"];
  source: MemoryItem["source"];
};

export type UserRecord = {
  user: AppUser;
  profile: UserProfile;
  subscription: UserSubscription | null;
};

function sanitizeUser(user: AppUser): SafeUser {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

class FileStore {
  private filePath = this.resolveFilePath();

  private resolveFilePath() {
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      return path.join("/tmp", appConfig.dataFilePath);
    }

    return path.join(process.cwd(), appConfig.dataFilePath);
  }

  private async load() {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw) as StorePayload;
    } catch {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const initial = emptyStore();
      await writeFile(this.filePath, JSON.stringify(initial, null, 2));
      return initial;
    }
  }

  private async save(payload: StorePayload) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(payload, null, 2));
  }

  async createUser(input: RegisterInput): Promise<UserRecord> {
    const store = await this.load();
    const existing = store.users.find((user) => user.email.toLowerCase() === input.email.toLowerCase());
    if (existing) {
      throw new Error("A user with this email already exists.");
    }

    const now = new Date().toISOString();
    const user: AppUser = {
      id: createId("user"),
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash: input.passwordHash,
      createdAt: now,
    };

    const profile: UserProfile = {
      userId: user.id,
      stressor: input.stressor,
      goal: input.goal,
      mood: input.mood,
      planPreference: input.planPreference,
      onboardingCompleted: true,
      createdAt: now,
      updatedAt: now,
    };

    store.users.push(user);
    store.profiles.push(profile);
    const initialMemories = mergeMemories(store.memories, buildOnboardingMemories(input), user.id);
    store.memories.push(...initialMemories);
    await this.save(store);
    return { user, profile, subscription: null };
  }

  async findUserByEmail(email: string) {
    const store = await this.load();
    return store.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async findUserById(userId: string) {
    const store = await this.load();
    return store.users.find((user) => user.id === userId) || null;
  }

  async getUserRecord(userId: string): Promise<UserRecord | null> {
    const store = await this.load();
    const user = store.users.find((item) => item.id === userId);
    const profile = store.profiles.find((item) => item.userId === userId);
    if (!user || !profile) {
      return null;
    }

    const subscription = store.subscriptions.find((item) => item.userId === userId) || null;
    return { user, profile, subscription };
  }

  async updateProfile(userId: string, input: ProfileInput) {
    const store = await this.load();
    const profile = store.profiles.find((item) => item.userId === userId);
    if (!profile) {
      throw new Error("Profile not found.");
    }

    profile.stressor = input.stressor;
    profile.goal = input.goal;
    profile.mood = input.mood;
    profile.planPreference = input.planPreference;
    profile.onboardingCompleted = input.onboardingCompleted;
    profile.updatedAt = new Date().toISOString();
    await this.save(store);
    return profile;
  }

  async upsertSubscription(userId: string, input: SubscriptionInput) {
    const store = await this.load();
    const now = new Date().toISOString();
    const existing = store.subscriptions.find((item) => item.userId === userId);

    if (existing) {
      existing.planId = input.planId;
      existing.status = input.status;
      existing.provider = input.provider;
      existing.stripeCustomerId = input.stripeCustomerId ?? existing.stripeCustomerId;
      existing.stripeSubscriptionId = input.stripeSubscriptionId ?? existing.stripeSubscriptionId;
      existing.trialEndsAt = input.trialEndsAt ?? existing.trialEndsAt;
      existing.currentPeriodEnd = input.currentPeriodEnd ?? existing.currentPeriodEnd;
      existing.updatedAt = now;
      await this.save(store);
      return existing;
    }

    const created: UserSubscription = {
      userId,
      planId: input.planId,
      status: input.status,
      provider: input.provider,
      stripeCustomerId: input.stripeCustomerId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      trialEndsAt: input.trialEndsAt ?? null,
      currentPeriodEnd: input.currentPeriodEnd ?? null,
      createdAt: now,
      updatedAt: now,
    };
    store.subscriptions.push(created);
    await this.save(store);
    return created;
  }

  async listConversations(userId: string) {
    const store = await this.load();
    return store.conversations
      .filter((item) => item.userId === userId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async getConversation(userId: string, conversationId: string) {
    const store = await this.load();
    const conversation = store.conversations.find(
      (item) => item.id === conversationId && item.userId === userId,
    );
    if (!conversation) {
      return { conversation: null, messages: [] as StoredMessage[] };
    }

    const messages = store.messages
      .filter((item) => item.conversationId === conversationId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    return { conversation, messages };
  }

  async createConversation(userId: string, title: string) {
    const store = await this.load();
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: createId("conv"),
      userId,
      title,
      createdAt: now,
      updatedAt: now,
    };
    store.conversations.push(conversation);
    await this.save(store);
    return conversation;
  }

  async appendMessages(userId: string, conversationId: string, messages: CreateMessageInput[]) {
    const store = await this.load();
    const conversation = store.conversations.find(
      (item) => item.id === conversationId && item.userId === userId,
    );
    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    const now = new Date().toISOString();
    for (const message of messages) {
      store.messages.push({
        id: createId("msg"),
        conversationId,
        role: message.role,
        content: message.content,
        safetyLevel: message.safetyLevel,
        createdAt: now,
      });
    }
    conversation.updatedAt = now;
    await this.save(store);
    return this.getConversation(userId, conversationId);
  }

  async createCheckIn(userId: string, input: CheckInInput) {
    const store = await this.load();
    const checkIn: CheckIn = {
      id: createId("checkin"),
      userId,
      ...input,
      createdAt: new Date().toISOString(),
    };
    store.checkIns.push(checkIn);
    await this.save(store);
    return checkIn;
  }

  async createJournalEntry(userId: string, input: JournalInput) {
    const store = await this.load();
    const entry: JournalEntry = {
      id: createId("journal"),
      userId,
      ...input,
      createdAt: new Date().toISOString(),
    };
    store.journalEntries.push(entry);
    await this.save(store);
    return entry;
  }

  async listMemories(userId: string) {
    const store = await this.load();
    return store.memories
      .filter((item) => item.userId === userId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 12);
  }

  async remember(userId: string, input: MemoryInput[]) {
    const store = await this.load();
    const existing = store.memories.filter((item) => item.userId === userId);
    const created = mergeMemories(existing, input, userId);
    store.memories.push(...created);
    await this.save(store);
    return this.listMemories(userId);
  }

  async forgetMemory(userId: string, memoryId: string) {
    const store = await this.load();
    store.memories = store.memories.filter(
      (item) => !(item.userId === userId && item.id === memoryId),
    );
    await this.save(store);
    return this.listMemories(userId);
  }

  async getDashboardData(userId: string): Promise<DashboardData> {
    const store = await this.load();
    const user = store.users.find((item) => item.id === userId);
    if (!user) {
      throw new Error("User not found.");
    }

    const profile = store.profiles.find((item) => item.userId === userId) || null;
    const subscription = store.subscriptions.find((item) => item.userId === userId) || null;
    const conversations = store.conversations
      .filter((item) => item.userId === userId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const activeConversation = conversations[0] || null;
    const messages = activeConversation
      ? store.messages
          .filter((item) => item.conversationId === activeConversation.id)
          .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      : [];
    const checkIns = store.checkIns
      .filter((item) => item.userId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 7);
    const journalEntries = store.journalEntries
      .filter((item) => item.userId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 5);
    const memories = store.memories
      .filter((item) => item.userId === userId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 12);

    return {
      user: sanitizeUser(user),
      profile,
      subscription,
      conversations,
      currentConversation: {
        conversation: activeConversation,
        messages,
      },
      checkIns,
      journalEntries,
      memories,
    };
  }
}

class PostgresStore {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });
  private schemaReady: Promise<void> | null = null;

  private async ensureSchema() {
    if (!this.schemaReady) {
      this.schemaReady = this.pool
        .query(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL
          );
          CREATE TABLE IF NOT EXISTS profiles (
            user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            stressor TEXT NOT NULL,
            goal TEXT NOT NULL,
            mood TEXT NOT NULL,
            plan_preference TEXT NOT NULL,
            onboarding_completed BOOLEAN NOT NULL,
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL
          );
          CREATE TABLE IF NOT EXISTS subscriptions (
            user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            plan_id TEXT NOT NULL,
            status TEXT NOT NULL,
            provider TEXT NOT NULL,
            stripe_customer_id TEXT,
            stripe_subscription_id TEXT,
            trial_ends_at TIMESTAMPTZ,
            current_period_end TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL
          );
          CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL
          );
          CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            safety_level TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL
          );
          CREATE TABLE IF NOT EXISTS check_ins (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            mood TEXT NOT NULL,
            energy INTEGER NOT NULL,
            sleep_hours DOUBLE PRECISION NOT NULL,
            stress_level INTEGER NOT NULL,
            note TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL
          );
          CREATE TABLE IF NOT EXISTS journal_entries (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            prompt TEXT NOT NULL,
            content TEXT NOT NULL,
            summary TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL
          );
          CREATE TABLE IF NOT EXISTS memories (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            category TEXT NOT NULL,
            source TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL
          );
        `)
        .then(() => undefined);
    }

    await this.schemaReady;
  }

  async createUser(input: RegisterInput): Promise<UserRecord> {
    await this.ensureSchema();
    const existing = await this.findUserByEmail(input.email);
    if (existing) {
      throw new Error("A user with this email already exists.");
    }

    const now = new Date().toISOString();
    const user: AppUser = {
      id: createId("user"),
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash: input.passwordHash,
      createdAt: now,
    };
    const profile: UserProfile = {
      userId: user.id,
      stressor: input.stressor,
      goal: input.goal,
      mood: input.mood,
      planPreference: input.planPreference,
      onboardingCompleted: true,
      createdAt: now,
      updatedAt: now,
    };

    await this.pool.query(
      "INSERT INTO users (id, email, name, password_hash, created_at) VALUES ($1, $2, $3, $4, $5)",
      [user.id, user.email, user.name, user.passwordHash, user.createdAt],
    );
    await this.pool.query(
      "INSERT INTO profiles (user_id, stressor, goal, mood, plan_preference, onboarding_completed, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [
        profile.userId,
        profile.stressor,
        profile.goal,
        profile.mood,
        profile.planPreference,
        profile.onboardingCompleted,
        profile.createdAt,
        profile.updatedAt,
      ],
    );
    const memories = buildOnboardingMemories(input);
    for (const memory of memories) {
      await this.pool.query(
        "INSERT INTO memories (id, user_id, content, category, source, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [createId("mem"), user.id, memory.content, memory.category, memory.source, now, now],
      );
    }

    return { user, profile, subscription: null };
  }

  async findUserByEmail(email: string) {
    await this.ensureSchema();
    const result = await this.pool.query(
      "SELECT id, email, name, password_hash, created_at FROM users WHERE email = $1 LIMIT 1",
      [email.toLowerCase()],
    );
    if (!result.rowCount) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      passwordHash: row.password_hash,
      createdAt: new Date(row.created_at).toISOString(),
    } satisfies AppUser;
  }

  async findUserById(userId: string) {
    await this.ensureSchema();
    const result = await this.pool.query(
      "SELECT id, email, name, password_hash, created_at FROM users WHERE id = $1 LIMIT 1",
      [userId],
    );
    if (!result.rowCount) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      passwordHash: row.password_hash,
      createdAt: new Date(row.created_at).toISOString(),
    } satisfies AppUser;
  }

  async getUserRecord(userId: string): Promise<UserRecord | null> {
    await this.ensureSchema();
    const user = await this.findUserById(userId);
    if (!user) {
      return null;
    }

    const profileResult = await this.pool.query(
      "SELECT user_id, stressor, goal, mood, plan_preference, onboarding_completed, created_at, updated_at FROM profiles WHERE user_id = $1 LIMIT 1",
      [userId],
    );
    if (!profileResult.rowCount) {
      return null;
    }

    const row = profileResult.rows[0];
    const profile: UserProfile = {
      userId: row.user_id,
      stressor: row.stressor,
      goal: row.goal,
      mood: row.mood,
      planPreference: row.plan_preference,
      onboardingCompleted: row.onboarding_completed,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };

    const subscriptionResult = await this.pool.query(
      "SELECT * FROM subscriptions WHERE user_id = $1 LIMIT 1",
      [userId],
    );
    const subscription = subscriptionResult.rowCount
      ? ({
          userId: subscriptionResult.rows[0].user_id,
          planId: subscriptionResult.rows[0].plan_id,
          status: subscriptionResult.rows[0].status,
          provider: subscriptionResult.rows[0].provider,
          stripeCustomerId: subscriptionResult.rows[0].stripe_customer_id,
          stripeSubscriptionId: subscriptionResult.rows[0].stripe_subscription_id,
          trialEndsAt: subscriptionResult.rows[0].trial_ends_at
            ? new Date(subscriptionResult.rows[0].trial_ends_at).toISOString()
            : null,
          currentPeriodEnd: subscriptionResult.rows[0].current_period_end
            ? new Date(subscriptionResult.rows[0].current_period_end).toISOString()
            : null,
          createdAt: new Date(subscriptionResult.rows[0].created_at).toISOString(),
          updatedAt: new Date(subscriptionResult.rows[0].updated_at).toISOString(),
        } satisfies UserSubscription)
      : null;

    return { user, profile, subscription };
  }

  async updateProfile(userId: string, input: ProfileInput) {
    await this.ensureSchema();
    const updatedAt = new Date().toISOString();
    await this.pool.query(
      "UPDATE profiles SET stressor = $2, goal = $3, mood = $4, plan_preference = $5, onboarding_completed = $6, updated_at = $7 WHERE user_id = $1",
      [
        userId,
        input.stressor,
        input.goal,
        input.mood,
        input.planPreference,
        input.onboardingCompleted,
        updatedAt,
      ],
    );
    const record = await this.getUserRecord(userId);
    if (!record) {
      throw new Error("Profile not found.");
    }
    return record.profile;
  }

  async upsertSubscription(userId: string, input: SubscriptionInput) {
    await this.ensureSchema();
    const now = new Date().toISOString();
    const existing = await this.pool.query("SELECT user_id FROM subscriptions WHERE user_id = $1", [userId]);
    if (existing.rowCount) {
      await this.pool.query(
        "UPDATE subscriptions SET plan_id = $2, status = $3, provider = $4, stripe_customer_id = $5, stripe_subscription_id = $6, trial_ends_at = $7, current_period_end = $8, updated_at = $9 WHERE user_id = $1",
        [
          userId,
          input.planId,
          input.status,
          input.provider,
          input.stripeCustomerId ?? null,
          input.stripeSubscriptionId ?? null,
          input.trialEndsAt ?? null,
          input.currentPeriodEnd ?? null,
          now,
        ],
      );
    } else {
      await this.pool.query(
        "INSERT INTO subscriptions (user_id, plan_id, status, provider, stripe_customer_id, stripe_subscription_id, trial_ends_at, current_period_end, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        [
          userId,
          input.planId,
          input.status,
          input.provider,
          input.stripeCustomerId ?? null,
          input.stripeSubscriptionId ?? null,
          input.trialEndsAt ?? null,
          input.currentPeriodEnd ?? null,
          now,
          now,
        ],
      );
    }

    const record = await this.getUserRecord(userId);
    if (!record?.subscription) {
      throw new Error("Subscription write failed.");
    }
    return record.subscription;
  }

  async listConversations(userId: string) {
    await this.ensureSchema();
    const result = await this.pool.query(
      "SELECT id, user_id, title, created_at, updated_at FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC",
      [userId],
    );
    return result.rows.map(
      (row) =>
        ({
          id: row.id,
          userId: row.user_id,
          title: row.title,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString(),
        }) satisfies Conversation,
    );
  }

  async getConversation(userId: string, conversationId: string) {
    await this.ensureSchema();
    const conversationResult = await this.pool.query(
      "SELECT id, user_id, title, created_at, updated_at FROM conversations WHERE id = $1 AND user_id = $2 LIMIT 1",
      [conversationId, userId],
    );
    if (!conversationResult.rowCount) {
      return { conversation: null, messages: [] as StoredMessage[] };
    }

    const conversation: Conversation = {
      id: conversationResult.rows[0].id,
      userId: conversationResult.rows[0].user_id,
      title: conversationResult.rows[0].title,
      createdAt: new Date(conversationResult.rows[0].created_at).toISOString(),
      updatedAt: new Date(conversationResult.rows[0].updated_at).toISOString(),
    };

    const messageResult = await this.pool.query(
      "SELECT id, conversation_id, role, content, safety_level, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC",
      [conversationId],
    );

    const messages = messageResult.rows.map(
      (row) =>
        ({
          id: row.id,
          conversationId: row.conversation_id,
          role: row.role,
          content: row.content,
          safetyLevel: row.safety_level,
          createdAt: new Date(row.created_at).toISOString(),
        }) satisfies StoredMessage,
    );

    return { conversation, messages };
  }

  async createConversation(userId: string, title: string) {
    await this.ensureSchema();
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: createId("conv"),
      userId,
      title,
      createdAt: now,
      updatedAt: now,
    };

    await this.pool.query(
      "INSERT INTO conversations (id, user_id, title, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)",
      [conversation.id, conversation.userId, conversation.title, conversation.createdAt, conversation.updatedAt],
    );
    return conversation;
  }

  async appendMessages(userId: string, conversationId: string, messages: CreateMessageInput[]) {
    await this.ensureSchema();
    const conversation = await this.getConversation(userId, conversationId);
    if (!conversation.conversation) {
      throw new Error("Conversation not found.");
    }

    const now = new Date().toISOString();
    for (const message of messages) {
      await this.pool.query(
        "INSERT INTO messages (id, conversation_id, role, content, safety_level, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
        [createId("msg"), conversationId, message.role, message.content, message.safetyLevel, now],
      );
    }
    await this.pool.query("UPDATE conversations SET updated_at = $2 WHERE id = $1", [
      conversationId,
      now,
    ]);
    return this.getConversation(userId, conversationId);
  }

  async createCheckIn(userId: string, input: CheckInInput) {
    await this.ensureSchema();
    const createdAt = new Date().toISOString();
    const checkIn: CheckIn = {
      id: createId("checkin"),
      userId,
      ...input,
      createdAt,
    };
    await this.pool.query(
      "INSERT INTO check_ins (id, user_id, mood, energy, sleep_hours, stress_level, note, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [
        checkIn.id,
        checkIn.userId,
        checkIn.mood,
        checkIn.energy,
        checkIn.sleepHours,
        checkIn.stressLevel,
        checkIn.note,
        checkIn.createdAt,
      ],
    );
    return checkIn;
  }

  async createJournalEntry(userId: string, input: JournalInput) {
    await this.ensureSchema();
    const createdAt = new Date().toISOString();
    const entry: JournalEntry = {
      id: createId("journal"),
      userId,
      ...input,
      createdAt,
    };
    await this.pool.query(
      "INSERT INTO journal_entries (id, user_id, prompt, content, summary, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [entry.id, entry.userId, entry.prompt, entry.content, entry.summary, entry.createdAt],
    );
    return entry;
  }

  async listMemories(userId: string) {
    await this.ensureSchema();
    const result = await this.pool.query(
      "SELECT id, user_id, content, category, source, created_at, updated_at FROM memories WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 12",
      [userId],
    );
    return result.rows.map(
      (row) =>
        ({
          id: row.id,
          userId: row.user_id,
          content: row.content,
          category: row.category,
          source: row.source,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString(),
        }) satisfies MemoryItem,
    );
  }

  async remember(userId: string, input: MemoryInput[]) {
    await this.ensureSchema();
    const existing = await this.listMemories(userId);
    const created = mergeMemories(existing, input, userId);
    for (const memory of created) {
      await this.pool.query(
        "INSERT INTO memories (id, user_id, content, category, source, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [
          memory.id,
          memory.userId,
          memory.content,
          memory.category,
          memory.source,
          memory.createdAt,
          memory.updatedAt,
        ],
      );
    }
    return this.listMemories(userId);
  }

  async forgetMemory(userId: string, memoryId: string) {
    await this.ensureSchema();
    await this.pool.query("DELETE FROM memories WHERE id = $1 AND user_id = $2", [
      memoryId,
      userId,
    ]);
    return this.listMemories(userId);
  }

  async getDashboardData(userId: string): Promise<DashboardData> {
    await this.ensureSchema();
    const record = await this.getUserRecord(userId);
    if (!record) {
      throw new Error("User not found.");
    }

    const conversations = await this.listConversations(userId);
    const activeConversation = conversations[0] || null;
    const currentConversation = activeConversation
      ? await this.getConversation(userId, activeConversation.id)
      : { conversation: null, messages: [] as StoredMessage[] };
    const checkInsResult = await this.pool.query(
      "SELECT * FROM check_ins WHERE user_id = $1 ORDER BY created_at DESC LIMIT 7",
      [userId],
    );
    const journalResult = await this.pool.query(
      "SELECT * FROM journal_entries WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5",
      [userId],
    );
    const memories = await this.listMemories(userId);

    return {
      user: sanitizeUser(record.user),
      profile: record.profile,
      subscription: record.subscription,
      conversations,
      currentConversation,
      checkIns: checkInsResult.rows.map(
        (row) =>
          ({
            id: row.id,
            userId: row.user_id,
            mood: row.mood,
            energy: row.energy,
            sleepHours: Number(row.sleep_hours),
            stressLevel: row.stress_level,
            note: row.note,
            createdAt: new Date(row.created_at).toISOString(),
          }) satisfies CheckIn,
      ),
      journalEntries: journalResult.rows.map(
        (row) =>
          ({
            id: row.id,
            userId: row.user_id,
            prompt: row.prompt,
            content: row.content,
            summary: row.summary,
            createdAt: new Date(row.created_at).toISOString(),
          }) satisfies JournalEntry,
      ),
      memories,
    };
  }
}

const fileStore = new FileStore();
const postgresStore = process.env.DATABASE_URL ? new PostgresStore() : null;

function getStore() {
  return postgresStore ?? fileStore;
}

export const store = {
  createUser: (input: RegisterInput) => getStore().createUser(input),
  findUserByEmail: (email: string) => getStore().findUserByEmail(email),
  findUserById: (userId: string) => getStore().findUserById(userId),
  getUserRecord: (userId: string) => getStore().getUserRecord(userId),
  updateProfile: (userId: string, input: ProfileInput) => getStore().updateProfile(userId, input),
  upsertSubscription: (userId: string, input: SubscriptionInput) =>
    getStore().upsertSubscription(userId, input),
  listConversations: (userId: string) => getStore().listConversations(userId),
  getConversation: (userId: string, conversationId: string) =>
    getStore().getConversation(userId, conversationId),
  createConversation: (userId: string, title: string) =>
    getStore().createConversation(userId, title),
  appendMessages: (
    userId: string,
    conversationId: string,
    messages: CreateMessageInput[],
  ) => getStore().appendMessages(userId, conversationId, messages),
  createCheckIn: (userId: string, input: CheckInInput) => getStore().createCheckIn(userId, input),
  createJournalEntry: (userId: string, input: JournalInput) =>
    getStore().createJournalEntry(userId, input),
  listMemories: (userId: string) => getStore().listMemories(userId),
  remember: (userId: string, input: MemoryInput[]) => getStore().remember(userId, input),
  forgetMemory: (userId: string, memoryId: string) => getStore().forgetMemory(userId, memoryId),
  getDashboardData: (userId: string) => getStore().getDashboardData(userId),
};
