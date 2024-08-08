import { Context, Data, Effect, Layer } from "effect";
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

export const ConnectionServiceLive = Layer.effect(
  ConnectionService,
  Effect.gen(function*() {
    const User = yield* UserService;
    return {
      connect: (context: GC, self: Queue, that: Queue) => Effect.gen(function*() {
        const user = yield* User.getById(that.id);
        const selfUser = yield* User.getSelf(context);

        yield* Effect.promise(async () => {
          await Redis.set(`connect:${self.id}`, that.id)
          await Redis.del(`queue:${self.id}`)
          
          await context.reply("Мы нашли дл вас собеседника, приятного общения", )
          await context.reply(printQueue(user), { reply_markup: StopConventionKeyboard })
        });

        yield* Effect.promise(async () => {
          await Redis.set(`connect:${that.id}`, self.id)
          await Redis.del(`queue:${that.id}`)
          
          await context.api.sendMessage(user.chat, "Мы нашли дл вас собеседника, приятного общения")
          await context.api.sendMessage(user.chat, printQueue(selfUser), { reply_markup: StopConventionKeyboard })
        });
      }),
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
