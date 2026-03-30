import { NextResponse } from "next/server";
import { consumeOAuthStateCookie, setSessionCookie, verifyOAuthStateToken } from "@/lib/auth";
import { appConfig } from "@/lib/config";
import { hashPassword } from "@/lib/security";
import { store } from "@/lib/store";
import { Mood, PlanId } from "@/lib/types";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  email?: string;
  name?: string;
  email_verified?: boolean;
};

function redirectWithError(message: string) {
  const url = new URL(appConfig.appUrl);
  url.searchParams.set("authError", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  if (!appConfig.googleClientId || !appConfig.googleClientSecret) {
    return redirectWithError("Google sign-in is not configured.");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const remoteError = url.searchParams.get("error");

  if (remoteError) {
    return redirectWithError("Google sign-in was canceled.");
  }

  if (!code || !state) {
    return redirectWithError("Missing Google authorization data.");
  }

  const cookieState = await consumeOAuthStateCookie();
  const queryState = await verifyOAuthStateToken(state);
  if (!cookieState || !queryState || cookieState.nonce !== queryState.nonce) {
    return redirectWithError("Google sign-in could not be verified.");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: appConfig.googleClientId,
      client_secret: appConfig.googleClientSecret,
      redirect_uri: `${appConfig.appUrl}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  const tokenPayload = (await tokenResponse.json()) as GoogleTokenResponse;
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    return redirectWithError(tokenPayload.error_description || "Google token exchange failed.");
  }

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${tokenPayload.access_token}`,
    },
    cache: "no-store",
  });

  const profile = (await profileResponse.json()) as GoogleUserInfo;
  if (!profileResponse.ok || !profile.email || !profile.email_verified) {
    return redirectWithError("Google account email could not be verified.");
  }

  const existing = await store.findUserByEmail(profile.email);
  if (existing) {
    await setSessionCookie({ userId: existing.id, email: existing.email });
  } else {
    if (cookieState.mode === "login") {
      return redirectWithError("No account is linked to this Google profile yet. Start with onboarding first.");
    }

    const created = await store.createUser({
      email: profile.email,
      name: profile.name || cookieState.name,
      passwordHash: hashPassword(`google-oauth-${Date.now()}`),
      stressor: cookieState.stressor,
      goal: cookieState.goal,
      mood: cookieState.mood as Mood,
      planPreference: cookieState.planPreference as PlanId,
    });
    await setSessionCookie({ userId: created.user.id, email: created.user.email });
  }

  return NextResponse.redirect(new URL(appConfig.appUrl));
}
