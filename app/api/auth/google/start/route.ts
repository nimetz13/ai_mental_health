import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { setOAuthStateCookie } from "@/lib/auth";
import { appConfig } from "@/lib/config";
import { Mood, PlanId } from "@/lib/types";

function redirectWithError(message: string) {
  const url = new URL(appConfig.appUrl);
  url.searchParams.set("authError", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  if (!appConfig.googleClientId || !appConfig.googleClientSecret) {
    return redirectWithError("Google sign-in is not configured yet.");
  }

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name")?.trim();
  const stressor = searchParams.get("stressor")?.trim();
  const goal = searchParams.get("goal")?.trim();
  const mood = searchParams.get("mood") as Mood | null;
  const planPreference = (searchParams.get("planPreference") as PlanId | null) || "yearly";

  if (!name || !stressor || !goal || !mood) {
    return redirectWithError("Finish onboarding before continuing with Google.");
  }

  const nonce = randomUUID();
  const stateToken = await setOAuthStateCookie({
    nonce,
    name,
    stressor,
    goal,
    mood,
    planPreference,
  });

  const redirectUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  redirectUrl.searchParams.set("client_id", appConfig.googleClientId);
  redirectUrl.searchParams.set("redirect_uri", `${appConfig.appUrl}/api/auth/google/callback`);
  redirectUrl.searchParams.set("response_type", "code");
  redirectUrl.searchParams.set("scope", "openid email profile");
  redirectUrl.searchParams.set("prompt", "select_account");
  redirectUrl.searchParams.set("state", stateToken);

  return NextResponse.redirect(redirectUrl);
}
