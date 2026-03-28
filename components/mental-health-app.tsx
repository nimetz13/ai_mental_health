"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { planCatalog } from "@/lib/config";
import {
  CheckIn,
  Conversation,
  JournalEntry,
  Mood,
  PlanId,
  SafetyLevel,
  StoredMessage,
  UserProfile,
  UserSubscription,
} from "@/lib/types";

type AppStage = "intro" | "profile" | "register" | "paywall" | "login" | "workspace";

type DashboardPayload = {
  dashboard: {
    user: {
      id: string;
      email: string;
      name: string;
    };
    profile: UserProfile | null;
    subscription: UserSubscription | null;
    conversations: Conversation[];
    currentConversation: {
      conversation: Conversation | null;
      messages: StoredMessage[];
    };
    checkIns: CheckIn[];
    journalEntries: JournalEntry[];
  };
  insights: {
    dominantMood: string;
    averageStress: number | null;
    averageEnergy: number | null;
    recommendation: string;
  };
  access: boolean;
};

type OnboardingState = {
  name: string;
  email: string;
  password: string;
  stressor: string;
  goal: string;
  mood: Mood;
  planPreference: PlanId;
};

const moodOptions: Mood[] = ["Spent", "Tense", "Restless", "Steady", "Hopeful"];

const reflectionPrompts: Record<Mood, string> = {
  Spent: "What would count as enough for tonight, even if the day feels unfinished?",
  Tense:
    "What are you trying to control right now, and what would soften if you released 10% of that effort?",
  Restless:
    "What feeling are you trying not to sit with, and what would make it safer to face for two minutes?",
  Steady: "What helped you stay regulated today, and how can you protect it tomorrow?",
  Hopeful: "What made this moment possible, and how can you repeat it on purpose?",
};

const quickResets = [
  "Take five slow exhales longer than your inhales.",
  "Write one thing to finish tomorrow instead of tonight.",
  "Put both feet on the floor and unclench your jaw for ten seconds.",
];

const introPoints = [
  "Designed for high-functioning professionals who quietly hit emotional overload after intense days.",
  "Uses onboarding to understand stressor, goal, mood, and buying intent before the first support session.",
  "Converts through a concrete recovery promise, not through generic wellness messaging.",
];

async function readJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

