// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
import { Array, Effect, Number, Option } from "effect";
import { UserService, UserServiceLive } from "../../Services/User.js";
import { fabricSettings } from "./fabrics.js";
import { Drizzle } from "../../Databases/Drizzle.js";
import { Redis } from "../../Databases/Redis.js";
import { safeReply } from "../../Shared/safeSend.js";
import * as Types from "../../Types.js"
import { users } from "../../Databases/tables.js";
import { eq } from "drizzle-orm";
import { isValidateTags, serializeTags, User } from "../../Schemas/User.js";
import { TagsKeyboard } from "../../Keyboards/TagsKeyboard.js";
import { defaultText } from "./text.js";
import { SettingsMenu } from "./keyboards.js";


export const settingsName = (conv: Types.Conversation, context: Types.Context) => Effect.gen(function*(_) {
  
  const name = yield* _(
    Effect.promise(() => conv.waitFor("message:text")),
    Effect.map(({ message }) => message.text),
  );

  const user = yield* _(UserService, Effect.andThen(service => service.getSelf(context)))
  yield* Effect.promise(() => Drizzle.update(users).set({ name }).where(eq(users.username, user.username)).returning())
  yield* Effect.promise(() => conv.run(SettingsMenu))

  if (conv.session.setting == undefined)
    yield* Effect.promise(() => context.reply(defaultText, { reply_markup: SettingsMenu }))
  else yield* Effect.promise(() => context.api.editMessageText(context.chatId!, conv.session.setting!, defaultText, { reply_markup: SettingsMenu }))

  yield* safeReply(context, "Мы изменили ваше имя")

}).pipe(
  Effect.provide(UserServiceLive),
  Effect.runPromise
)

export const settingsAge = (conv: Types.Conversation, context: Types.Context) => Effect.gen(function*(_) {
  const age = yield* Effect.iterate(
    [Option.none(), true] as [Option.Option<number>, boolean],
    {
      while: state => Option.isNone(state[0]),
      body: ([_, isFirst]) =>
        Effect.gen(function*(_) {
          if (!isFirst) yield* safeReply(context, "Вы должны ввести число от 1 до 99");

          return yield* _(
            Effect.promise(() => conv.waitFor("message:text")),
            Effect.map(({ message }) => Number.parse(message.text)),
            Effect.map(Option.filter(state => state > 0 && state < 100)),
            Effect.map(
              option => [option, false] as [Option.Option<number>, boolean],
            ),
          );
        }),
    },
  ).pipe(Effect.map(state => Option.getOrElse(state[0], () => 18)))

  const user = yield* _( UserService, Effect.andThen(service => service.getSelf(context)))
  
  yield* Effect.promise(() => Drizzle.update(users).set({ age }).where(eq(users.username, user.username)).returning())
  yield* Effect.promise(() => conv.run(SettingsMenu))

  if (conv.session.setting == undefined)
    yield* Effect.promise(() => context.reply(defaultText, { reply_markup: SettingsMenu }))
  else yield* Effect.promise(() => context.api.editMessageText(context.chatId!, conv.session.setting!, defaultText, { reply_markup: SettingsMenu }))

  yield* safeReply(context, "Мы изменили ваш возраст")

}).pipe(
  Effect.provide(UserServiceLive),
  Effect.runPromise
)



export const settingsTags = (conv: Types.Conversation, context: Types.Context) => Effect.gen(function*(_) {
  const user = yield* _(
    UserService,
    Effect.andThen(service => service.getSelf(context))
  )
  const tags = yield* Effect.iterate(
    [Option.none(), true] as [Option.Option<User["tags"]>, boolean],
    {
      while: state => Option.isNone(state[0]),
      body: ([_, isFirst]) =>
        Effect.gen(function*(_) {
          if (!isFirst)
            yield* safeReply(context, "Вы ввели теги не правильно, прочтитайте пожалуйста пост и попробуйте снова");

          return yield* _(
            Effect.promise(() => conv.waitFor("message:text")),
            Effect.andThen(({ message }) =>
              Effect.if(message.text === "Пропустить", {
                onTrue: () => Effect.succeed(Option.some<User["tags"]>([])),
                onFalse: () =>
                  Effect.succeed(
                    isValidateTags(message.text).pipe(
                      Option.map(Array.filter(state => state.name !== "")),
                      Option.filter(state => state.length > 0),
                    ),
                  ),
              }),
            ),
            Effect.map(
              option =>
                [option, false] as [Option.Option<User["tags"]>, boolean],
            ),
          );
        }),
    },
  ).pipe(
    Effect.map(state => Option.getOrElse(state[0], () => [] as User["tags"])),
  );
  yield* Effect.promise(() => Drizzle.update(users).set({ tags: serializeTags(tags) }).where(eq(users.username, user.username)).returning())
  yield* Effect.promise(() => conv.run(SettingsMenu))

  if (conv.session.setting == undefined)
    yield* Effect.promise(() => context.reply(defaultText, { reply_markup: SettingsMenu }))
  else yield* Effect.promise(() => context.api.editMessageText(context.chatId!, conv.session.setting!, defaultText, { reply_markup: SettingsMenu }))

  yield* safeReply(context, "Мы изменили ваши теги")
}).pipe(
  Effect.provide(UserServiceLive),
  Effect.runPromise
);





export const settingsDescription = (conv: Types.Conversation, context: Types.Context) => Effect.gen(function*(_) {
  const description = yield* _(
    Effect.promise(() => conv.waitFor("message:text")),
    Effect.map(({ message }) => message.text),
  );

  const user = yield* _(
    UserService,
    Effect.andThen(service => service.getSelf(context))
  )
  yield* Effect.promise(() => Drizzle.update(users).set({ description }).where(eq(users.username, user.username)).returning())
  yield* Effect.promise(() => conv.run(SettingsMenu))

  if (conv.session.setting == undefined)
    yield* Effect.promise(() => context.reply(defaultText, { reply_markup: SettingsMenu }))
  else yield* Effect.promise(() => context.api.editMessageText(context.chatId!, conv.session.setting!, defaultText, { reply_markup: SettingsMenu }))

  yield* safeReply(context, "Мы изменили ваше описание")
}).pipe(
  Effect.provide(UserServiceLive),
  Effect.runPromise
)
