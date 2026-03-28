# North Star

North Star is a production-shaped AI mental wellness product for emotionally overloaded professionals. It goes beyond the assignment baseline by combining onboarding, registration, monetization, persistent support sessions, check-ins, journaling, safety handling, and deployable infrastructure in one system.

## Product strategy

### Target user

- Knowledge workers, founders, managers, and operators with high cognitive load.
- They arrive in moments of acute evening stress, rumination, burnout, emotional overload, or post-conflict spirals.

### Core problem

Most wellness products require too much energy exactly when users have the least of it. In a high-stress moment, users do not want a content catalog. They want to feel understood quickly, regulate first, and know what to do next.

### Value proposition

North Star sells a narrow and clear promise:

- personalized emotional decompression in under ten minutes
- a repeatable nightly support ritual
- persistent AI support that remembers context
- conversion into a paid relationship after value is already visible

## Why this version beats the assignment

This repo no longer behaves like a static prototype. It now includes:

- account registration and login with signed session cookies
- persistent storage for users, onboarding profile, conversations, journal entries, check-ins, and subscriptions
- storage abstraction with PostgreSQL support and file fallback for local/demo use
- safety-aware chat orchestration with crisis escalation behavior
- Stripe-ready subscription checkout and webhook processing
- health endpoint, Docker, CI/CD, and a GHCR publish workflow

## Product flow

1. Marketing framing explains who the product is for and why it is paid.
2. Onboarding captures stressor, goal, mood, and plan preference.
3. Registration happens only after the user sees a personalized promise.
4. Paywall converts the user into a trial with a concrete outcome, not generic premium language.
5. Workspace unlocks the core system:
   AI support chat
   mood check-ins
   guided journaling
   recovery insights
   persistent conversation history

## Core features

### 1. AI support chat

The primary feature. It provides short emotional support, grounding, reflection, and next-step guidance.

### 2. Daily check-in

Creates longitudinal user state so the product can become more intelligent over time and build retention loops.

### 3. Guided journal

Reduces blank-page friction by using the onboarding state and current mood to choose prompts and produce summaries.

### 4. Recovery insights

Mirrors back dominant mood patterns, average stress, and behavioral recommendations.

## AI architecture

### Main AI boundary

- `app/api/chat/route.ts` is the main conversation endpoint.
- The assistant response is generated in `lib/ai.ts`.
- Safety classification lives in `lib/safety.ts`.

### AI orchestration design

The system follows a simple but production-relevant flow:

1. classify user risk signal
2. load user profile and prior conversation context
3. choose the support mode
4. generate a concise response with guardrails
5. persist both user and assistant messages

### Safety behavior

- Critical self-harm language triggers crisis-safe guidance and bypasses normal support behavior.
- Elevated stress language steers the model toward regulation-first responses.
- The system explicitly avoids diagnosis claims and therapeutic overreach.

## Data model

The app persists:

- users
- profiles
- subscriptions
- conversations
- messages
- check-ins
- journal entries

If `DATABASE_URL` is provided, the app uses PostgreSQL. Otherwise it falls back to a local JSON store for demos.

## Auth and billing

### Auth

- Registration and login are handled with route handlers.
- Passwords are hashed with Node `scrypt`.
- Sessions are stored in signed HTTP-only cookies using `jose`.

### Billing

- `app/api/billing/checkout/route.ts` starts the subscription flow.
- If Stripe keys are configured, it creates a real Stripe Checkout session.
- If Stripe keys are absent, it falls back to demo trial activation so the product can still be presented end-to-end.
- `app/api/billing/webhook/route.ts` updates subscription state from Stripe events.

## Local run

1. Copy `.env.example` to `.env`.
2. Set `SESSION_SECRET`.
3. Optionally set:
   `OPENAI_API_KEY`
   `STRIPE_SECRET_KEY`
   `STRIPE_MONTHLY_PRICE_ID`
   `STRIPE_YEARLY_PRICE_ID`
   `STRIPE_WEBHOOK_SECRET`
4. Start with Docker:

```bash
docker compose up --build
```

This runs:

- the Next.js app on port `3000`
- PostgreSQL on port `5432`

## CI/CD

### CI

GitHub Actions runs:

- `npm install`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

### CD

On push to `main`, Docker images are built and published to GHCR.

## Deployment recommendation

For real go-to-market, the strongest pragmatic setup is:

- `Railway` for the app service
- managed PostgreSQL on Railway or Neon
- Stripe for subscriptions
- custom domain like `app.yourbrand.com`

Second-best option:

- `Render` for app + PostgreSQL

If you want more infra control:

- `Fly.io` with managed Postgres or external Neon

## What still remains before a true public launch

This version is much closer to market than the original assignment, but for a real public release I would still add:

- clinician-reviewed safety copy and escalation policy
- dedicated analytics and event instrumentation
- Sentry or similar error monitoring
- email delivery for onboarding and retention flows
- Stripe customer portal
- admin tools for support review and prompt/policy tuning
- legal pages, privacy policy, and consent handling for sensitive data

## Defense framing

Use these points in the review call:

- I intentionally narrowed the ICP to emotionally overloaded professionals because narrow pain converts better than generic wellness.
- The onboarding asks only for information that directly improves support quality and subscription conversion.
- Registration happens after the personalized promise because perceived value needs to exist before commitment.
- The MVP is not only chat. It is a support loop: check-in, regulate, reflect, and return.
- I designed the AI architecture around safety and state, because mental health products cannot be treated like stateless chat wrappers.
- I added real product infrastructure so the system can plausibly be deployed and sold, not just demoed.
