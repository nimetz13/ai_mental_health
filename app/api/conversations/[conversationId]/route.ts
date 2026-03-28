import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server";
import { store } from "@/lib/store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const auth = await requireUser();
  if ("response" in auth) {
    return auth.response;
  }

  const { conversationId } = await context.params;
  const conversation = await store.getConversation(auth.record.user.id, conversationId);
  return NextResponse.json(conversation);
}
