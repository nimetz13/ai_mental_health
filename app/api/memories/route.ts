import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/server";
import { store } from "@/lib/store";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) {
    return auth.response;
  }

  const memories = await store.listMemories(auth.record.user.id);
  return NextResponse.json({ memories });
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) {
    return auth.response;
  }

  const body = (await request.json()) as { memoryId?: string };
  if (!body.memoryId) {
    return jsonError("Memory id is required.");
  }

  const memories = await store.forgetMemory(auth.record.user.id, body.memoryId);
  return NextResponse.json({ ok: true, memories });
}
