import { Menu, MenuRange } from "@grammyjs/menu";
import { Array } from "effect";
import * as Types from "../Types.js"

const categories = ["Вирт", "Общение", "Игры", "Путешествия",
  "Фильмы", "Книги", "Мемы", "Флирт",
  "Музыка", "Аниме", "Питомцы", "Спорт"]

export const TagsKeyboard = new Menu<Types.Context>("select-tags-keyboard")
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

  })
