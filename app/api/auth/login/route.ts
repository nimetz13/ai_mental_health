import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/security";
import { jsonError } from "@/lib/server";
import { store } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return jsonError("Email and password are required.");
  }

  const user = await store.findUserByEmail(body.email);
  if (!user || !verifyPassword(body.password, user.passwordHash)) {
    return jsonError("Invalid credentials.", 401);
  }

  await setSessionCookie({ userId: user.id, email: user.email });

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  });
}
