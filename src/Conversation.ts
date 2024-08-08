import { Bot } from "grammy";
import { GC } from "./types.js";
// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
import { Array, Effect, pipe, Record } from "effect";
import { conversations, createConversation } from "@grammyjs/conversations";
import { toStartNotAuth } from "./Modules/Start.js";
// import { SettingsSetAge, SettingsSetDescription, SettingsSetName, SettingsSetTags } from "./Modules/Settings.js";
import { Settings } from "./Modules/Settings.js";

export const Conversation = (grammy: Bot<GC>) => Effect.sync(() => {
  grammy.use(conversations())

  grammy.use(createConversation(toStartNotAuth))

  // grammy.use(createConversation(SettingsSetName))
  // grammy.use(createConversation(SettingsSetAge))
  // grammy.use(createConversation(SettingsSetDescription))
  // grammy.use(createConversation(SettingsSetTags))

  grammy.use(createConversation(Settings.Name, "settingsName"))
  grammy.use(createConversation(Settings.Age, "settingsAge"))
  grammy.use(createConversation(Settings.Tags, "settingsTags"))
  grammy.use(createConversation(Settings.Description, "settingsDescription"))
  // grammy.use(createConversation(Settings.Gender, "settingsGender"))
})
