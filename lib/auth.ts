import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { appConfig } from "@/lib/config";

const encoder = new TextEncoder();

type SessionPayload = {
  userId: string;
  email: string;
};

type OAuthStatePayload = {
  nonce: string;
  name: string;
  stressor: string;
  goal: string;
  mood: string;
  planPreference: string;
};

function getSecret() {
  return encoder.encode(appConfig.sessionSecret);
}

function shouldUseSecureCookie() {
  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  return appConfig.appUrl.startsWith("https://");
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${appConfig.sessionTtlSeconds}s`)
    .sign(getSecret());
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(appConfig.sessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    maxAge: appConfig.sessionTtlSeconds,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(appConfig.sessionCookie, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    maxAge: 0,
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(appConfig.sessionCookie)?.value;
  if (!token) {
    return null;
  }

  try {
    const verified = await jwtVerify(token, getSecret());
    const payload = verified.payload as unknown as SessionPayload;
    return payload;
  } catch {
    return null;
  }
}

async function signToken(payload: Record<string, string>, expiresInSeconds: number) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(getSecret());
}

export async function setOAuthStateCookie(payload: OAuthStatePayload) {
  const token = await signToken(payload, 60 * 10);
  const cookieStore = await cookies();
  cookieStore.set(appConfig.googleOauthStateCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    maxAge: 60 * 10,
  });
  return token;
}

export async function consumeOAuthStateCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(appConfig.googleOauthStateCookie)?.value;
  cookieStore.set(appConfig.googleOauthStateCookie, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    maxAge: 0,
  });

  if (!token) {
    return null;
  }

  try {
    const verified = await jwtVerify(token, getSecret());
    return verified.payload as unknown as OAuthStatePayload;
  } catch {
    return null;
  }
}

export async function verifyOAuthStateToken(token: string) {
  try {
    const verified = await jwtVerify(token, getSecret());
    return verified.payload as unknown as OAuthStatePayload;
  } catch {
    return null;
  }
}
