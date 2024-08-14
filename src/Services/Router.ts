import { Router as GRouter } from "@grammyjs/router"
import { Console, Context, Effect, Either, HashMap, Layer, Option, Record } from "effect"
import { Grammy } from "./Grammy.js";
import * as Types from "../Types.js"
import { UserService, UserServiceLive } from "./User.js";
import { QueueService, QueueServiceLive } from "./Queue.js";
import { ConnectionService, ConnectionServiceLive } from "./Connection.js";
import { safeReply } from "../Shared/safeSend.js";
import * as Search from "../Modules/Search.js";
import * as Start from "../Modules/Start.js";
import * as Chat from "../Modules/Chat.js";
import * as Settings from "../Modules/Settings.js";
import { Forwarding } from "../Modules/Chat.js";
import { Composer } from "grammy";
import { toRaiting } from "../Keyboards/RaitingKeyboard.js";

const stopAllConversation = (context: Types.Context) => Effect.runPromise(
  Effect.promise(() => context.conversation.active()).pipe(
    Effect.andThen((conv) => Effect.all(
      Record.keys(conv)
        .map(conv => Effect.promise(() => context.conversation.exit(conv)))
    ))
  )
)

class Router extends Context.Tag("Routing")<
  Router,
  {
    self: GRouter<Types.Context>,
    ofAuth: Composer<Types.Context>,
    ofUnAuth: Composer<Types.Context>,
    ofSearch: Composer<Types.Context>,
    ofConnect: Composer<Types.Context>,
    ofNoUsername: Composer<Types.Context>,
  }
>() { }

const RouterLive = Layer.effect(
  Router,
  Effect.gen(function*() {
    const users = yield* UserService;
    const queue = yield* QueueService;
    const connection = yield* ConnectionService;

      const statusSetAndGetFabric = (context: Types.Context) => (status: Types.Context["session"]["status"]) => {
        context.session.status = status;
        return status;
      }

    const router = new GRouter<Types.Context>(async (context) => Effect.gen(function*() {
      if (context.from!.username === undefined) return "nousername"
      const self = yield* Effect.either(users.getSelf(context));
      
      const statusSetAndGet = statusSetAndGetFabric(context);

      if (Either.isLeft(self)) return statusSetAndGet("unauth")
      if (yield* queue.isInQueue(context))  return statusSetAndGet("insearch")
      if (yield* connection.isInConnection(context)) return statusSetAndGet("inconnection")
      return statusSetAndGet("auth");
      
    }).pipe(
      Effect.runPromise,
    ))

    return {
      self: router,
      ofAuth: router.route("auth"),
      ofUnAuth: router.route("unauth"),
      ofSearch: router.route("insearch"),
      ofConnect: router.route("inconnection"),
      ofNoUsername: router.route("nousername")
    }
  })
)

export const Routing = Layer.effectDiscard(
  Effect.gen(function*(_) {
    const grammy = yield* Grammy;
    const { ofAuth, ofUnAuth, ofSearch, ofConnect, ofNoUsername, self } = yield* Router;
    console.log("Router");


    ofNoUsername.hears("*", (context) => { safeReply(context, "Простите, но для использования этого бота, вам нужно настроить username!") })

    ofUnAuth.command("start", async (context) => {
      await stopAllConversation(context);
      console.log("command:start:ofUnAuth");

      await context.conversation.enter("toStartNotAuth");
    })
    ofUnAuth.on("message", Search.toSearchNotAut)

    ofAuth.command("start", async (context) => {
      await stopAllConversation(context);
      console.log("command:start:ofAuth");

      await Start.toStartAuth(context);
    })
    ofAuth.command("stop", Chat.toStopConvectionIsNot)
    ofAuth.command("next", Search.toNextSearch)
    ofAuth.command("settings", Settings.toSettings)
    ofAuth.hears("Найти 👩", Search.toSearch("women"));
    ofAuth.hears("Найти 👨", Search.toSearch("men"));
    ofAuth.hears("Найти 👽", Search.toSearch("any"));
    ofAuth.hears("Прекратить поиск ❌", Search.toStopSearching);
    ofAuth.hears("Завершить ❌", Chat.toStopConvectionIsNot)
    ofAuth.hears("Настройки ⚙️", Settings.toSettings)
    ofAuth.hears("*", Chat.toStopConvectionIsNot)
    ofAuth.callbackQuery(/^rate_(.*)_(up|down)$/, toRaiting)
    //
    ofSearch.command("start", Start.toStartInQueue)
    ofSearch.command("stop", Search.toStopSearching)
    ofSearch.command("next", Search.toSearchInQueue)
    ofSearch.hears(["Найти 👩", "Найти 👨", "Найти 👽"], Search.toSearchInQueue)
    ofSearch.hears("Прекратить поиск ❌", Search.toStopSearching);
    ofSearch.hears("*", Search.toSearchInQueue)
    //
    ofConnect.command("start", Start.toStartInConnection)
    ofConnect.hears(["Найти 👩", "Найти 👨", "Найти 👽"], Search.toSearchInConnection)
    ofConnect.hears("Прекратить поиск ❌", Search.toStopSearching);
    ofConnect.hears("Завершить ❌", Chat.toStopConvection)
    ofConnect.command("stop", Chat.toStopConvection)
    ofConnect.hears("Следующий ➡️", Search.toNextSearch)
    ofConnect.command("next", Search.toNextSearch)

    const forwarding = yield* Forwarding;

    ofConnect.on(":text", forwarding.textMessage)
    ofConnect.on(":photo", forwarding.photo)
    ofConnect.on(":video", forwarding.video)
    ofConnect.on(":video_note", forwarding.videoNote)
    ofConnect.on(":sticker", forwarding.sticker)
    ofConnect.on(":voice", forwarding.voice)
    ofConnect.on("edit:text", (context) => Effect.gen(function*(_) {
      const connection = yield* ConnectionService;
      const companion = yield* connection.getCompanion(context);
      const message_id = HashMap.get(context.session.history, context.editedMessage!.message_id!.toString())
      if (Option.isSome(message_id))
        context.api.editMessageText(companion.chat, Number(message_id.value), context.editedMessage?.text!)
    }).pipe(
      Effect.provide(ConnectionServiceLive),
      Effect.runPromise,
    ))

    grammy.use(self);
  })
).pipe(
  Layer.provide(RouterLive),
  // Layer.provide(ConnectionServiceLive),
)

