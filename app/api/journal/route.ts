import { NextResponse } from "next/server";
import { generateAssistantReply } from "@/lib/ai";
import { jsonError, requireUser } from "@/lib/server";
import { store } from "@/lib/store";

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) {
    return auth.response;
  }

  const body = (await request.json()) as { prompt?: string; content?: string };
  if (!body.prompt || !body.content) {
    return jsonError("Prompt and content are required.");
  }

  const memories = await store.listMemories(auth.record.user.id);

  const summaryResult = await generateAssistantReply({
    message: `Summarize this reflection in two sentences and suggest one next step:\n\n${body.content}`,
    profile: auth.record.profile,
    history: [],
    memories,
  });

  const entry = await store.createJournalEntry(auth.record.user.id, {
    prompt: body.prompt,
    content: body.content,
    summary: summaryResult.reply,
  });

  return NextResponse.json({ ok: true, entry });
}
