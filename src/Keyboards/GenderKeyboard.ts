import { Keyboard } from "grammy";

export const GenderKeyboard = new Keyboard()
  .text("Мужчина 👨").text("Другие 👽").text("Женщина 👩").row()
  .text("Пропустить").resized()
