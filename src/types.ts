import { Array, Effect, HashMap, Option, Ref } from "effect";
import { Context as GContext, SessionFlavor } from "grammy";
import { Conversation as GConversation, ConversationFlavor } from "@grammyjs/conversations";
import { ParseModeFlavor } from "@grammyjs/parse-mode";
import { User } from "./Schemas/User.js";
// import { User } from "./Schemas/User.js";



export type SessionData = {
  // self: Ref.Ref<User>,
  status: "unauth" | "auth" | "insearch" | "inconnection"
  connect: User | null,
  categories: Array<string>,
  search: "men" | "women" | "any"
  history: HashMap.HashMap<string, string>
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  conversation?: Record<string, any>

}

export type Context = GContext &
  SessionFlavor<SessionData> &
  ConversationFlavor &
  ParseModeFlavor<GContext>;

export type Conversation = GConversation<Context>;
