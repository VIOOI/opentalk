import { Keyboard } from "grammy";

export const SettingKeyboard = new Keyboard()
  .text("Имя").text("Описание").text("Возраст").row()
  .text("Пол").text("Теги").text("<<").resized()
