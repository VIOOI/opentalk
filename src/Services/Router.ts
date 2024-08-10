import { Router as GRouter } from "@grammyjs/router"
import { Effect, Layer, Option, Record } from "effect"
import { Grammy } from "./Grammy.js";
import * as Types from "../Types.js"
import { UserService, UserServiceLive } from "./Users.js";
import { QueueService, QueueServiceLive } from "./Queue.js";
import { ConnectionService, ConnectionServiceLive } from "./Connection.js";
import { safeReply } from "../Shared/safeSend.js";
import * as Search from "../Modules/Search.js";
import * as Start from "../Modules/Start.js";
import * as Chat from "../Modules/Chat.js";
import * as Settings from "../Modules/Settings.js";
import { toRaiting } from "../Keyboards/Raiting.js";
import { Forwarding } from "../Modules/Chat.js";

const stopAllConversation = (context: Types.Context) => Effect.runPromise(
  Effect.promise(() => context.conversation.active()).pipe(
    Effect.andThen((conv) => Effect.all(
      Record.keys(conv)
        .map(conv => Effect.promise(() => context.conversation.exit(conv)))
    ))
  )
)

const Routing = (context: Types.Context) => Effect.gen(function*() {
  const user = yield* UserService;
  const queue = yield* QueueService;
  const connection = yield* ConnectionService;

  if (context.from!.username === undefined) return "routerIsNotUsername"

  yield* user.getSelf(context);

  if (yield* queue.isInQueue(context)) return "routerInQueue"
  if (yield* connection.isInConnection(context)) return "routerInConnection"

  return "routerAuth"
}).pipe(
  Effect.catchTag("UserNotFoundError", () => Effect.succeed("routerUnAuth")),
  Effect.catchTag("RedisAnyError", () => Effect.succeed("routerUnAuth")),
  Effect.provide(QueueServiceLive),
  Effect.provide(UserServiceLive),
  Effect.provide(ConnectionServiceLive),
)

const fabricRouting = (router: GRouter<Types.Context>) => ({
  Auth: router.route("routerAuth"),
  UnAuth: router.route("routerUnAuth"),
  InQueue: router.route("routerInQueue"),
  InConnection: router.route("routerInConnection"),
  IsNotUsername: router.route("routerIsNotUsername"),
})

export const Router = Layer.effectDiscard(
  Effect.gen(function*(_) {
    const grammy = yield* Grammy;
    console.log("Router");

    const router = new GRouter<Types.Context>(context => Effect.runPromise(Routing(context)))

    const { Auth, IsNotUsername, UnAuth, InQueue, InConnection } = fabricRouting(router);

    IsNotUsername.hears("*", (context) => { safeReply(context, "Простите, но для использования этого бота, вам нужно настроить username!") })

    UnAuth.command("start", async (context) => { await stopAllConversation(context); await context.conversation.enter("toStartNotAuth"); })
    UnAuth.on("message", Search.toSearchNotAut)

    Auth.command("start", async (context) => { await stopAllConversation(context); await Start.toStartAuth(context); })
    Auth.command("stop", Chat.toStopConvectionIsNot)
    Auth.command("next", Search.toNextSearch)
    Auth.command("test", Settings.toSettings)
    Auth.hears("Найти 👩", Search.toSearch("women"));
    Auth.hears("Найти 👨", Search.toSearch("men"));
    Auth.hears("Найти 👽", Search.toSearch("any"));
    Auth.hears("Прекратить поиск ❌", Search.toStopSearchingIsNot);
    Auth.hears("Завершить ❌", Chat.toStopConvectionIsNot)
    Auth.hears("Настройки ⚙️", Settings.toSettings)
    Auth.hears("*", Chat.toStopConvectionIsNot)
    Auth.callbackQuery(/^rate_(.*)_(up|down)$/, toRaiting)

    InQueue.command("start", Start.toStartInQueue)
    InQueue.command("stop", Search.toStopSearching)
    InQueue.command("next", Search.toSearchInQueue)
    InQueue.hears(["Найти 👩", "Найти 👨", "Найти 👽"], Search.toSearchInQueue)
    InQueue.hears("Прекратить поиск ❌", Search.toStopSearching);
    InQueue.hears("*", Search.toSearchInQueue)

    InConnection.command("start", Start.toStartInConnection)
    InConnection.hears(["Найти 👩", "Найти 👨", "Найти 👽"], Search.toSearchInConnection)
    InConnection.hears("Прекратить поиск ❌", Search.toStopSearching);
    InConnection.hears("Завершить ❌", Chat.toStopConvection)
    InConnection.command("stop", Chat.toStopConvection)
    InConnection.hears("Следующий ➡️", Search.toNextSearch)
    InConnection.command("next", Search.toNextSearch)

    const forwarding = yield* Forwarding;

    InConnection.on(":text", forwarding.textMessage)
    InConnection.on(":photo", forwarding.photo)
    InConnection.on(":video", forwarding.video)
    InConnection.on(":video_note", forwarding.videoNote)
    InConnection.on(":sticker", forwarding.sticker)
    InConnection.on(":voice", forwarding.voice)
    InConnection.on("edit:text", (context) => Effect.gen(function*(_) {
      const connection = yield* ConnectionService;
      const companion = yield* connection.getCompanion(context);
      const message_id = Record.get(context.session.history, context.editedMessage!.message_id!.toString())
      if (Option.isSome(message_id))
        context.api.editMessageText(companion.chat, Number(message_id.value), context.editedMessage?.text!)
    }).pipe(
      Effect.provide(ConnectionServiceLive),
      Effect.runPromise,
    ))

    grammy.use(router);
  })
).pipe(
  Layer.provide(ConnectionServiceLive),
)

