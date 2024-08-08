import { Bot, session } from "grammy";
import { GC, SessionData } from "./types.js";
import { Effect, Layer, Context } from "effect";
import { hydrateReply } from "@grammyjs/parse-mode";
import { conversations } from "@grammyjs/conversations";
import { seedUser } from "./Models/User.model.js";
import { Router } from "./Router.js";

export class Grammy extends Context.Tag("Grammy")<
  Grammy,
  Bot<GC>
>() { }

// export const GrammyLive = Layer.sync(GrammyService, () => new Bot<GC>("6534182637:AAFivxtLDwLIMISu5cjDYASFmCcKFcNhbNo"))

export const GrammyLive = Layer.effect(
  Grammy,
  Effect.gen(function*(_) {
    const bot = new Bot<GC>("7057502930:AAG5EpFSrIC0zwmlVjQREUXz3JmGmXiGb_M");

    yield* seedUser.pipe(
      Effect.andThen(init => session<SessionData, GC>({
        type: "multi",
        self: {
          initial: () => init,
        },
        lastGender: {
          initial: () => null,
        },
        // @ts-ignore
        conversation: {},
      })),
      Effect.map(session => bot.use(session))
    );

    bot.use(hydrateReply);

    // bot.use(conversations())
    //
    // // bot.use()
    //
    // 
    // bot.use(yield* Router)

    return bot;
  })
)
