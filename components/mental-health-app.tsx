"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { planCatalog } from "@/lib/config";
import {
  CheckIn,
  Conversation,
  JournalEntry,
  MemoryItem,
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
    memories: MemoryItem[];
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

type WorkspaceTool = "checkin" | "journal" | "memory" | "insights";
type BeastState = "resting" | "listening" | "speaking";

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
  "Uses onboarding to understand stressor, goal, and mood before the first support session.",
  "Converts through a concrete recovery promise, not through generic wellness messaging.",
];

const stressorOptions = [
  "Work burnout",
  "General anxiety spike",
  "Sleep and racing thoughts",
  "Relationship stress",
  "Panic or overwhelm",
  "Loneliness and disconnection",
  "Low self-worth and harsh self-talk",
  "Grief or emotional loss",
  "Decision fatigue and overthinking",
  "Major life change",
  "Motivation crash",
  "Stress from caregiving or family pressure",
];

const goalOptions = [
  "Stop spiraling before bed",
  "Feel calmer in my body",
  "Make sense of my emotions",
  "Recover enough for tomorrow",
  "Reduce panic faster",
  "Handle triggers without shutting down",
  "Be kinder to myself",
  "Feel less alone with what I am carrying",
  "Get unstuck and move again",
  "Build a healthier coping rhythm",
];

