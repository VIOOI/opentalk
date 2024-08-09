import { Console, Context, Data, Effect, Layer, Option, Random } from "effect";
import { isNotNull } from "effect/Predicate";
import { Redis } from "../Databases/Redis.js";
import { MainMenu } from "../Keyboards/Main.js";
import { RaitingInlineKeyboard } from "../Keyboards/Raiting.js";
import { StopConventionKeyboard } from "../Keyboards/StopConvention.js";
import { Queue } from "../Models/Queue.model.js";
import { User, deserializeUser } from "../Models/User.model.js";
import { safeReply, safeSendMessage } from "../Shared/safeSend.js";
import { GC } from "../types.js";
import { AdsService, AdsServiceLive } from "./Ads.service.js";
import { UserNotFoundError } from "./Database.service.js";
import { UserService, UserServiceLive } from "./User.service.js";

class UserIsNotConnection extends Data.TaggedError("UserIsNotConnection") { }

export class ConnectionService extends Context.Tag("ConnectionService")<
  ConnectionService,
  {
    connect: (context: GC, self: Queue, that: Queue) => Effect.Effect<void, UserNotFoundError>,
    // connects: (context: GC, self: Queue, that: Queue) => Effect.Effect<void, UserNotFoundError>,
    getCompanion: (context: GC) => Effect.Effect<User, UserIsNotConnection | UserNotFoundError>
    disconnect: (self: GC) => Effect.Effect<void, UserIsNotConnection | UserNotFoundError>
    isInConnection: (self: GC) => Effect.Effect<boolean>
  }
>() { }

const genderToEmoji = (self: User["gender"]) => ({
  "men": "👨",
  "women": "👩",
  "any": "👽"
})[self]

const printQueue = (self: User) => `${genderToEmoji(self.gender)} ${self.name} ${self.age}\n${self.description}`
// const notificationUser = (self: User, that: User) => Effect.promise

export const disconnectOfForbidden = (context: GC, self: Queue, that: Queue) => Effect.gen(function*(_) {

  yield* Effect.promise(async () => Redis.del(`connect:${self.id}`, `connect:${that.id}`));
  yield* safeReply(context, "Вас собеседник заблокировал бота, нам пришлось разорвать соединение", { reply_markup: MainMenu })
  yield* safeReply(context, "Если хотите, оставьте мнение о вашем собеседнике. Рейтинг сильно влияет на поиск", { reply_markup: RaitingInlineKeyboard(that as unknown as User) })

})

const printPostAds = (ctx: GC, self: User) => Effect.gen(function*(_) {
  const ads = yield* AdsService;
  const matchedAds = yield* ads.getMatched(self, "post").pipe(
    Effect.flatMap(Option.match({
      onSome: ads => Effect.succeed(ads),
      onNone: () => ads.getRandom("post"),
    })),
  );

  yield* safeSendMessage(ctx, self.chat, matchedAds.content);
}).pipe(
  Effect.catchTags({
    "ForbiddenError": () => Console.log(self),
    "UnknownMessageError": () => Console.log(self)
  }),
  Effect.provide(AdsServiceLive)
)
const getInlineAgs = (self: User) => Effect.gen(function*(_) {
  const ads = yield* AdsService;
  return yield* ads.getMatched(self, "small").pipe(
    Effect.flatMap(Option.match({
      onSome: ads => Effect.succeed(ads),
      onNone: () => ads.getRandom("small"),
    })),
  );
}).pipe(
  Effect.provide(AdsServiceLive)
)

