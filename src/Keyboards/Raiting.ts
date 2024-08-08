import { Menu } from "@grammyjs/menu";
import { Array, Effect } from "effect";
import { UserService, UserServiceLive } from "../Service/User.service.js";
import { ConnectionService, ConnectionServiceLive } from "../Service/Connection.service.js";
import { GC } from "../types.js";
import { Drizzle } from "../Databases/Drizzle.js";
import { UserTable } from "../Databases/User.table.js";
import { eq } from "drizzle-orm";
import { Redis } from "../Databases/Redis.js";
import { User } from "../Models/User.model.js";
import { InlineKeyboard } from "grammy";


// export const RaitingInlineKeyboard = new Menu<GC>("raiting-menu")

export const RaitingInlineKeyboard = (self: User) => new InlineKeyboard()
  .text("👍", `rate_${self.id}_up`)
  .text("👎", `rate_${self.id}_down`)

// bot.callbackQuery(/^rate_(.*)_(up|down)$/, async (ctx) => {
//   const id = ctx.match[1];
//   const action = ctx.match[2];
//   if (action === 'up') {
//     // Ваш код для действия "👍" с использованием id
//   } else if (action === 'down') {
//     // Ваш код для действия "👎" с использованием id
//   }
//   await ctx.answerCallbackQuery();
// });

export const RToRaiting = (context: GC) => Effect.gen(function*(_) {
  // @ts-ignore
  const [__, id, action] = context.match;

  context.editMessageText("Спасибо за оставленую реакцию")
  // context.api.editMessageReplyMarkupInline(String(context.message?.message_id!), { reply_markup: undefined });
  const user = yield* _(
    UserService,
    Effect.andThen(service => service.getById(id))
  )
  yield* _(
    Effect.promise(
      () => Drizzle.update(UserTable)
        .set({
          raiting: action === "up"
            ? `${user.raiting.likes + 1}/${user.raiting.dislikes}`
            : `${user.raiting.likes}/${user.raiting.dislikes + 1}`
        })
        .where(eq(UserTable.id, user.id)).returning()
    ),
    Effect.map(Array.unsafeGet(0)),
    Effect.andThen(user => Effect.promise(async () => {
      await Redis.hset(`user:${user.id}`, user)
      await Redis.expire(`user:${user.id}`, 24 * 60 * 60)
    }))
  )
}).pipe(
  Effect.provide(UserServiceLive),
  Effect.runPromise
)

// export const fabricRaitingKayboard = (self: User) => RaitingInlineKeyboard
//   .text("👍", () => Effect.gen(function*(_) {
//     yield* _(
//       Effect.promise(
//         () => Drizzle.update(UserTable)
//           .set({ raiting: `${self.raiting.likes + 1}/${self.raiting.dislikes}` })
//           .where(eq(UserTable.id, self.id)).returning()
//       ),
//       Effect.map(Array.unsafeGet(0)),
//       Effect.andThen(user => Redis.hset(`user:${user.id}`, user))
//     )
//   }).pipe( Effect.runPromise ))
//   .text("👎", () => Effect.gen(function*(_) {
//     yield* _(
//       Effect.promise(
//         () => Drizzle.update(UserTable)
//           .set({ raiting: `${self.raiting.likes}/${self.raiting.dislikes + 1}` })
//           .where(eq(UserTable.id, self.id)).returning()
//       ),
//       Effect.map(Array.unsafeGet(0)),
//       Effect.andThen(user => Redis.hset(`user:${user.id}`, user))
//     )
//   }).pipe( Effect.runPromise ))
//
