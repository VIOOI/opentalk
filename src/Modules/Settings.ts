import { Menu, MenuFlavor } from "@grammyjs/menu";
import { eq } from "drizzle-orm";
import { Effect, Record } from "effect";
import { Drizzle } from "../Databases/Drizzle.js";
import { Redis } from "../Databases/Redis.js";
import { UserTable } from "../Databases/User.table.js";
import { User } from "../Models/User.model.js";
import { UserService, UserServiceLive } from "../Service/User.service.js";
import { GC, GConversation } from "../types.js";
import { safeReply } from "../Shared/safeSend.js";

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

const textToTags = (self: User) => `Выши теги:
${self.tags.join(" ")}

Введите новые теги, чтобы изменить их:`;

export const BackAgeMenu = new Menu<GC>("back-menu").back("← назад", async (context) => {
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

const effectSetGender = (gender: User["gender"]) => (context: GC & MenuFlavor) => Effect.gen(function*(_) {
  const user = yield* _(
    UserService,
    Effect.andThen((service) => service.getSelf(context))
  );
  yield* Effect.promise(async () => {
    const [newUser] = await Drizzle.update(UserTable).set({ gender }).where(eq(UserTable.id, user.id)).returning();
    await Redis.hset(`user:${user.id}`, newUser!)
    await Redis.expire(`user:${user.id}`, 24 * 60 * 60)
  })
  yield* Effect.promise(() => context.editMessageText(defaultText));
  context.menu.back();

}).pipe(
  Effect.provide(UserServiceLive),
  Effect.runPromise
)

export const SetGenderMenu = new Menu<GC>("set-gender-menu")
  .text("Мужской 👨", effectSetGender("men"))
  .text("Женский 👩", effectSetGender("women")).row()
  .text("Удалить ❌", effectSetGender("any")).row()
  .back("← назад", async (context) => context.editMessageText(defaultText))


const effectSetSetting = (print: ((self: User) => string), conversation: string, menu: string = "back-menu") =>
  (context: GC & MenuFlavor) => Effect.gen(function*(_) {
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

export const SettingsMenu = new Menu<GC>("settings-menu")
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
  .text("Теги", effectSetSetting(textToTags, "settingsTags")).row()
  .text("Описание", effectSetSetting(textToDescription, "settingsDescription"))

SettingsMenu.register(BackAgeMenu);
SettingsMenu.register(SetGenderMenu);


const fabricSettings = (key: keyof User, response: string) => (conv: GConversation, context: GC) => Effect.gen(function*(_) {
  const user = yield* _(
    UserService,
    Effect.andThen(service => service.getSelf(context))
  )
  yield* _(
    Effect.promise(() => conv.waitFor(":text")),
    Effect.andThen(({ message }) => Effect.promise(async () => {
      const [newUser] = await Drizzle.update(UserTable).set({ [key]: message!.text! }).where(eq(UserTable.id, user.id)).returning();
      await Redis.hset(`user:${user.id}`, newUser!)
      await Redis.expire(`user:${user.id}`, 24 * 60 * 60)
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
  Tags: (conv: GConversation, context: GC) => Effect.gen(function*(_) {
  const user = yield* _(
    UserService,
    Effect.andThen(service => service.getSelf(context))
  )
  yield* _(
    Effect.promise(() => conv.waitFor(":text")),
    Effect.andThen(({ message }) => Effect.promise(async () => {
      const [newUser] = await Drizzle.update(UserTable).set({ tags: message!.text!.toLowerCase() }).where(eq(UserTable.id, user.id)).returning();
      await Redis.hset(`user:${user.id}`, newUser!)
      await Redis.expire(`user:${user.id}`, 24 * 60 * 60)
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



export const toSettings = (context: GC) =>
  safeReply(context, "Выберите настройки, которые вы хотели бы поменять:", { reply_markup: SettingsMenu })
    .pipe(Effect.runPromise)
