import { Console, Context, Data, Effect, Layer } from "effect";
import { Redis } from "../Databases/Redis.js";
import { Queue } from "../Models/Queue.model.js";
import { deserializeUser, User } from "../Models/User.model.js";
import { GC } from "../types.js";
import { UserService, UserServiceLive } from "./User.service.js";
import { isNotNull } from "effect/Predicate";
import { UserNotFoundError } from "./Database.service.js";
import { MainMenu } from "../Keyboards/Main.js";
import { StopConventionKeyboard } from "../Keyboards/StopConvention.js";
import { RaitingInlineKeyboard } from "../Keyboards/Raiting.js";
import { safeReply, safeSendMessage } from "../Shared/safeSend.js";

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

export const ConnectionServiceLive = Layer.effect(
  ConnectionService,
  Effect.gen(function*() {
    const User = yield* UserService;
    return {
      connect: (context: GC, self: Queue, that: Queue) => Effect.gen(function*() {
        const user = yield* User.getById(that.id);
        const selfUser = yield* User.getSelf(context);

        const connectFromQueue = (self: Queue, that: Queue) => Effect.promise(async () => {
          await Redis.set(`connect:${self.id}`, that.id)
          await Redis.del(`queue:${self.id}`)
        })
        yield* Effect.gen(function*(_) {
          yield* connectFromQueue(self, that);

          yield* safeReply(context, "Мы нашли дл вас собеседника, приятного общения")
          yield* safeReply(context, printQueue(user), { reply_markup: StopConventionKeyboard })
        }).pipe(
          Effect.catchTags({
            "ForbiddenError": () => disconnectOfForbidden(context, that, self)
          }),
        )

        yield* Effect.gen(function*(_) {
          yield* connectFromQueue(that, self);

          yield* safeSendMessage(context, user.chat, "Мы нашли дл вас собеседника, приятного общения")
          yield* safeSendMessage(context, user.chat, printQueue(selfUser), { reply_markup: StopConventionKeyboard })
        }).pipe(
          Effect.catchTags({
            "ForbiddenError": () => disconnectOfForbidden(context, self, that)
          }),
        )

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

        yield* Effect.promise(async () => {
          await Redis.del(`connect:${selfUser.id}`)
          await self.reply("Вы завершили чат с собеседником(", { reply_markup: MainMenu })
          await self.reply("Если хотите, оставьте мнение о вашем собеседнике. Рейтинг сильно влияет на поиск\n@opentalkru", { reply_markup: RaitingInlineKeyboard(companion) })

          await Redis.del(`connect:${companion.id}`)
          await self.api.sendMessage(companion.chat, "Собеседник завершил с вами чат(", { reply_markup: MainMenu })
          await self.api.sendMessage(companion.chat, "Если хотите, оставьте мнение о вашем собеседнике. Рейтинг сильно влияет на поиск\n@opentalkru", { reply_markup: RaitingInlineKeyboard(selfUser) })
        });

      }),
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