function buildPromise(profile: Pick<OnboardingState, "stressor" | "goal">) {
  const stressorCopy: Record<string, string> = {
    "Work burnout": "recover after draining workdays without carrying all that weight alone",
    "Relationship stress": "feel steadier and more grounded during relationship tension",
    "Sleep and racing thoughts": "build a calmer shutdown ritual when your mind does not want to stop",
    "General anxiety spike": "understand and manage anxiety spikes before they take over your day",
    "Panic or overwhelm": "move through panic and overwhelm with more structure and less fear",
    "Loneliness and disconnection": "feel less isolated when life feels emotionally far away",
    "Low self-worth and harsh self-talk": "soften self-criticism and rebuild a steadier inner voice",
    "Grief or emotional loss": "carry grief with more support and less emotional shutdown",
    "Decision fatigue and overthinking": "quiet mental overload when every choice feels heavy",
    "Major life change": "stay grounded while life feels uncertain or in transition",
    "Motivation crash": "regain traction when everything feels harder than it should",
    "Stress from caregiving or family pressure":
      "hold family and caregiving stress without losing yourself in it",
  };

  const goalCopy: Record<string, string> = {
    "Stop spiraling before bed": "so over time you can interrupt spirals earlier and feel more in control",
    "Feel calmer in my body": "so your nervous system can return to calm faster and more reliably",
    "Make sense of my emotions": "so your emotions feel clearer, easier to name, and less overwhelming",
    "Recover enough for tomorrow": "so stressful periods stop draining every following day",
    "Reduce panic faster": "so panic loses intensity faster and stops running the whole moment",
    "Handle triggers without shutting down": "so triggers feel more manageable and less consuming over time",
    "Be kinder to myself": "so your inner dialogue becomes steadier, softer, and less punishing",
    "Feel less alone with what I am carrying":
      "so difficult emotions feel more shareable and less isolating",
    "Get unstuck and move again": "so low-energy periods stop turning into longer emotional stalls",
    "Build a healthier coping rhythm":
      "so you rely less on survival habits and more on support that actually helps",
  };

  return `North Star helps you ${stressorCopy[profile.stressor] || profile.stressor.toLowerCase()} ${goalCopy[profile.goal] || `so you can ${profile.goal.toLowerCase()}`}.`;
}

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
  const [memories, setMemories] = useState<MemoryItem[]>([]);
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
  const [activeTool, setActiveTool] = useState<WorkspaceTool>("checkin");
  const [introExpanded, setIntroExpanded] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [beastState, setBeastState] = useState<BeastState>("resting");
  const [beastLine, setBeastLine] = useState("I am here. Tell me what feels heaviest right now.");
  const [voiceReady, setVoiceReady] = useState(false);
  const spokenMessageIds = useRef<Set<string>>(new Set());

  const currentProfile = dashboard?.dashboard.profile || null;
  const currentSubscription = dashboard?.dashboard.subscription || null;
  const hasAccess = dashboard?.access || false;

  useEffect(() => {
    void loadSession();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("authError");
    if (!authError) {
      return;
    }

    setError(authError);
    params.delete("authError");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  useEffect(() => {
    const currentConversation = dashboard?.dashboard.currentConversation;
    if (!currentConversation) {
      return;
    }

    setSelectedConversationId(currentConversation.conversation?.id || null);
    setMessages(currentConversation.messages);
    setMemories(dashboard.dashboard.memories);
  }, [dashboard]);

  const reflectionPrompt = useMemo(() => {
    const mood = currentProfile?.mood || onboarding.mood;
    return reflectionPrompts[mood];
  }, [currentProfile?.mood, onboarding.mood]);

  const arrivalQuestion = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 5) {
      return "What is weighing on you right now?";
    }
    if (hour < 17) {
      return "What brings you here today?";
    }
    return "What brings you here tonight?";
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const loadVoices = () => {
      setVoiceReady(window.speechSynthesis.getVoices().length > 0);
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  useEffect(() => {
    if (loading) {
      setBeastState("listening");
      setBeastLine("I am listening closely and shaping the next response.");
      return;
    }

    if (beastState === "listening") {
      setBeastState("resting");
    }
  }, [loading, beastState]);

  useEffect(() => {
    const lastAssistantMessage = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");

    if (!lastAssistantMessage) {
      return;
    }

    setBeastLine(lastAssistantMessage.content);

    if (
      !voiceEnabled ||
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      spokenMessageIds.current.has(lastAssistantMessage.id)
    ) {
      setBeastState("resting");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(lastAssistantMessage.content);
    const preferredVoice = window.speechSynthesis
      .getVoices()
      .find((voice) => /en-US|en_GB/i.test(`${voice.lang}`) && /google|samantha|daniel|serena|alloy/i.test(`${voice.name}`))
      || window.speechSynthesis.getVoices().find((voice) => /^en/i.test(voice.lang))
      || null;

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.pitch = 0.72;
    utterance.rate = 0.92;
    utterance.onstart = () => setBeastState("speaking");
    utterance.onend = () => {
      spokenMessageIds.current.add(lastAssistantMessage.id);
      setBeastState("resting");
    };
    utterance.onerror = () => {
      spokenMessageIds.current.add(lastAssistantMessage.id);
      setBeastState("resting");
    };

    window.speechSynthesis.speak(utterance);

    return () => {
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;
    };
  }, [messages, voiceEnabled]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const beastStatus = useMemo(() => {
    if (beastState === "speaking") {
      return "Speaking";
    }

    if (beastState === "listening") {
      return "Listening";
    }

    return voiceEnabled ? "Resting" : "Muted";
  }, [beastState, voiceEnabled]);

  const companionStageClass = useMemo(() => {
    if (beastState === "speaking") {
      return "companion-stage speaking";
    }

    if (beastState === "listening") {
      return "companion-stage listening";
    }

    return "companion-stage";
  }, [beastState]);

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
      setOnboarding((current) => ({
        ...current,
        planPreference: payload.dashboard.profile?.planPreference || current.planPreference,
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

  function handleGoogleAuth() {
    setError(null);

    if (!onboarding.name || !onboarding.stressor || !onboarding.goal || !onboarding.mood) {
      setError("Finish onboarding details before continuing with Google.");
      return;
    }

    const params = new URLSearchParams({
      name: onboarding.name,
      stressor: onboarding.stressor,
      goal: onboarding.goal,
      mood: onboarding.mood,
      planPreference: onboarding.planPreference,
    });

    window.location.href = `/api/auth/google/start?${params.toString()}`;
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

  async function forgetMemory(memoryId: string) {
    setLoading(true);
    setError(null);
    try {
      const payload = await readJson<{ memories: MemoryItem[] }>("/api/memories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memoryId }),
      });
      setMemories(payload.memories);
      await loadSession();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not remove memory.");
    } finally {
      setLoading(false);
    }
  }

  function renderIntro() {
    return (
      <section className="marketing-grid">
        <div className="marketing-copy">
          <span className="kicker">Emotional support that remembers you</span>
          <h1>North Star</h1>
          <p className="lede">
            Your AI companion for stress, overwhelm, anxiety, and emotional recovery.
            North Star helps you feel understood quickly, build steadier coping habits, and
            come back to a support system that actually remembers what matters.
          </p>
          <div className="hero-bullets">
            <div className="hero-chip">Personalized onboarding</div>
            <div className="hero-chip">Memory-aware AI support</div>
            <div className="hero-chip">Check-ins, journal, and recovery tools</div>
          </div>
          <div className="button-row intro-actions">
            <button className="primary" onClick={() => setStage("profile")} type="button">
              Start your support plan
            </button>
            <button className="secondary" onClick={() => setStage("login")} type="button">
              I already have an account
            </button>
          </div>
        </div>

        <div className="panel intro-panel">
          <span className="eyebrow">How it works</span>
          <h2>Support that gets better as it gets to know you</h2>
          <div className="point-list">
            {introPoints.map((point) => (
              <div className="point-card" key={point}>
                {point}
              </div>
            ))}
          </div>

          <button
            className={introExpanded ? "secondary expanded-toggle" : "secondary expanded-toggle"}
            onClick={() => setIntroExpanded((current) => !current)}
            type="button"
          >
            {introExpanded ? "Hide product details" : "See what powers North Star"}
          </button>

          <div className={introExpanded ? "intro-drawer expanded" : "intro-drawer"}>
            <div className="intro-drawer-inner">
              <div className="drawer-card">
                <strong>Personalized support flow</strong>
                <p>Onboarding tunes the experience around the user&apos;s stressor, goal, and mood before the first session begins.</p>
              </div>
              <div className="drawer-card">
                <strong>Long-term memory</strong>
                <p>North Star stores important patterns, coping clues, and relevant personal context across conversations.</p>
              </div>
              <div className="drawer-card">
                <strong>Safety-aware AI</strong>
                <p>The assistant prioritizes grounding during elevated distress and shifts to crisis-safe guidance when risk language appears.</p>
              </div>
              <div className="drawer-card">
                <strong>Paid product loop</strong>
                <p>Chat, check-ins, journaling, and memory create a repeatable support ritual instead of a one-off conversation.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  function renderProfile() {
    return (
      <form
        className="panel narrow-panel"
        onSubmit={(event) => {
          event.preventDefault();
          setStage("register");
        }}
      >
        <span className="eyebrow">Onboarding</span>
        <h2>Personalize the recovery path</h2>
        <p className="muted">
          We only ask for signals that materially improve support quality: stressor,
          desired outcome, and present mood.
        </p>

        <label>
          How should we address you?
          <input
            onChange={(event) => setOnboarding({ ...onboarding, name: event.target.value })}
            placeholder="Alex"
            required
            value={onboarding.name}
          />
        </label>

        <label>
          {arrivalQuestion}
          <select
            onChange={(event) => setOnboarding({ ...onboarding, stressor: event.target.value })}
            value={onboarding.stressor}
          >
            {stressorOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>

        <label>
          What outcome would feel valuable right now?
          <select
            onChange={(event) => setOnboarding({ ...onboarding, goal: event.target.value })}
            value={onboarding.goal}
          >
            {goalOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
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

        <div className="preview-box">
          <strong>Your promise</strong>
          <p>{buildPromise(onboarding)}</p>
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
      <form className="panel narrow-panel" onSubmit={handleRegister}>
        <span className="eyebrow">Registration</span>
        <h2>Create your account</h2>
        <p className="muted">
          Registration happens after personalized value is visible so intent is higher before the paywall.
        </p>

        <button className="google-button" disabled={loading} onClick={handleGoogleAuth} type="button">
          Continue with Google
        </button>

        <div className="divider">
          <span>or use email</span>
        </div>

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
      <form className="panel narrow-panel" onSubmit={handleLogin}>
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
    const preferredPlan = onboarding.planPreference;
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
                <div className="plan-topline">
                  <strong>{planCatalog[planId].label}</strong>
                  {planCatalog[planId].badge ? <span className="plan-badge">{planCatalog[planId].badge}</span> : null}
                </div>
                <span>
                  {planCatalog[planId].price} {planCatalog[planId].cadence}
                </span>
                {planCatalog[planId].originalPrice ? (
                  <small className="plan-strike">{planCatalog[planId].originalPrice}</small>
                ) : null}
                <small>{planCatalog[planId].pitch}</small>
                {planCatalog[planId].note ? <small>{planCatalog[planId].note}</small> : null}
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

            <div className={companionStageClass}>
              <div className="companion-halo" />
              <div className="companion-face" aria-hidden="true">
                <div className="horn horn-left" />
                <div className="horn horn-right" />
                <div className="ear ear-left" />
                <div className="ear ear-right" />
                <div className="face-core">
                  <div className="eye eye-left">
                    <span className="eye-shine" />
                  </div>
                  <div className="eye eye-right">
                    <span className="eye-shine" />
                  </div>
                  <div className="snout">
                    <div className="snout-glow" />
                    <div className="nose" />
                    <div className="mouth">
                      <div className="mouth-inner" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="companion-copy">
                <div className="companion-topline">
                  <span className="companion-badge">North Star Beast</span>
                  <button
                    className={voiceEnabled ? "ghost small-button voice-toggle active" : "ghost small-button voice-toggle"}
                    onClick={() => {
                      if (voiceEnabled && typeof window !== "undefined" && "speechSynthesis" in window) {
                        window.speechSynthesis.cancel();
                      }
                      setVoiceEnabled((current) => !current);
                      setBeastState("resting");
                    }}
                    type="button"
                  >
                    {voiceEnabled ? "Voice on" : "Voice off"}
                  </button>
                </div>
                <strong>{beastStatus}</strong>
                <p>{beastLine}</p>
                <small>
                  {voiceReady
                    ? "Replies are voiced automatically to make the session feel more alive."
                    : "Voice becomes available once the browser exposes a speech voice."}
                </small>
              </div>
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
            <article className="workspace-card tool-card">
              <div className="card-heading">
                <h3>Companion tools</h3>
                <p>Interactive support tools without the giant right-side scroll.</p>
              </div>

              <div className="tool-metrics">
                <div className="metric-pill">
                  <strong>{dashboard?.insights.averageStress ?? "?"}</strong>
                  <span>Avg stress</span>
                </div>
                <div className="metric-pill">
                  <strong>{dashboard?.insights.averageEnergy ?? "?"}</strong>
                  <span>Avg energy</span>
                </div>
                <div className="metric-pill">
                  <strong>{memories.length}</strong>
                  <span>Saved memories</span>
                </div>
              </div>

              <div className="tool-tabs">
                <button
                  className={activeTool === "checkin" ? "tool-tab active" : "tool-tab"}
                  onClick={() => setActiveTool("checkin")}
                  type="button"
                >
                  Check-in
                </button>
                <button
                  className={activeTool === "journal" ? "tool-tab active" : "tool-tab"}
                  onClick={() => setActiveTool("journal")}
                  type="button"
                >
                  Journal
                </button>
                <button
                  className={activeTool === "memory" ? "tool-tab active" : "tool-tab"}
                  onClick={() => setActiveTool("memory")}
                  type="button"
                >
                  Memory
                </button>
                <button
                  className={activeTool === "insights" ? "tool-tab active" : "tool-tab"}
                  onClick={() => setActiveTool("insights")}
                  type="button"
                >
                  Insights
                </button>
              </div>

              <div className="tool-panel">
                {activeTool === "checkin" && (
                  <div className="tool-content">
                    <div className="card-heading compact-heading">
                      <h3>Daily check-in</h3>
                      <p>Log today so the product can spot patterns over time.</p>
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
                      <div className="mini-grid">
                        <label>
                          Energy / 10
                          <input
                            max={10}
                            min={1}
                            onChange={(event) =>
                              setCheckIn({ ...checkIn, energy: Number(event.target.value) })
                            }
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
                      </div>
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
                          placeholder="What pushed your nervous system today?"
                          value={checkIn.note}
                        />
                      </label>
                      <button className="primary" disabled={loading || !hasAccess} type="submit">
                        Save check-in
                      </button>
                    </form>
                  </div>
                )}

                {activeTool === "journal" && (
                  <div className="tool-content">
                    <div className="card-heading compact-heading">
                      <h3>Guided journal</h3>
                      <p>The prompt adapts to mood so the blank page never wins.</p>
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
                  </div>
                )}

                {activeTool === "memory" && (
                  <div className="tool-content">
                    <div className="card-heading compact-heading">
                      <h3>What North Star remembers</h3>
                      <p>Long-term context from onboarding, chat, and reflection.</p>
                    </div>
                    <div className="history-list">
                      {memories.length ? (
                        memories.map((memory) => (
                          <div className="memory-item" key={memory.id}>
                            <div className="memory-copy">
                              <strong>{memory.content}</strong>
                              <span>
                                {memory.category} • {memory.source}
                              </span>
                            </div>
                            <button
                              className="ghost small-button"
                              onClick={() => void forgetMemory(memory.id)}
                              type="button"
                            >
                              Forget
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="empty-state">
                          Important patterns and personal context from conversations will appear here.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTool === "insights" && (
                  <div className="tool-content">
                    <div className="card-heading compact-heading">
                      <h3>Recovery system</h3>
                      <p>The product sells a repeatable decompression ritual, not just chat.</p>
                    </div>
                    <div className="reset-list">
                      {quickResets.map((reset) => (
                        <div className="reset-item" key={reset}>
                          {reset}
                        </div>
                      ))}
                    </div>
                    <div className="insight-box">
                      <strong>AI recommendation</strong>
                      <p>{dashboard?.insights.recommendation}</p>
                    </div>
                  </div>
                )}
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
