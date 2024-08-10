import { Console, Effect, Option } from "effect";
import { Redis } from "../Databases/Redis.js";
import { EndSearhingKeyboard } from "../Keyboards/EndSearhing.js";
import { MainMenu } from "../Keyboards/Main.js";
import { StopConventionKeyboard } from "../Keyboards/StopConvention.js";
import { Queue } from "../Schemas/Queue.js";
import { User } from "../Schemas/User.js";
import { ConnectionService, ConnectionServiceLive } from "../Services/Connection.js";
import { QueueService, QueueServiceLive } from "../Services/Queue.js";
import { UserService, UserServiceLive } from "../Services/Users.js";
import { safeReply } from "../Shared/safeSend.js";
import * as Types from "../Types.js"
import { toStopConvection } from "./Chat.js";

const textToSearch = {
  men: "Начинаем искать парня с общими тегами",
  women: "Начинаем искать девушку с общими тегами",
  any: "Начинаем искать собеседника с общими тегами"
}

export const toSearch = (gender: User["gender"]) =>
  (context: Types.Context) => Effect.gen(function*(_) {
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
      yield* safeReply(context, textToSearch[gender], { reply_markup: EndSearhingKeyboard });
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
      "UserAlreadyInQueue": () => Effect.promise(() => toSearchInQueue(context)),
      "ForbiddenError": () => Console.log(context),
      "UnknownMessageError": () => Console.log(context)
    }),
    Effect.runPromise,
  )

export const getLastGender = (context: Types.Context) =>
  Effect.promise(() => Redis.get(`search:${context.from!.username!}`)).pipe(
    Effect.map(h => (h || "any") as Queue["searchGender"]),
    Effect.runPromise,

  )
export const toNextSearch = async (context: Types.Context) => {
  await toStopConvection(context);
  await toSearch(await getLastGender(context))(context)
}

export const toSearchNotAut = async (context: Types.Context) => Effect.gen(function*(_) {
  yield* safeReply(context, "Для начала вам нужно зарегестрироваться");
  yield* Effect.promise(() => context.conversation.enter("toStartNotAuth"))
})
  .pipe(
    Effect.catchTags({
      "ForbiddenError": () => Console.log(context),
      "UnknownMessageError": () => Console.log(context)
    }),
    Effect.runPromise
  )

export const toSearchInQueue = async (context: Types.Context) =>
  safeReply(context, "Вы уже находитесь в поиске", { reply_markup: EndSearhingKeyboard })
    .pipe(
      Effect.catchTags({
        "ForbiddenError": () => Console.log(context),
        "UnknownMessageError": () => Console.log(context)
      }),
      Effect.runPromise
    )

export const toSearchInConnection = async (context: Types.Context) =>
  safeReply(context, "У вас уже есть собеседник", { reply_markup: StopConventionKeyboard })
    .pipe(
      Effect.catchTags({
        "ForbiddenError": () => Console.log(context),
        "UnknownMessageError": () => Console.log(context)
      }),
      Effect.runPromise
    )

export const toStopSearchingIsNot = async (context: Types.Context) =>
  safeReply(context, "У вас и так нету собеседника", { reply_markup: StopConventionKeyboard })
    .pipe(
      Effect.catchTags({
        "ForbiddenError": () => Console.log(context),
        "UnknownMessageError": () => Console.log(context)
      }),
      Effect.runPromise
    )

export const toStopSearching = (context: Types.Context) => Effect.gen(function*(_) {
  const { removal } = yield* QueueService;
  yield* removal(context)
  yield* safeReply(context, "Вы прекратили поиск собеседника", { reply_markup: MainMenu })
}).pipe(
  Effect.catchTags({
    "UserIsNotQueue": () => safeReply(context, "Вы не находитесь в поиске", { reply_markup: MainMenu }),
    "ForbiddenError": () => Console.log(context),
    "UnknownMessageError": () => Console.log(context)
  }),
  Effect.provide(QueueServiceLive),
  Effect.runPromise,
)



// export const LayerOfStart = Layer.mergeAll(StartWithAuth, StartNotAuth);
