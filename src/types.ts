import { Effect, Option, Ref } from "effect";
import { Context as GContext, SessionFlavor } from "grammy";
import { Conversation as GConversation, ConversationFlavor } from "@grammyjs/conversations";
import { ParseModeFlavor } from "@grammyjs/parse-mode";
// import { User } from "./Schemas/User.js";



export type SessionData = {
  // self: Ref.Ref<User>,
  search: "men" | "women" | "any"
  history: Record<string, string>
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  conversation?: Record<string, any>

}

export type Context = GContext &
  SessionFlavor<SessionData> &
  ConversationFlavor &
  ParseModeFlavor<GContext>;

export type Conversation = GConversation<Context>;
