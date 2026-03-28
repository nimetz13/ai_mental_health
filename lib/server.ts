import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { store } from "@/lib/store";

export async function requireUser() {
  const session = await getSession();
  if (!session) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const record = await store.getUserRecord(session.userId);
  if (!record) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { record };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