export function MentalHealthApp() {
  const [stage, setStage] = useState<AppStage>("intro");
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingState>({
    name: "",
    email: "",
    password: "",
    stressor: "Work burnout",
    goal: "Stop spiraling before bed",
    mood: "Tense",
    planPreference: "yearly",
  });
  const [login, setLogin] = useState({ email: "", password: "" });
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [journalEntry, setJournalEntry] = useState("");
  const [checkIn, setCheckIn] = useState({
    mood: "Tense" as Mood,
    energy: 4,
    sleepHours: 6,
    stressLevel: 7,
    note: "",
  });
  const [safetyState, setSafetyState] = useState<{
    level: SafetyLevel;
    title: string;
    description: string;
    resources: string[];
  } | null>(null);

  const currentProfile = dashboard?.dashboard.profile || null;
  const currentSubscription = dashboard?.dashboard.subscription || null;
  const hasAccess = dashboard?.access || false;

  useEffect(() => {
    void loadSession();
  }, []);

  useEffect(() => {
    const currentConversation = dashboard?.dashboard.currentConversation;
    if (!currentConversation) {
      return;
    }

    setSelectedConversationId(currentConversation.conversation?.id || null);
    setMessages(currentConversation.messages);
  }, [dashboard]);

  const reflectionPrompt = useMemo(() => {
    const mood = currentProfile?.mood || onboarding.mood;
    return reflectionPrompts[mood];
  }, [currentProfile?.mood, onboarding.mood]);

  async function loadSession() {
    try {
      setAuthLoading(true);
      const payload = await readJson<DashboardPayload>("/api/me");
      setDashboard(payload);
      setStage(payload.access ? "workspace" : "paywall");
      setCheckIn((current) => ({
        ...current,
        mood: payload.dashboard.profile?.mood || current.mood,
      }));
    } catch {
      setDashboard(null);
      setStage("intro");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await readJson("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(onboarding),
      });
      await loadSession();
      setStage("paywall");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await readJson("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(login),
      });
      await loadSession();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setDashboard(null);
    setMessages([]);
    setSelectedConversationId(null);
    setStage("intro");
  }

  async function activatePlan(planId: PlanId) {
    setLoading(true);
    setError(null);
    try {
      const payload = await readJson<{
        mode: "demo" | "stripe";
        checkoutUrl?: string;
      }>("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      if (payload.mode === "stripe" && payload.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
        return;
      }

      await loadSession();
      setStage("workspace");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to start subscription.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(messageOverride?: string) {
    const message = (messageOverride ?? chatDraft).trim();
    if (!message) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = await readJson<{
        conversation: Conversation;
        messages: StoredMessage[];
        safety: {
          level: SafetyLevel;
          title: string;
          description: string;
          resources: string[];
        };
      }>("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          conversationId: selectedConversationId,
        }),
      });

      setSelectedConversationId(payload.conversation.id);
      setMessages(payload.messages);
      setSafetyState(payload.safety);
      setChatDraft("");
      await loadSession();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Message failed.");
    } finally {
      setLoading(false);
    }
  }

  async function startConversation() {
    setLoading(true);
    setError(null);
    try {
      const payload = await readJson<{ conversation: Conversation }>("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New support session" }),
      });
      setSelectedConversationId(payload.conversation.id);
      setMessages([]);
      await loadSession();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not create session.");
    } finally {
      setLoading(false);
    }
  }

  async function openConversation(conversationId: string) {
    setLoading(true);
    setError(null);
    try {
      const payload = await readJson<{
        conversation: Conversation | null;
        messages: StoredMessage[];
      }>(`/api/conversations/${conversationId}`);
      setSelectedConversationId(payload.conversation?.id || null);
      setMessages(payload.messages);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Could not load conversation.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveCheckIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await readJson("/api/check-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkIn),
      });
      await loadSession();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Check-in failed.");
    } finally {
      setLoading(false);
    }
  }

  async function saveJournal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!journalEntry.trim()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await readJson("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: reflectionPrompt,
          content: journalEntry,
        }),
      });
      setJournalEntry("");
      await loadSession();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Journal save failed.");
    } finally {
      setLoading(false);
    }
  }

  function renderIntro() {
    return (
      <section className="marketing-grid">
        <div className="marketing-copy">
          <span className="kicker">Mental health AI product</span>
          <h1>North Star</h1>
          <p className="lede">
            A production-shaped recovery companion for emotionally overloaded professionals.
            It turns stress signals into a personalized support ritual, subscription flow,
            and safety-aware AI session.
          </p>
          <div className="point-list">
            {introPoints.map((point) => (
              <div className="point-card" key={point}>
                {point}
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <span className="eyebrow">Detailed plan</span>
          <h2>What is being built to beat the assignment</h2>
          <ol className="number-list">
            <li>Auth, session cookies, and persistent user profiles.</li>
            <li>Server-stored conversations, check-ins, journals, and subscription state.</li>
            <li>Safety-aware AI orchestration with crisis escalation logic.</li>
            <li>Stripe-ready monetization flow and webhook handling.</li>
            <li>Docker, CI/CD, health endpoint, and deploy-ready configuration.</li>
          </ol>
          <button className="primary" onClick={() => setStage("profile")} type="button">
            Start personalized onboarding
          </button>
          <button className="secondary" onClick={() => setStage("login")} type="button">
            I already have an account
          </button>
        </div>
      </section>
    );
  }

  function renderProfile() {
    return (
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
          setStage("register");
        }}
      >
        <span className="eyebrow">Onboarding</span>
        <h2>Personalize the recovery path</h2>
        <p className="muted">
          We only ask for signals that materially improve support quality and conversion:
          stressor, desired outcome, present mood, and plan intent.
        </p>

        <label>
          First name
          <input
            onChange={(event) => setOnboarding({ ...onboarding, name: event.target.value })}
            placeholder="Alex"
            required
            value={onboarding.name}
          />
        </label>

        <label>
          What brings you here tonight?
          <select
            onChange={(event) => setOnboarding({ ...onboarding, stressor: event.target.value })}
            value={onboarding.stressor}
          >
            <option>Work burnout</option>
            <option>Relationship stress</option>
            <option>Sleep and racing thoughts</option>
            <option>General anxiety spike</option>
          </select>
        </label>

        <label>
          What outcome would feel valuable right now?
          <select
            onChange={(event) => setOnboarding({ ...onboarding, goal: event.target.value })}
            value={onboarding.goal}
          >
            <option>Stop spiraling before bed</option>
            <option>Feel calmer in my body</option>
            <option>Make sense of my emotions</option>
            <option>Recover enough for tomorrow</option>
          </select>
        </label>

        <div>
          <span className="label">Current mood</span>
          <div className="chip-row">
            {moodOptions.map((mood) => (
              <button
                className={onboarding.mood === mood ? "chip active" : "chip"}
                key={mood}
                onClick={() => setOnboarding({ ...onboarding, mood })}
                type="button"
              >
                {mood}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label">Preferred plan</span>
          <div className="plan-grid">
            {(Object.keys(planCatalog) as PlanId[]).map((planId) => (
              <button
                className={onboarding.planPreference === planId ? "plan-card active" : "plan-card"}
                key={planId}
                onClick={() => setOnboarding({ ...onboarding, planPreference: planId })}
                type="button"
              >
                <strong>{planCatalog[planId].label}</strong>
                <span>
                  {planCatalog[planId].price} {planCatalog[planId].cadence}
                </span>
                <small>{planCatalog[planId].pitch}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="preview-box">
          <strong>Your promise</strong>
          <p>
            North Star will help you move through <strong>{onboarding.stressor.toLowerCase()}</strong>{" "}
            so you can <strong>{onboarding.goal.toLowerCase()}</strong>.
          </p>
        </div>

        <div className="button-row">
          <button className="secondary" onClick={() => setStage("intro")} type="button">
            Back
          </button>
          <button className="primary" type="submit">
            Continue to account
          </button>
        </div>
      </form>
    );
  }

  function renderRegister() {
    return (
      <form className="panel" onSubmit={handleRegister}>
        <span className="eyebrow">Registration</span>
        <h2>Create your account</h2>
        <p className="muted">
          Registration happens after personalized value is visible so intent is higher before the paywall.
        </p>

        <label>
          Email
          <input
            onChange={(event) => setOnboarding({ ...onboarding, email: event.target.value })}
            placeholder="alex@example.com"
            required
            type="email"
            value={onboarding.email}
          />
        </label>

        <label>
          Password
          <input
            minLength={8}
            onChange={(event) => setOnboarding({ ...onboarding, password: event.target.value })}
            placeholder="At least 8 characters"
            required
            type="password"
            value={onboarding.password}
          />
        </label>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="button-row">
          <button className="secondary" onClick={() => setStage("profile")} type="button">
            Back
          </button>
          <button className="primary" disabled={loading} type="submit">
            {loading ? "Creating account..." : "Save my recovery plan"}
          </button>
        </div>
      </form>
    );
  }

  function renderLogin() {
    return (
      <form className="panel" onSubmit={handleLogin}>
        <span className="eyebrow">Login</span>
        <h2>Resume your support plan</h2>

        <label>
          Email
          <input
            onChange={(event) => setLogin({ ...login, email: event.target.value })}
            required
            type="email"
            value={login.email}
          />
        </label>

        <label>
          Password
          <input
            onChange={(event) => setLogin({ ...login, password: event.target.value })}
            required
            type="password"
            value={login.password}
          />
        </label>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="button-row">
          <button className="secondary" onClick={() => setStage("intro")} type="button">
            Back
          </button>
          <button className="primary" disabled={loading} type="submit">
            {loading ? "Signing in..." : "Enter workspace"}
          </button>
        </div>
      </form>
    );
  }

  function renderPaywall() {
    const preferredPlan = currentProfile?.planPreference || onboarding.planPreference;
    return (
      <section className="marketing-grid">
        <div className="marketing-copy">
          <span className="kicker">Monetization flow</span>
          <h2 className="section-title">Your support system is configured</h2>
          <p className="lede">
            The monetization point is tied to a concrete outcome: nightly decompression,
            guided emotional support, and a calmer transition into the next day.
          </p>
          <div className="point-list">
            <div className="point-card">Unlimited safety-aware AI support sessions.</div>
            <div className="point-card">
              Saved history, recurring mood check-ins, and reflection memory.
            </div>
            <div className="point-card">7-day free trial before paid conversion.</div>
          </div>
        </div>

        <div className="panel">
          <span className="eyebrow">Choose plan</span>
          <h2>Start the subscription</h2>
          <div className="plan-grid">
            {(Object.keys(planCatalog) as PlanId[]).map((planId) => (
              <button
                className={preferredPlan === planId ? "plan-card active" : "plan-card"}
                key={planId}
                onClick={() => setOnboarding({ ...onboarding, planPreference: planId })}
                type="button"
              >
                <strong>{planCatalog[planId].label}</strong>
                <span>
                  {planCatalog[planId].price} {planCatalog[planId].cadence}
                </span>
                <small>{planCatalog[planId].pitch}</small>
              </button>
            ))}
          </div>
          {error ? <div className="error-banner">{error}</div> : null}
          <button
            className="primary full-width"
            disabled={loading}
            onClick={() => activatePlan(preferredPlan)}
            type="button"
          >
            {loading ? "Opening checkout..." : "Start 7-day free trial"}
          </button>
        </div>
      </section>
    );
  }

  function renderWorkspace() {
    return (
      <section className="workspace">
        <header className="workspace-header">
          <div>
            <span className="kicker">Production workspace</span>
            <h2>Welcome back, {dashboard?.dashboard.user.name}</h2>
            <p className="muted">
              Goal: <strong>{currentProfile?.goal}</strong>. Dominant mood:{" "}
              <strong>{dashboard?.insights.dominantMood}</strong>.
            </p>
          </div>
          <div className="button-row">
            <button className="secondary" onClick={() => void startConversation()} type="button">
              New support session
            </button>
            <button className="ghost" onClick={() => void handleLogout()} type="button">
              Logout
            </button>
          </div>
        </header>

        {!hasAccess && (
          <div className="warning-banner">
            Subscription access is required to unlock the full support workspace.
            <button className="primary" onClick={() => setStage("paywall")} type="button">
              Activate plan
            </button>
          </div>
        )}

        <div className="workspace-grid">
          <aside className="workspace-card sidebar">
            <div className="card-heading">
              <h3>Support sessions</h3>
              <p>Persistent sessions make the AI feel like an actual product, not a stateless chatbot.</p>
            </div>
            <div className="session-list">
              {dashboard?.dashboard.conversations.length ? (
                dashboard.dashboard.conversations.map((conversation) => (
                  <button
                    className={
                      selectedConversationId === conversation.id
                        ? "session-item active"
                        : "session-item"
                    }
                    key={conversation.id}
                    onClick={() => void openConversation(conversation.id)}
                    type="button"
                  >
                    <strong>{conversation.title}</strong>
                    <span>{new Date(conversation.updatedAt).toLocaleString()}</span>
                  </button>
                ))
              ) : (
                <div className="empty-state">No saved sessions yet. Start with one honest message.</div>
              )}
            </div>

            <div className="insight-box">
              <strong>Subscription</strong>
              <p>
                {currentSubscription
                  ? `${currentSubscription.status} on ${planCatalog[currentSubscription.planId].label}`
                  : "No active plan"}
              </p>
            </div>

            <div className="insight-box">
              <strong>AI recommendation</strong>
              <p>{dashboard?.insights.recommendation}</p>
            </div>
          </aside>

          <article className="workspace-card">
            <div className="card-heading">
              <h3>AI support chat</h3>
              <p>Safety-aware emotional support with persistence, context, and guided next steps.</p>
            </div>

            {safetyState ? (
              <div className={safetyState.level === "critical" ? "critical-banner" : "info-banner"}>
                <strong>{safetyState.title}</strong>
                <p>{safetyState.description}</p>
                {safetyState.resources.map((resource) => (
                  <div key={resource}>{resource}</div>
                ))}
              </div>
            ) : null}

            <div className="chat-log">
              {messages.length ? (
                messages.map((message) => (
                  <div
                    className={message.role === "user" ? "bubble user" : "bubble assistant"}
                    key={message.id}
                  >
                    {message.content}
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  Start with what happened, what feeling is strongest, or what would help in the next ten minutes.
                </div>
              )}
            </div>

            <div className="chip-row">
              <button
                className="chip"
                onClick={() => void sendMessage("I need help calming down in the next five minutes.")}
                type="button"
              >
                5-minute calm plan
              </button>
              <button
                className="chip"
                onClick={() => void sendMessage("Help me separate facts, fears, and tasks.")}
                type="button"
              >
                Sort the spiral
              </button>
              <button
                className="chip"
                onClick={() =>
                  void sendMessage("I want to end today without carrying all of this into bed.")
                }
                type="button"
              >
                Better night reset
              </button>
            </div>

            <form
              className="chat-input"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage();
              }}
            >
              <input
                onChange={(event) => setChatDraft(event.target.value)}
                placeholder="Tell the AI what feels heavy right now..."
                value={chatDraft}
              />
              <button className="primary" disabled={loading || !hasAccess} type="submit">
                {loading ? "Sending..." : "Send"}
              </button>
            </form>
          </article>

          <div className="workspace-rail">
            <article className="workspace-card">
              <div className="card-heading">
                <h3>Daily check-in</h3>
                <p>Turns the app into a longitudinal product with insight loops and retention.</p>
              </div>
              <form className="mini-form" onSubmit={saveCheckIn}>
                <label>
                  Mood
                  <select
                    onChange={(event) =>
                      setCheckIn({ ...checkIn, mood: event.target.value as Mood })
                    }
                    value={checkIn.mood}
                  >
                    {moodOptions.map((mood) => (
                      <option key={mood}>{mood}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Energy / 10
                  <input
                    max={10}
                    min={1}
                    onChange={(event) => setCheckIn({ ...checkIn, energy: Number(event.target.value) })}
                    type="number"
                    value={checkIn.energy}
                  />
                </label>
                <label>
                  Sleep hours
                  <input
                    max={12}
                    min={0}
                    onChange={(event) =>
                      setCheckIn({ ...checkIn, sleepHours: Number(event.target.value) })
                    }
                    step="0.5"
                    type="number"
                    value={checkIn.sleepHours}
                  />
                </label>
                <label>
                  Stress / 10
                  <input
                    max={10}
                    min={1}
                    onChange={(event) =>
                      setCheckIn({ ...checkIn, stressLevel: Number(event.target.value) })
                    }
                    type="number"
                    value={checkIn.stressLevel}
                  />
                </label>
                <label>
                  Optional note
                  <textarea
                    onChange={(event) => setCheckIn({ ...checkIn, note: event.target.value })}
                    placeholder="What spiked your stress today?"
                    value={checkIn.note}
                  />
                </label>
                <button className="primary" disabled={loading || !hasAccess} type="submit">
                  Save check-in
                </button>
              </form>
            </article>

            <article className="workspace-card">
              <div className="card-heading">
                <h3>Guided journal</h3>
                <p>The prompt is chosen from onboarding and current mood, so the blank page never blocks the user.</p>
              </div>
              <div className="prompt-box">
                <strong>{reflectionPrompt}</strong>
              </div>
              <form className="mini-form" onSubmit={saveJournal}>
                <textarea
                  onChange={(event) => setJournalEntry(event.target.value)}
                  placeholder="Write without editing yourself for two minutes."
                  value={journalEntry}
                />
                <button className="primary" disabled={loading || !hasAccess} type="submit">
                  Save reflection
                </button>
              </form>
            </article>

            <article className="workspace-card">
              <div className="card-heading">
                <h3>Recovery system</h3>
                <p>The product sells a repeatable decompression ritual, not a generic chat experience.</p>
              </div>
              <div className="reset-list">
                {quickResets.map((reset) => (
                  <div className="reset-item" key={reset}>
                    {reset}
                  </div>
                ))}
              </div>
              <div className="insight-box">
                <strong>Average stress</strong>
                <p>{dashboard?.insights.averageStress ?? "No data yet"} / 10</p>
              </div>
              <div className="insight-box">
                <strong>Average energy</strong>
                <p>{dashboard?.insights.averageEnergy ?? "No data yet"} / 10</p>
              </div>
            </article>
          </div>
        </div>

        <section className="history-grid">
          <article className="workspace-card">
            <div className="card-heading">
              <h3>Recent journal summaries</h3>
            </div>
            <div className="history-list">
              {dashboard?.dashboard.journalEntries.length ? (
                dashboard.dashboard.journalEntries.map((entry) => (
                  <div className="history-item" key={entry.id}>
                    <strong>{entry.prompt}</strong>
                    <p>{entry.summary}</p>
                  </div>
                ))
              ) : (
                <div className="empty-state">No reflections saved yet.</div>
              )}
            </div>
          </article>

          <article className="workspace-card">
            <div className="card-heading">
              <h3>Recent check-ins</h3>
            </div>
            <div className="history-list">
              {dashboard?.dashboard.checkIns.length ? (
                dashboard.dashboard.checkIns.map((entry) => (
                  <div className="history-item" key={entry.id}>
                    <strong>
                      {entry.mood} | Stress {entry.stressLevel}/10 | Energy {entry.energy}/10
                    </strong>
                    <p>{entry.note || "No note provided."}</p>
                  </div>
                ))
              ) : (
                <div className="empty-state">No check-ins saved yet.</div>
              )}
            </div>
          </article>
        </section>
      </section>
    );
  }

  if (authLoading) {
    return (
      <main className="shell">
        <div className="panel loading-panel">Loading product state...</div>
      </main>
    );
  }

  return (
    <main className="shell">
      {stage === "intro" && renderIntro()}
      {stage === "profile" && renderProfile()}
      {stage === "register" && renderRegister()}
      {stage === "login" && renderLogin()}
      {stage === "paywall" && renderPaywall()}
      {stage === "workspace" && renderWorkspace()}
    </main>
  );
}
