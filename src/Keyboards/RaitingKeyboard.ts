// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
import { Array, Effect } from "effect";
import { eq } from "drizzle-orm";
import { Redis } from "../Databases/Redis.js";
import { InlineKeyboard } from "grammy";
import { User } from "../Schemas/User.js";
import * as Types from "../Types.js"
import { UserService, UserServiceLive } from "../Services/User.js";
import { Drizzle } from "../Databases/Drizzle.js";
import { users } from "../Databases/Tables/User.js";


export const RaitingInlineKeyboard = (self: User) => new InlineKeyboard()
  .text("👍", `rate_${self.username}_up`)
  .text("👎", `rate_${self.username}_down`)

export const toRaiting = (context: Types.Context) => Effect.gen(function*(_) {
  
  // @ts-ignore
  const [__, id, action] = context.match;

  context.editMessageText("Спасибо за оставленую реакцию")
  const user = yield* _(
    UserService,
    Effect.andThen(service => service.getById(id))
  )
  yield* _(
    Effect.promise(
      () => Drizzle.update(users)
        .set({
          rating: action === "up"
            ? `${user.rating.at(0)! + 1} ${user.rating.at(1)!}`
            : `${user.rating.at(0)} ${user.rating.at(1)! + 1}`

        })
        .where(eq(users.username, user.username)).returning()
    ),
    Effect.map(Array.unsafeGet(0)),
    Effect.andThen(user => Effect.promise(async () => {
      await Redis.hset(`user:${user.username}`, user)
      await Redis.expire(`user:${user.username}`, 24 * 60 * 60)
    }))
  )
}).pipe(
  Effect.provide(UserServiceLive),
  Effect.runPromise
)
