
import { Menu, MenuRange } from "@grammyjs/menu";
// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
import { Array, Effect, Record } from "effect";
import * as Types from "../../Types.js"
import { defaultText, textToAge, textToDescription, textToGender, textToName, textToTags } from "./text.js";
import { fabricSetterGender, fabricSetterSettings } from "./fabrics.js";
import { UserService, UserServiceLive } from "../../Services/User.js";

const categories = ["Вирт", "Общение", "Игры", "Путешествия",
  "Фильмы", "Книги", "Мемы", "Флирт",
  "Музыка", "Аниме", "Питомцы", "Спорт"]

export const TagsKeyboardSettings = new Menu<Types.Context>("select-tags-keyboard-settings")
  .dynamic(() => {

    const range = new MenuRange<Types.Context>();
    Array.forEach(categories, (item, index) => {
      range.text(
        ({ session }) => Array.some(session.categories, (c) => c === item)
          ? `✅ ${item}` : item,
        ({ session, menu }) => {
          session.categories = Array.some(session.categories, (c) => c === item)
            ? Array.filter(session.categories, c => c !== item)
            : Array.append(session.categories, item);
          menu.update({ immediate: true })
        }
      )
      index % 2 === 1 && range.row();
    })

    return range;

  }).back("← назад", async (context) => {
    await Effect.runPromise(
      Effect.promise(() => context.conversation.active()).pipe(
        Effect.andThen((conv) => Effect.all(
          Record.keys(conv)
            .map(conv => Effect.promise(() => context.conversation.exit(conv)))
        ))
      )
    )

    context.editMessageText(defaultText);
  })

export const BackAgeMenu = new Menu<Types.Context>("back-menu").back("← назад", async (context) => {
  await Effect.runPromise(
    Effect.promise(() => context.conversation.active()).pipe(
      Effect.andThen((conv) => Effect.all(
        Record.keys(conv)
          .map(conv => Effect.promise(() => context.conversation.exit(conv)))
      ))
    )
  )

  context.editMessageText(defaultText);
});

export const SetGenderMenu = new Menu<Types.Context>("set-gender-menu")
  .text("Мужской 👨", fabricSetterGender("men"))
  .text("Женский 👩", fabricSetterGender("women")).row()
  .text("Удалить ❌", fabricSetterGender("any")).row()
  .back("← назад", async (context) => context.editMessageText(defaultText))

export const SettingsMenu = new Menu<Types.Context>("settings-menu")
  .text("Имя", fabricSetterSettings(textToName, "settings-name"))
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
  .text("Возраст", fabricSetterSettings(textToAge, "settings-age"))
  .text("Теги", fabricSetterSettings(textToTags, "settings-tags", "select-tags-keyboard-settings")).row()
  .text("Описание", fabricSetterSettings(textToDescription, "settings-description"))

SettingsMenu.register(BackAgeMenu);
SettingsMenu.register(TagsKeyboardSettings);
SettingsMenu.register(SetGenderMenu);
