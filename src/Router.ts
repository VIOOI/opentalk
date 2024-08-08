import { Router as GRouter } from "@grammyjs/router"
import { Effect, Record } from "effect";
import { Bot } from "grammy";
import { RToRaiting } from "./Keyboards/Raiting.js";
import { Forwarding, toStopConvection, toStopConvectionIsNot } from "./Modules/Chat.js"
import {
  toNextSearch,
  toSearch,
  toSearchInConnection,
  toSearchInQueue,
  toSearchNotAut,
  toStopSearching,
  toStopSearchingIsNot
} from "./Modules/Search.js";
import { toSettings } from "./Modules/Settings.js";
import { RToStartAuth, toStartInConnection, toStartInQueue } from "./Modules/Start.js";
import { ConnectionService, ConnectionServiceLive } from "./Service/Connection.service.js";
import { QueueService, QueueServiceLive } from "./Service/Queue.service.js";
import { UserService, UserServiceLive } from "./Service/User.service.js";
import { GC } from "./types.js";
import { safeReply } from "./Shared/safeSend.js";


export const Router = (grammy: Bot<GC>) => Effect.gen(function*() {
  const user = yield* UserService;
  const queue = yield* QueueService;
  const connection = yield* ConnectionService;

  const router = new GRouter<GC>((context) => Effect.gen(function*() {
    if (context.from!.username === undefined) return "routerIsNotUsername"

    yield* user.getSelf(context);
    const isInQueue = yield* queue.isInQueue(context)
    const isInConnection = yield* connection.isInConnection(context)

    if (isInQueue) return "routerInQueue"
    if (isInConnection) return "routerInConnection"

    return "routerAuth"

  }).pipe(
    Effect.catchTag("UserNotFoundError", () => Effect.succeed("routerUnAuth")),
    Effect.catchTag("RedisAnyError", () => Effect.succeed("routerUnAuth")),
    Effect.runPromise
  ))

  const routerAuth = router.route("routerAuth");
  const routerUnAuth = router.route("routerUnAuth")
  const routerInQueue = router.route("routerInQueue")
  const routerInConnection = router.route("routerInConnection")
  const routerIsNotUsername = router.route("routerIsNotUsername")

  routerIsNotUsername.hears("*", (context) => {
    safeReply(context, "Простите, но для использования этого бота, вам нужно настроить username!")
  })

  routerUnAuth.command("start", async ({ conversation }) => {
    await Effect.runPromise(
      Effect.promise(() => conversation.active()).pipe(
        Effect.andThen((conv) => Effect.all(
          Record.keys(conv)
            .map(conv => Effect.promise(() => conversation.exit(conv)))
        ))
      )
    )
    await conversation.enter("toStartNotAuth")
  })
  routerUnAuth.on("message", toSearchNotAut)

  routerAuth.command("start", async (context) => {
    await Effect.runPromise(
      Effect.promise(() => context.conversation.active()).pipe(
        Effect.andThen((conv) => Effect.all(
          Record.keys(conv)
            .map(conv => Effect.promise(() => context.conversation.exit(conv)))
        ))
      )
    )
    await RToStartAuth(context)
  })
  routerAuth.command("stop", toStopConvectionIsNot)
  routerAuth.command("next", toNextSearch)
  routerAuth.command("test", toSettings)
  routerAuth.hears("Найти 👩", toSearch("women"));
  routerAuth.hears("Найти 👨", toSearch("men"));
  routerAuth.hears("Найти 👽", toSearch("any"));
  routerAuth.hears("Прекратить поиск ❌", toStopSearchingIsNot);
  routerAuth.hears("Завершить ❌", toStopConvectionIsNot)

  routerAuth.hears("Настройки ⚙️", toSettings)
  routerAuth.hears("*", toStopConvectionIsNot)

  routerAuth.callbackQuery(/^rate_(.*)_(up|down)$/, RToRaiting)

  routerInQueue.command("start", toStartInQueue)
  routerInQueue.command("stop", toStopSearching)
  routerInQueue.command("next", toSearchInQueue)
  routerInQueue.hears(["Найти 👩", "Найти 👨", "Найти 👽"], toSearchInQueue)
  routerInQueue.hears("Прекратить поиск ❌", toStopSearching);
  routerInQueue.hears("*", toSearchInQueue)

  routerInConnection.command("start", toStartInConnection)
  routerInConnection.hears(["Найти 👩", "Найти 👨", "Найти 👽"], toSearchInConnection)
  routerInConnection.hears("Прекратить поиск ❌", toStopSearching);


  routerInConnection.hears("Завершить ❌", toStopConvection)
  routerInConnection.command("stop", toStopConvection)
  routerInConnection.hears("Следующий ➡️", toNextSearch)
  routerInConnection.command("next", toNextSearch)

  const forwarding = yield* Forwarding;

  routerInConnection.on(":text", forwarding.textMessage)
  routerInConnection.on(":photo", forwarding.photo)
  routerInConnection.on(":video", forwarding.video)
  routerInConnection.on(":video_note", forwarding.videoNote)
  routerInConnection.on(":sticker", forwarding.sticker)
  routerInConnection.on(":voice", forwarding.voice)


  grammy.use(router);

}).pipe(
  Effect.provide(QueueServiceLive),
  Effect.provide(UserServiceLive),
  Effect.provide(ConnectionServiceLive),
)