export const ConnectionServiceLive = Layer.effect(
  ConnectionService,
  Effect.gen(function*() {
    const User = yield* UserService;
    return {
      connect: (ctx: GC, self: Queue, that: Queue) => Effect.gen(function*() {
        const user = yield* User.getById(that.id);
        const selfUser = yield* User.getSelf(ctx);

        const connectFromQueue = (self: Queue, that: Queue) => Effect.promise(async () => {
          await Redis.set(`connect:${self.id}`, that.id)
          await Redis.del(`queue:${self.id}`)
        })
        const connectSelf = Effect.gen(function*(_) {
          yield* connectFromQueue(self, that);

          yield* safeReply(ctx, "Мы нашли для вас собеседника, приятного общения")
          yield* safeReply(ctx, printQueue(user), { reply_markup: StopConventionKeyboard })
        }).pipe(
          Effect.catchTags({
            "ForbiddenError": () => disconnectOfForbidden(ctx, that, self)
          }),
        )

        const connectThat = Effect.gen(function*(_) {
          yield* connectFromQueue(that, self);

          yield* safeSendMessage(ctx, user.chat, "Мы нашли для вас собеседника, приятного общения")
          yield* safeSendMessage(ctx, user.chat, printQueue(selfUser), { reply_markup: StopConventionKeyboard })
        }).pipe(
          Effect.catchTags({
            "ForbiddenError": () => disconnectOfForbidden(ctx, self, that)
          }),
        )

        yield* Effect.all([connectSelf, connectThat])

      }).pipe(
        Effect.catchTags({
          "ForbiddenError": () => Console.log(self, that),
          "UnknownMessageError": () => Console.log(self, that)
        }),
      ),

      getCompanion: (context: GC) => Effect.gen(function*(_) {
        return yield* Effect.promise(() => Redis.get(`connect:${context.from!.username!}`)).pipe(
          Effect.filterOrFail(
            isNotNull,
            () => new UserIsNotConnection(),
          ),
          Effect.andThen(User.getById),
        )
      }),

      disconnect: (self: GC) => Effect.gen(function*(_) {
        const selfUser = yield* User.getSelf(self);

        const companion = yield* _(
          Effect.promise(() => Redis.get(`connect:${self.from!.username!}`)),
          Effect.filterOrFail(
            isNotNull,
            () => new UserIsNotConnection(),
          ),
          Effect.andThen(User.getById),
        );

        const disconnectAll = (self: User, that: User) => Effect.gen(function*(_) {
          yield* Effect.promise(() => Redis.del(`connect:${self.id}`))
          yield* Effect.promise(() => Redis.del(`connect:${that.id}`))
        })

        const messageSelf = Effect.gen(function*(_) {
          const isPostAds = yield* Random.nextRange(0, 10).pipe(
            Effect.map(n => n > 8)
          );
          const inlineAds = yield* getInlineAgs(companion);
          console.log(isPostAds)

          yield* safeReply(self,
            `Вы завершили чат с собеседником( ${!isPostAds ? ("\n\n" + inlineAds.content) : ""}`,
            { reply_markup: MainMenu }
          )
          yield* safeReply(self, "Если хотите, оставьте мнение о вашем собеседнике. Рейтинг сильно влияет на поиск\n@opentalkru", { reply_markup: RaitingInlineKeyboard(companion) })
          yield* (isPostAds ? printPostAds(self, selfUser) : Effect.void);
          //   yield* safeReply(ctx, printQueue(user), { reply_markup: StopConventionKeyboard })
        }).pipe(
          Effect.catchTags({
            "ForbiddenError": () => Console.log(selfUser),
            "UnknownMessageError": () => Console.log(selfUser)
          }),
        )
        
        const messageCompanion = Effect.gen(function*(_) {
          const isPostAds = yield* Random.nextRange(0, 10).pipe(
            Effect.map(n => n > 8)
          );
          const inlineAds = yield* getInlineAgs(selfUser);
          console.log(isPostAds)

          yield* safeSendMessage(self, companion.chat,
            `Собеседник завершил с вами чат( ${!isPostAds ? ("\n\n" + inlineAds.content) : ""}`,
            { reply_markup: MainMenu }
          )
          yield* safeSendMessage(self, companion.chat, "Если хотите, оставьте мнение о вашем собеседнике. Рейтинг сильно влияет на поиск\n@opentalkru", { reply_markup: RaitingInlineKeyboard(companion) })
          yield* (isPostAds ? printPostAds(self, companion) : Effect.void);
        }).pipe(
          Effect.catchTags({
            "ForbiddenError": () => Console.log(selfUser),
            "UnknownMessageError": () => Console.log(selfUser)
          }),
        )

        yield* Effect.all([
          disconnectAll(selfUser, companion),
          messageSelf,
          messageCompanion,
        ])

      }).pipe(
        Effect.provide(AdsServiceLive)
      ),
      isInConnection: (self: GC) => Effect.gen(function*(_) {
        return yield* _(
          Effect.promise(() => Redis.get(`connect:${self.from!.username!}`)),
          Effect.filterOrFail(
            isNotNull,
            () => new UserIsNotConnection(),
          ),
          Effect.match({
            onSuccess: () => true,
            onFailure: () => false,
          })
        );
      })
    }
  })
).pipe(
  Layer.provide(UserServiceLive)
)
