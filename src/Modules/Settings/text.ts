import { serializeUser, User } from "../../Schemas/User.js";

export const defaultText = "Выберите настройки, которые вы хотели бы поменять:"

const genderToWord = (self: User["gender"]) => ({
  "men": "Мужской",
  "women": "Женский",
  "any": "Неопределённый"
})[self]

export const textToGender = (self: User) => `У вас установлен ${genderToWord(self.gender)} пол
Чтобы изменять или удалить пол, нажмите на кнопки ниже`

export const textToAge = (self: User) => `Ваш возраст: ${self.age}

Введите ваш возраст цифрами (от 9 до 99), чтобы мы могли находить вам наиболее подходящих собеседников.

Например, если вам 21 год, напишите 21:`;

export const textToName = (self: User) => `Ваше имя ${self.name}

Введите новое, чтобы его изменять:`;

export const textToDescription = (self: User) => `Выше описание:
${self.description}

Введите новое описание чтобы изменить его:`;

export const textToTags = (self: User) => `Выберите интересы для поиска, по ним мы будем искать для вас собеседника и по ним будут искать вас. 

Так же вы можете написать теги для сужения поиска собеседника, чтобы мы общались с наиболее подходящим собеседником.
Выши теги: ${serializeUser(self).tags}

Теги пишутся черезер пробел, например: Аниме игры фильмы`;
