"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type AppStage = "intro" | "profile" | "register" | "paywall" | "workspace";
type Mood = "Spent" | "Tense" | "Restless" | "Steady" | "Hopeful";

type Profile = {
  name: string;
  email: string;
  stressor: string;
  goal: string;
  mood: Mood;
  plan: "monthly" | "yearly";
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

const storageKey = "north-star-profile";

const introCards = [
  {
    eyebrow: "Built For",
    title: "High-functioning people who are emotionally overloaded",
    text: "The product focuses on professionals who look fine from the outside but feel mentally flooded, tired, and stuck in loops after work.",
  },
  {
    eyebrow: "Core Promise",
    title: "From overwhelm to the next calm step in under five minutes",
    text: "Onboarding personalizes the support path, then the app routes the user into AI chat, quick resets, and reflection prompts.",
  },
  {
    eyebrow: "Why Paid",
    title: "Users pay for consistency, personalization, and momentum",
    text: "The paywall appears after the user feels understood and sees a concrete recovery plan, not before the value is visible.",
  },
];

const moodOptions: Mood[] = ["Spent", "Tense", "Restless", "Steady", "Hopeful"];

const starterMessages: Record<Mood, string> = {
  Spent: "I have nothing left after work and I still feel guilty for not doing more.",
  Tense: "My body is wired and I keep replaying stressful conversations.",
  Restless: "I am doom-scrolling instead of actually recovering.",
  Steady: "I feel okay, but I want to keep my stress from building up tonight.",
  Hopeful: "I want to protect this good moment and make tomorrow lighter too.",
};

const quickResets = [
  {
    title: "90-second nervous system reset",
    steps: "Unclench your jaw. Drop your shoulders. Exhale longer than you inhale five times.",
  },
  {
    title: "Work-to-home transition",
    steps: "Write down one unfinished task, one thing that went well, and one thing future-you can ignore tonight.",
  },
  {
    title: "Overthinking interrupt",
    steps: "Name the thought. Ask whether it is a fact, a fear, or a task. Only tasks need action right now.",
  },
];

function createInitialMessages(profile?: Partial<Profile>): ChatMessage[] {
  return [
    {
      id: "welcome",
      role: "assistant",
      text: `Hi${profile?.name ? ` ${profile.name}` : ""}. I am your North Star guide. We will keep this practical and gentle. What happened today, and what feels heaviest right now?`,
    },
  ];
}

export function MentalHealthApp() {
  const [stage, setStage] = useState<AppStage>("intro");
  const [profile, setProfile] = useState<Profile>({
    name: "",
    email: "",
    stressor: "Work burnout",
    goal: "Stop spiraling before bed",
    mood: "Tense",
    plan: "yearly",
  });
  const [messages, setMessages] = useState<ChatMessage[]>(createInitialMessages());
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [journalEntry, setJournalEntry] = useState("");
  const [completedPlan, setCompletedPlan] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return;
    }

    const saved = JSON.parse(raw) as Profile;
    setProfile(saved);
    setMessages(createInitialMessages(saved));
    setStage("workspace");
  }, []);

  useEffect(() => {
    if (stage === "workspace") {
      window.localStorage.setItem(storageKey, JSON.stringify(profile));
    }
  }, [profile, stage]);

  const reflectionPrompt = useMemo(() => {
    if (profile.mood === "Spent") {
      return "What would count as enough for tonight, even if the day felt incomplete?";
    }
    if (profile.mood === "Tense") {
      return "What are you trying to control right now, and what would soften if you released 10% of that effort?";
    }
    if (profile.mood === "Restless") {
      return "What feeling are you trying not to sit with, and what would make it safer to face for two minutes?";
    }
    if (profile.mood === "Hopeful") {
      return "What helped you feel lighter today, and how can you repeat it tomorrow on purpose?";
    }
    return "What do you want more of this week: calm, clarity, connection, or energy?";
  }, [profile.mood]);

  function continueFromIntro() {
    setStage("profile");
  }

  function completeProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessages(createInitialMessages(profile));
    setStage("register");
  }

  function completeRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStage("paywall");
  }

  function activatePlan() {
    setCompletedPlan(profile.plan);
    setStage("workspace");
    window.localStorage.setItem(storageKey, JSON.stringify(profile));
  }

  async function sendMessage(messageText?: string) {
    const content = (messageText ?? draft).trim();
    if (!content || isSending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: content,
    };

    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: content,
          profile,
        }),
      });

      const data = (await response.json()) as { reply?: string };
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text:
            data.reply ||
            "I am here with you. Tell me what feels hardest about this moment, and we will make it smaller together.",
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: "The connection dropped, but we can still slow things down together. What is the strongest feeling in your body right now?",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <span className="kicker">AI Product Engineer Test Assignment</span>
          <h1>North Star</h1>
          <p className="lede">
            A paid AI mental wellness companion for emotionally overloaded professionals who
            need fast support after stressful days.
          </p>
          <div className="value-grid">
            <div>
              <strong>Target user</strong>
              <p>Knowledge workers with burnout signals, rumination, sleep-disrupting stress.</p>
            </div>
            <div>
              <strong>Problem</strong>
              <p>They need immediate emotional decompression, not another generic wellness feed.</p>
            </div>
            <div>
              <strong>Value proposition</strong>
              <p>Personalized onboarding turns directly into support, reflection, and calming action.</p>
            </div>
          </div>
        </div>
        <div className="hero-panel">
          {stage === "intro" && (
            <div className="card-stack">
              {introCards.map((card) => (
                <article className="feature-card" key={card.title}>
                  <span>{card.eyebrow}</span>
                  <h2>{card.title}</h2>
                  <p>{card.text}</p>
                </article>
              ))}
              <button className="primary" onClick={continueFromIntro}>
                Start onboarding
              </button>
            </div>
          )}

          {stage === "profile" && (
            <form className="panel" onSubmit={completeProfile}>
              <div>
                <span className="eyebrow">Onboarding</span>
                <h2>Let&apos;s tailor your support path</h2>
                <p>These answers personalize the first chat session and the recovery plan we show before the paywall.</p>
              </div>

              <label>
                First name
                <input
                  value={profile.name}
                  onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                  placeholder="Alex"
                  required
                />
              </label>

              <label>
                What pulls you into the app today?
                <select
                  value={profile.stressor}
                  onChange={(event) => setProfile({ ...profile, stressor: event.target.value })}
                >
                  <option>Work burnout</option>
                  <option>Relationship stress</option>
                  <option>Sleep + racing thoughts</option>
                  <option>General anxiety spike</option>
                </select>
              </label>

              <label>
                What would a better evening look like?
                <select
                  value={profile.goal}
                  onChange={(event) => setProfile({ ...profile, goal: event.target.value })}
                >
                  <option>Stop spiraling before bed</option>
                  <option>Feel calmer in my body</option>
                  <option>Make sense of my emotions</option>
                  <option>Recover enough for tomorrow</option>
                </select>
              </label>

              <label>
                Mood right now
                <div className="mood-row">
                  {moodOptions.map((option) => (
                    <button
                      className={option === profile.mood ? "mood active" : "mood"}
                      key={option}
                      onClick={() => setProfile({ ...profile, mood: option })}
                      type="button"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </label>

              <div className="preview-box">
                <strong>Your personalized promise</strong>
                <p>
                  We&apos;ll help you with <strong>{profile.stressor.toLowerCase()}</strong> so you can{" "}
                  <strong>{profile.goal.toLowerCase()}</strong>.
                </p>
              </div>

              <button className="primary" type="submit">
                Continue to registration
              </button>
            </form>
          )}

          {stage === "register" && (
            <form className="panel" onSubmit={completeRegistration}>
              <div>
                <span className="eyebrow">Registration</span>
                <h2>Save your plan and keep your progress</h2>
                <p>Email capture happens after the user sees tailored value, improving intent and later conversion.</p>
              </div>

              <label>
                Email
                <input
                  type="email"
                  value={profile.email}
                  onChange={(event) => setProfile({ ...profile, email: event.target.value })}
                  placeholder="alex@example.com"
                  required
                />
              </label>

              <label>
                Password
                <input minLength={8} placeholder="At least 8 characters" required type="password" />
              </label>

              <button className="secondary" type="button">
                Continue with Google
              </button>

              <button className="primary" type="submit">
                Unlock my support plan
              </button>
            </form>
          )}

          {stage === "paywall" && (
            <div className="panel">
              <div>
                <span className="eyebrow">Monetization</span>
                <h2>Your recovery plan is ready</h2>
                <p>
                  The paywall is framed around an outcome: nightly decompression, calmer sleep,
                  and personalized AI support for the moments when stress peaks.
                </p>
              </div>

              <div className="plan-grid">
                <button
                  className={profile.plan === "yearly" ? "plan active" : "plan"}
                  onClick={() => setProfile({ ...profile, plan: "yearly" })}
                  type="button"
                >
                  <strong>Yearly</strong>
                  <span>$59.99 / year</span>
                  <small>Best for habit formation</small>
                </button>
                <button
                  className={profile.plan === "monthly" ? "plan active" : "plan"}
                  onClick={() => setProfile({ ...profile, plan: "monthly" })}
                  type="button"
                >
                  <strong>Monthly</strong>
                  <span>$9.99 / month</span>
                  <small>Good for immediate relief</small>
                </button>
              </div>

              <div className="preview-box">
                <strong>Included in the MVP</strong>
                <p>AI emotional support chat, nightly reset exercises, mood-aware reflection prompts, and lightweight insights.</p>
              </div>

              <button className="primary" onClick={activatePlan}>
                Start 7-day free trial
              </button>
            </div>
          )}
        </div>
      </section>

      {stage === "workspace" && (
        <section className="workspace">
          <header className="workspace-header">
            <div>
              <span className="kicker">Paid workspace</span>
              <h2>Tonight&apos;s support plan</h2>
              <p>
                Primary goal: <strong>{profile.goal}</strong>. Current mood: <strong>{profile.mood}</strong>.
                {completedPlan ? ` ${completedPlan === "yearly" ? "Yearly" : "Monthly"} trial activated.` : ""}
              </p>
            </div>
            <button
              className="ghost"
              onClick={() => sendMessage(starterMessages[profile.mood])}
              type="button"
            >
              Start guided chat
            </button>
          </header>

          <div className="workspace-grid">
            <article className="workspace-card chat-card">
              <div className="card-heading">
                <h3>AI support chat</h3>
                <p>The core feature. Fast emotional support, grounding, reflection, and next-step coaching.</p>
              </div>
              <div className="chat-log">
                {messages.map((message) => (
                  <div
                    className={message.role === "assistant" ? "bubble assistant" : "bubble user"}
                    key={message.id}
                  >
                    {message.text}
                  </div>
                ))}
              </div>
              <div className="chat-actions">
                <button className="chip" onClick={() => sendMessage(starterMessages[profile.mood])} type="button">
                  Use mood-based prompt
                </button>
                <button
                  className="chip"
                  onClick={() => sendMessage("Help me calm down in the next five minutes.")}
                  type="button"
                >
                  5-minute calm plan
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
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Tell the AI what feels heavy right now..."
                  value={draft}
                />
                <button className="primary" disabled={isSending} type="submit">
                  {isSending ? "Thinking..." : "Send"}
                </button>
              </form>
            </article>

            <article className="workspace-card">
              <div className="card-heading">
                <h3>Quick reset</h3>
                <p>Short, behaviorally useful exercises that feel like a natural extension of the chat.</p>
              </div>
              <div className="reset-list">
                {quickResets.map((reset) => (
                  <div className="reset-item" key={reset.title}>
                    <strong>{reset.title}</strong>
                    <p>{reset.steps}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="workspace-card">
              <div className="card-heading">
                <h3>Reflection prompt</h3>
                <p>AI-guided journaling without the blank page problem.</p>
              </div>
              <div className="prompt-box">
                <strong>{reflectionPrompt}</strong>
              </div>
              <textarea
                onChange={(event) => setJournalEntry(event.target.value)}
                placeholder="Write for two minutes. You do not need to sound smart here."
                value={journalEntry}
              />
              <div className="insight-box">
                <strong>Why this matters</strong>
                <p>
                  Your onboarding selected <strong>{profile.goal.toLowerCase()}</strong>, so the reflection is tuned to reduce emotional noise around that outcome.
                </p>
              </div>
            </article>

            <article className="workspace-card">
              <div className="card-heading">
                <h3>Lightweight insight</h3>
                <p>Simple retention loop: the app mirrors back useful patterns instead of passive tracking charts.</p>
              </div>
              <div className="insight-box">
                <strong>Pattern detected</strong>
                <p>
                  Users who arrive feeling <strong>{profile.mood.toLowerCase()}</strong> usually need regulation first, then reflection. That&apos;s why chat and resets appear before journaling.
                </p>
              </div>
              <div className="insight-box">
                <strong>Suggested next action</strong>
                <p>Complete one reset, send one honest chat message, then close the app when you feel 10% lighter.</p>
              </div>
            </article>
          </div>
        </section>
      )}
    </main>
  );
}
