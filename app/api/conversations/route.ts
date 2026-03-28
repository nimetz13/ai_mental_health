import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/server";
import { store } from "@/lib/store";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) {
    return auth.response;
  }

  const conversations = await store.listConversations(auth.record.user.id);
  return NextResponse.json({ conversations });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) {
    return auth.response;
  }

  const body = (await request.json()) as { title?: string };
  if (!body.title) {
    return jsonError("Conversation title is required.");
  }

  const conversation = await store.createConversation(auth.record.user.id, body.title);
  return NextResponse.json({ conversation });
}
