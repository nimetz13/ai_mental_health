import { NextResponse } from "next/server";
import { generateAssistantReply } from "@/lib/ai";
import { extractMemoryCandidates } from "@/lib/memory";
import { classifySafetyLevel } from "@/lib/safety";
import { jsonError, requireUser } from "@/lib/server";
import { store } from "@/lib/store";

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) {
    return auth.response;
  }

  const body = (await request.json()) as {
    message?: string;
    conversationId?: string;
  };

  const message = body.message?.trim();
  if (!message) {
    return jsonError("Message is required.");
  }

  const userId = auth.record.user.id;
  const conversationId =
    body.conversationId ||
    (
      await store.createConversation(
        userId,
        message.length > 48 ? `${message.slice(0, 48)}...` : message,
      )
    ).id;

  const currentConversation = await store.getConversation(userId, conversationId);
  const memories = await store.listMemories(userId);
  const userSafety = classifySafetyLevel(message);
  await store.appendMessages(userId, conversationId, [
    {
      role: "user",
      content: message,
      safetyLevel: userSafety,
    },
  ]);

  const reply = await generateAssistantReply({
    message,
    profile: auth.record.profile,
    history: currentConversation.messages,
    memories,
  });

  const memoryCandidates = extractMemoryCandidates(message);
  if (memoryCandidates.length) {
    await store.remember(userId, memoryCandidates);
  }

  const updatedConversation = await store.appendMessages(userId, conversationId, [
    {
      role: "assistant",
      content: reply.reply,
      safetyLevel: reply.safetyLevel,
    },
  ]);

  return NextResponse.json({
    conversation: updatedConversation.conversation,
    messages: updatedConversation.messages,
    mode: reply.mode,
    safety: {
      level: reply.safetyLevel,
      ...reply.safety,
    },
  });
}
