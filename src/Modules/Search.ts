import { Effect, Option } from "effect";
import { Redis } from "../Databases/Redis.js";
import { EndSearhingKeyboard } from "../Keyboards/EndSearhing.js";
import { MainMenu } from "../Keyboards/Main.js";
import { StopConventionKeyboard } from "../Keyboards/StopConvention.js";
import { Queue } from "../Models/Queue.model.js";
import { User } from "../Models/User.model.js";
import { ConnectionService, ConnectionServiceLive } from "../Service/Connection.service.js";
import { QueueService, QueueServiceLive } from "../Service/Queue.service.js";
import { UserService, UserServiceLive } from "../Service/User.service.js";
import { GC } from "../types.js";
import { toStopConvection } from "./Chat.js";
import { safeReply } from "../Shared/safeSend.js";

const textToSearch = {
  men: "Начинаем искать парня с общими тегами",
  women: "Начинаем искать девушку с общими тегами",
  any: "Начинаем искать собеседника с общими тегами"
}

export const toSearch = (gender: User["gender"]) =>
  (context: GC) => Effect.gen(function*(_) {
    const queue = yield* QueueService;
    const User = yield* UserService;
    const Connection = yield* ConnectionService;

    const selfQueue = yield* _(
      User.getSelf(context),
      Effect.andThen((user: User) => queue.make(user, gender)),
      // Effect.map(h => deserializeQueue(h))
    )

    const matchUser = yield* queue.findRightOne(selfQueue)


    if (Option.isNone(matchUser)) {
      yield* Effect.promise(() => context.reply(textToSearch[gender], { reply_markup: EndSearhingKeyboard }));
      yield* queue.append(selfQueue);
    }
    else yield* Connection.connect(context, selfQueue, matchUser.value)

  }).pipe(
    Effect.provide(QueueServiceLive),
    Effect.provide(UserServiceLive),
    Effect.provide(ConnectionServiceLive),
    Effect.catchTags({
      "RedisAnyError": () => safeReply(context, "Простите. произошла какая-то ошибка, мы уже её исправляем", { reply_markup: MainMenu }),
      "UserNotFoundError": () => Effect.promise(() => toSearchNotAut(context)),
      // "UserAlreadyInQueue": () => Effect.promise(() => RToSearchInQueue(context))
    }),
    Effect.runPromise,
  )

export const getLastGender = (context: GC) =>
  Effect.promise(() => Redis.get(`lastsearch:${context.from!.username!}`)).pipe(
    Effect.map(h => (h || "any") as Queue["searchGender"]),
    Effect.runPromise,

  )
export const toNextSearch = async (context: GC) => {
  await toStopConvection(context);
  await toSearch(await getLastGender(context))(context)
}

export const toSearchNotAut = async (context: GC) => Effect.gen(function*(_) {
  yield* safeReply(context, "Для начала вам нужно зарегестрироваться");
  yield* Effect.promise(() => context.conversation.enter("toStartNotAuth"))
}).pipe(Effect.runPromise)

export const toSearchInQueue = async (context: GC) =>
  safeReply(context, "Вы уже находитесь в поиске", { reply_markup: EndSearhingKeyboard })
    .pipe(Effect.runPromise)

export const toSearchInConnection = async (context: GC) =>
  safeReply(context, "У вас уже есть собеседник", { reply_markup: StopConventionKeyboard })
    .pipe(Effect.runPromise)

export const toStopSearchingIsNot = async (context: GC) =>
  safeReply(context, "У вас уже есть собеседник", { reply_markup: StopConventionKeyboard })
    .pipe(Effect.runPromise)

export const toStopSearching = (context: GC) => Effect.gen(function*(_) {
  const { removal } = yield* QueueService;
  yield* removal(context)
  yield* safeReply(context, "Вы прекратили поиск собеседника", { reply_markup: MainMenu })
}).pipe(
  Effect.catchTag("UserIsNotQueue", () => safeReply(context, "Вы не находитесь в поиске", { reply_markup: MainMenu })),
  Effect.provide(QueueServiceLive),
  Effect.runPromise,
)



// export const LayerOfStart = Layer.mergeAll(StartWithAuth, StartNotAuth);
