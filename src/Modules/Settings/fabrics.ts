import { MenuFlavor } from "@grammyjs/menu";
import { User } from "../../Schemas/User.js";
import * as Types from "../../Types.js"
// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
import { Array, Boolean, Console, Effect, HashMap, Option } from "effect";
import { UserService, UserServiceLive } from "../../Services/User.js";
import { Drizzle } from "../../Databases/Drizzle.js";
import { users } from "../../Databases/tables.js";
import { eq } from "drizzle-orm";
import { defaultText } from "./text.js";
import { Redis } from "../../Databases/Redis.js";
import { safeReply } from "../../Shared/safeSend.js";
import { SettingsMenu } from "./keyboards.js";

export const fabricSetterGender = (gender: User["gender"]) => (context: Types.Context & MenuFlavor) => Effect.gen(function*(_) {
  const user = yield* _(UserService, Effect.andThen((service) => service.getSelf(context)));

  yield* Effect.promise(async () => {
    const resultEdit = await Drizzle.update(users).set({ gender }).where(eq(users.username, user.username)).returning();

    const result = Array.get(resultEdit, 0)
    if (Option.isSome(result)) {
      await Redis.hset(`user:${user.username}`, result.value)
      await Redis.expire(`user:${user.username}`, 24 * 60 * 60)
    }

  })
  yield* Effect.promise(() => context.editMessageText(defaultText));
  context.menu.back();

}).pipe(
  Effect.provide(UserServiceLive),
  Effect.runPromise
)

export const fabricSetterSettings = (print: ((self: User) => string), conversation: string, menu: string = "back-menu") =>
  (context: Types.Context & MenuFlavor) => Effect.gen(function*(_) {
    const user = yield* _(
      UserService,
      Effect.andThen((service) => service.getSelf(context))
    );
    yield* Effect.promise(() => context.editMessageText(print(user)));
    yield* Effect.promise(() => context.conversation.enter(conversation));

    context.menu.nav(menu);

  }).pipe(
    Effect.provide(UserServiceLive),
    Effect.runPromise
  )

export const fabricSettings = (key: keyof User, response: string) => (conv: Types.Conversation, context: Types.Context) => Effect.gen(function*(_) {
  const user = yield* _(
    UserService,
    Effect.andThen(service => service.getSelf(context))
  )
  yield* _(
    Effect.promise(() => conv.waitFor(":text")),
    Effect.andThen(({ message }) => Effect.promise(async () => {
      const [newUser] = await Drizzle.update(users).set({ [key]: message!.text! }).where(eq(users.username, user.username)).returning();
      await Redis.hset(`user:${user.username}`, newUser!)
      await Redis.expire(`user:${user.username}`, 24 * 60 * 60)
    }))
  )
  yield* safeReply(context, response)
  yield* Effect.promise(() => conv.run(SettingsMenu))

  if (conv.session.setting == undefined) yield* Effect.promise(() => context.reply(defaultText, { reply_markup: SettingsMenu }))
  else yield* Effect.promise(() => context.api.editMessageText(context.chatId!, conv.session.setting!, defaultText, { reply_markup: SettingsMenu }))


}).pipe(
  Effect.provide(UserServiceLive),
  Effect.runPromise
)


// async function addMovie(conversation: MyConv, ctx: MyCtx) {
//   await ctx.editMessageText("Enter your movie name", {
//     reply_markup: new InlineKeyboard().text("Back to start", "back")
//   });
//
//   const newCtx = await conversation.waitUnless((ctx) => !(ctx.hasCallbackQuery("back") || ctx.hasText(/.*/)), {
//     otherwise: async (ctx) => await ctx.reply('Use "back" btn or send text')
//   });
//
//   if (newCtx.callbackQuery?.data === "back") {
//     await conversation.run(startMenu);
//     await newCtx.api.editMessageText(ctx.chatId, ctx.msgId, "text", { reply_markup: startMenu });
//     return;
//   }
//
//   const movieText = newCtx.message?.text!;
//
//   conversation.session.movies.push(movieText);
//   await ctx.reply(`${movieText} added successfully!`);
// }
//
// export const addMovieConversation = createConversation(addMovie, { id: "add-movie" });
