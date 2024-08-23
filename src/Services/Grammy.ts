import { Config as Conf, Context, Effect, HashMap, Layer, Record } from "effect"
import { Bot, session } from "grammy"
import * as Types from "../Types.js"
import { TagsKeyboard } from "../Keyboards/TagsKeyboard.js";
import { conversations, createConversation } from "@grammyjs/conversations";
import { toStartNotAuth } from "../Modules/Start.js";
import { SettingsMenu } from "../Modules/Settings/keyboards.js";
import { addedAds } from "../Modules/Ads.js";
import { settingsAge, settingsDescription, settingsName, settingsTags } from "../Modules/Settings/conversation.js";

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
      setting: { initial: () => undefined },
      conversation: { initial: () => ({}) }, // may be left empty
    }))
 

    
    grammy.use(conversations())
    


    grammy.use(createConversation(settingsName, "settings-name"))
    grammy.use(createConversation(settingsAge, "settings-age"))
    grammy.use(createConversation(settingsTags, "settings-tags"))
    grammy.use(createConversation(settingsDescription, "settings-description"));
    
    grammy.use(TagsKeyboard)
    grammy.use(SettingsMenu)
    
    grammy.use(createConversation(toStartNotAuth));
    grammy.use(createConversation(addedAds));

    grammy.catch(() => {
      process.kill(process.pid)
    })


  })
)
