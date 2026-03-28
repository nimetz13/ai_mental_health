# North Star

`North Star` is a small paid AI mental health product prototype built for the AI Product Engineer test assignment.

It is designed for emotionally overloaded professionals who look functional on the outside, but come to the product when they feel burnt out, tense, restless, or unable to switch off after work.

## Product framing

### 1. Target user

- Knowledge workers, founders, managers, and tech professionals with high cognitive load.
- They arrive when they feel overwhelmed, dysregulated, emotionally flooded, or stuck in late-night rumination.

### 2. Core problem

Generic wellness apps often ask for too much energy. When a user is overwhelmed, they do not want a library of content. They want fast emotional decompression, a feeling of being understood, and one clear next step.

### 3. Value proposition

North Star combines:

- Short onboarding that identifies the user context and desired outcome.
- Personalized AI chat as the main feature.
- Quick reset exercises for immediate regulation.
- Reflection prompts without the blank-page problem.
- A monetization moment placed after personalized value is visible.

The user pays not for content volume, but for tailored support and a repeatable recovery ritual.

## Why the onboarding is designed this way

The onboarding intentionally moves in this order:

1. Frame the emotional use case and paid value.
2. Ask only a few high-signal questions: stressor, desired outcome, current mood.
3. Ask for registration after the user sees a personalized promise.
4. Show the paywall once the recovery plan feels concrete.

This improves conversion because the user first feels understood, then sees what they are unlocking.

## MVP features

### Core feature

- AI support chat: grounding, reflection, emotional validation, and next-step coaching.

### Supporting features

- Mood-aware quick resets.
- Reflection prompt tuned to current mood.
- Lightweight insight card that mirrors back a useful pattern.

These are intentionally small so the prototype feels coherent and shippable within the assignment scope.

## AI architecture

- Frontend: Next.js App Router.
- Backend: Next.js API route at `app/api/chat/route.ts`.
- AI layer:
  - Uses OpenAI Chat Completions API when `OPENAI_API_KEY` is set.
  - Falls back to deterministic supportive responses when no key is available, so the demo still works.
- Safety:
  - Detects basic self-harm language.
  - Escalates to immediate human support guidance and includes `988` for US crisis support.

## Infrastructure choices

- Single service Next.js app for speed and pragmatism.
- Dockerized with a multi-stage production build.
- CI with GitHub Actions: install, lint, build.
- CD with GitHub Actions: build and publish Docker image to GHCR.

## Local run

1. Copy `.env.example` to `.env`.
2. Optionally set `OPENAI_API_KEY`.
3. Install dependencies:

```bash
npm install
```

4. Start locally:

```bash
npm run dev
```

Or with Docker:

```bash
docker compose up --build
```

## Deployment recommendation

Best options for this project:

- Railway: fastest path for a Dockerized MVP with easy env var management.
- Render: strong for simple web services and easy GitHub integration.
- Fly.io: good if you want more infrastructure control and global deployment.
- DigitalOcean App Platform: solid if you want predictable managed hosting.

For the test assignment, I would deploy it on Railway or Render first because the setup friction is lowest.

## What to say in the defense

- The onboarding converts because it reduces cognitive load and shows personalized value before asking for money.
- The chat is the MVP because it is the shortest path from distress to relief.
- Supporting features exist to make the chat feel trustworthy, actionable, and habit-forming.
- The architecture is intentionally compact: one deployable service, one API route, one AI boundary, one Docker image.
