import { Config as Conf, Context, Effect, Layer, Record } from "effect"
import { Bot, session } from "grammy"
import * as Types from "../Types.js"

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
      history: { initial: () => Record.empty<string, string>() },
      conversation: { initial: () => ({}) }, // may be left empty
    }))



  })
)
