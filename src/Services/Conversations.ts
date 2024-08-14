import { conversations, createConversation } from "@grammyjs/conversations";
import { Effect, Layer } from "effect"
import { Grammy } from "./Grammy.js";
import { toStartNotAuth } from "../Modules/Start.js";
import { Settings, SettingsMenu } from "../Modules/Settings.js";

export const Conversation = Layer.effectDiscard(
  Effect.gen(function*() {
    const grammy = yield* Grammy;
    console.log("Conversation");

  })
)
