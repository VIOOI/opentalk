import { Menu, MenuFlavor, MenuButton } from "@grammyjs/menu";
import { eq } from "drizzle-orm";
import { Array, Effect, Option, Record } from "effect";
import { safeReply } from "../Shared/safeSend.js";
import { User } from "../Schemas/User.js";
import * as Types from "../Types.js"
import { UserService, UserServiceLive } from "../Services/User.js";
import { users } from "../Databases/tables.js";
import { TagsKeyboard } from "../Keyboards/TagsKeyboard.js";
import { Drizzle } from "../Databases/Drizzle.js";
import { Redis } from "../Databases/Redis.js";

const defaultText = "Выберите настройки, которые вы хотели бы поменять:"

const genderToWord = (self: User["gender"]) => ({
  "men": "Мужской",
  "women": "Женский",
  "any": "Неопределённый"
})[self]

const textToGender = (self: User) => `У вас установлен ${genderToWord(self.gender)} пол
Чтобы изменять или удалить пол, нажмите на кнопки ниже`

const textToAge = (self: User) => `Ваш возраст: ${self.age}

Введите ваш возраст цифрами (от 9 до 99), чтобы мы могли находить вам наиболее подходящих собеседников.

Например, если вам 21 год, напишите 21:`;

const textToName = (self: User) => `Ваше имя ${self.name}

Введите новое, чтобы его изменять:`;

const textToDescription = (self: User) => `Выше описание:
${self.description}

Введите новое описание чтобы изменить его:`;

const textToTags = (self: User) => `Выберите интересы для поиска, по ним мы будем искать для вас собеседника и по ним будут искать вас. 

Так же вы можете написать теги для сужения поиска собеседника, чтобы мы общались с наиболее подходящим собеседником.
Выши теги: ${self.tags}

Теги пишутся черезер пробел, например: Аниме игры фильмы`;

export const BackAgeMenu = new Menu<Types.Context>("back-menu").back("← назад", async (context) => {
  context.editMessageText(defaultText);

  await Effect.runPromise(
    Effect.promise(() => context.conversation.active()).pipe(
      Effect.andThen((conv) => Effect.all(
        Record.keys(conv)
          .map(conv => Effect.promise(() => context.conversation.exit(conv)))
      ))
    )
  )
});

const effectSetGender = (gender: User["gender"]) => (context: Types.Context & MenuFlavor) => Effect.gen(function*(_) {
  const user = yield* _(
    UserService,
    Effect.andThen((service) => service.getSelf(context))
  );
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

export const SetGenderMenu = new Menu<Types.Context>("set-gender-menu")
  .text("Мужской 👨", effectSetGender("men"))
  .text("Женский 👩", effectSetGender("women")).row()
  .text("Удалить ❌", effectSetGender("any")).row()
  .back("← назад", async (context) => context.editMessageText(defaultText))


const effectSetSetting = (print: ((self: User) => string), conversation: string, menu: string = "back-menu") =>
  (context: Types.Context & MenuFlavor) => Effect.gen(function*(_) {
    const user = yield* _(
      UserService,
      Effect.andThen((service) => service.getSelf(context))
    );
    yield* Effect.promise(() => context.editMessageText(print(user)));
    yield* Effect.promise(() => context.conversation.enter(conversation)); // BUG: TypeError: Cannot read properties of undefined (reading 'enter')
    context.menu.nav(menu);

  }).pipe(
    Effect.provide(UserServiceLive),
    Effect.runPromise
  )

export const SettingsMenu = new Menu<Types.Context>("settings-menu")
  .text("Имя", effectSetSetting(textToName, "settingsName"))
  .text("Пол", async (context) => Effect.gen(function*(_) {
    const user = yield* _(
      UserService,
      Effect.andThen((service) => service.getSelf(context))
    );
    yield* Effect.promise(() => context.editMessageText(textToGender(user)));
    context.menu.nav("set-gender-menu");

  }).pipe(
    Effect.provide(UserServiceLive),
    Effect.runPromise
  )).row()
  .text("Возраст", effectSetSetting(textToAge, "settingsAge"))
  .text("Теги", effectSetSetting(textToTags, "settingsTags", "select-tags-keyboard")).row()
  .text("Описание", effectSetSetting(textToDescription, "settingsDescription"))

SettingsMenu.register(BackAgeMenu);
SettingsMenu.register(TagsKeyboard.back("← назад", async (context) => {
  context.editMessageText(defaultText);

  await Effect.runPromise(
    Effect.promise(() => context.conversation.active()).pipe(
      Effect.andThen((conv) => Effect.all(
        Record.keys(conv)
          .map(conv => Effect.promise(() => context.conversation.exit(conv)))
      ))
    )
  )
}));
SettingsMenu.register(SetGenderMenu);


const fabricSettings = (key: keyof User, response: string) => (conv: Types.Conversation, context: Types.Context) => Effect.gen(function*(_) {
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
}).pipe(
  Effect.provide(UserServiceLive),
  Effect.runPromise
)

export const Settings = {
  Name: fabricSettings("name", "Мы изменили ваше имя"),
  Age: fabricSettings("age", "Мы изменили ваш возраст"),
  Tags: (conv: Types.Conversation, context: Types.Context) => Effect.gen(function*(_) {
    const user = yield* _(
      UserService,
      Effect.andThen(service => service.getSelf(context))
    )
    yield* _(
      Effect.promise(() => conv.waitFor(":text")),
      Effect.andThen(({ message }) => Effect.promise(async () => {
        const [newUser] = await Drizzle.update(users).set({ tags: message!.text!.toLowerCase() }).where(eq(users.username, user.username)).returning();
        await Redis.hset(`user:${user.username}`, newUser!)
        await Redis.expire(`user:${user.username}`, 24 * 60 * 60)
      }))
    )
    yield* safeReply(context, "Мы изменили ваши теги")
  }).pipe(
    Effect.provide(UserServiceLive),
    Effect.runPromise
  ),
  Description: fabricSettings("description", "Мы изменили ваше описание"),
  // Gender: fabricSettings("gender", "Мы изменили ваш пол")
}



export const toSettings = (context: Types.Context) =>
  safeReply(context, "Выберите настройки, которые вы хотели бы поменять:", { reply_markup: SettingsMenu })
    .pipe(Effect.runPromise)
