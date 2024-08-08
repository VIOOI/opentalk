import { Config, Effect, Redacted } from "effect";
import { Bot, session } from "grammy";
import { seedUser } from "./Models/User.model.js";
import { GC, SessionData } from "./types.js";
import { hydrateReply } from "@grammyjs/parse-mode";
import { Router } from "./Router.js";
import { UserServiceLive } from "./Service/User.service.js";
import { Conversation } from "./Conversation.js";
import { SettingsMenu } from "./Modules/Settings.js";
import * as dotenv from "dotenv"

const config = Effect.gen(function*(_) {
  dotenv.config()
  return yield* Config.redacted("BOT_TOKEN")
    .pipe( Config.withDefault(Redacted.make(<string>process.env.BOT_TOKEN)))
})

Effect.gen(function*(_) {
  const grammy = new Bot<GC>(Redacted.value(yield* config));

  grammy.api.setMyCommands([
    {
      command: "start",
      description: "Главное меню"
    },
    {
      command: "stop",
      description: "Остановить поиск/беседу"
    },
    {
      command: "next",
      description: "Следующий собеседник"
    }
  ])

  yield* _(
    seedUser,
    Effect.map(init => session<SessionData, GC>({
      type: "multi",
      self: { initial: () => init },
      lastGender: { initial: () => null },
      // @ts-ignore
      conversation: {},
    })),
    Effect.map(session => grammy.use(session)),
  );

  grammy.use(hydrateReply);


  yield* Conversation(grammy);

  grammy.use(SettingsMenu)

  yield* Router(grammy);


  grammy.start()

}).pipe(
  Effect.provide(UserServiceLive),
  Effect.runPromise,
)
