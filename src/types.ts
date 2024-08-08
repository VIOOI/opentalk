import { Effect, Option, Ref } from "effect";
import { Context, SessionFlavor } from "grammy";
import { Conversation, ConversationFlavor } from "@grammyjs/conversations";
import { ParseModeFlavor } from "@grammyjs/parse-mode";
import { User } from "./Models/User.model.js";



export type SessionData = {
  self: Ref.Ref<User>,
  lastGender: number | null,
  // conversation: Record<string, unknown>,

}

export type GC = Context &
  SessionFlavor<SessionData> &
  ConversationFlavor &
  ParseModeFlavor<Context>;

export type GConversation = Conversation<GC>;
