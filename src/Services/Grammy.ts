import { Config as Conf, Context, Effect, HashMap, Layer, Record } from "effect"
import { Bot, session } from "grammy"
import * as Types from "../Types.js"
import { TagsKeyboard } from "../Keyboards/TagsKeyboard.js";
import { conversations, createConversation } from "@grammyjs/conversations";
import { toStartNotAuth } from "../Modules/Start.js";
import { Settings, SettingsMenu } from "../Modules/Settings.js";
import { addedAds } from "../Modules/Ads.js";
// import { SettingsMenu } from "../Modules/Settings.js";

export class Grammy extends Context.Tag("@app/Grammy")<
  Grammy,
  Bot<Types.Context>
>() { }

export const GrammyLive = Layer.effect(
  Grammy,
  Effect.gen(function*() {
    const token = yield* Conf.string("BOT_TOKEN").pipe(
      Conf.withDefault(<string>process.env.BOT_TOKEN)
    );
    return new Bot<Types.Context>(token);
  })
)

export const Config = Layer.effectDiscard(
  Effect.gen(function*(_) {
    const grammy = yield* Grammy;
    console.log("Config");

    grammy.api.setMyCommands([
      { command: "start", description: "Старт/Главное меню" },
      { command: "stop", description: "Остановить поиск/беседу" },
      { command: "next", description: "Следующий собеседник" },
      { command: "settings", description: "Настройки" }
    ])

    grammy.use(session({
      type: "multi",
      search: { initial: () => "any" },
      connect: { initial: () => null },
      categories: { initial: () => ["Общение"] },
      history: { initial: () => HashMap.empty<string, string>() },
      status: { initial: () => "unauth" },
      conversation: { initial: () => ({}) }, // may be left empty
    }))
    
    grammy.use(SettingsMenu)
    grammy.use(TagsKeyboard)

    grammy.use(conversations())


    grammy.use(createConversation(Settings.Name, "settingsName"))
    grammy.use(createConversation(Settings.Age, "settingsAge"))
    grammy.use(createConversation(Settings.Tags, "settingsTags"))
    grammy.use(createConversation(Settings.Description, "settingsDescription"))
    grammy.use(createConversation(toStartNotAuth));
    grammy.use(createConversation(addedAds));

    // grammy.use(SettingsMenu)



  })
)
