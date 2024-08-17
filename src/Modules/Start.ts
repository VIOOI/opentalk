import { bold, fmt } from "@grammyjs/parse-mode";
// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
import { Array, Console, Data, Effect, Either, Layer, Match, Number, Option, String } from "effect";
import { GenderKeyboard } from "../Keyboards/GenderKeyboard.js";
import { MainMenu } from "../Keyboards/MainKeyboard.js";
import { SkipKeyboard } from "../Keyboards/SkipKeyboard.js";
import { UserService, UserServiceLive } from "../Services/User.js";
import { sendMessageWaitOrSkip } from "../Shared/safeConversation.js";
import { safeReply } from "../Shared/safeSend.js";
import * as Types from "../Types.js"
import { TagsKeyboard } from "../Keyboards/TagsKeyboard.js";


export const toStartNotAuth = (conversation: Types.Conversation, context: Types.Context) =>
  Effect.gen(function*(_) {

    yield* safeReply(context, `Для начала общения вы должны  зарегестрироваться. @opentalkru`)


    const name = yield* _(
      sendMessageWaitOrSkip(
        () => context.reply(`Как вас зовут?`, { reply_markup: SkipKeyboard }),
        () => conversation.waitFor("message:text"),
        async () => {
          await context.reply("Хорошо мы возьмём за ваше имя ваш никнейм, вы всегда можете поменять его в настройках")
          return context.from?.username || "Пользователь"
        }
      ),
      Effect.map(
        Either.getOrElse(
          left => left.message!.text || "Пользователь"
        )
      ),
    )

    const age = yield* _(
      sendMessageWaitOrSkip<number>(
        () => context.reply("Сколько вам лет?", { reply_markup: SkipKeyboard }),
        () => conversation.waitFor("message:text"),
        async () => {
          await context.reply("Хорошо мы поставим ваш возраст как 18 лет, вы можете поменять его в настройках")
          return 18
        }
      ),
      Effect.map(
        Either.getOrElse(
          left => Option.getOrElse(Number.parse(left.message!.text || "18"), () => 18)
        )
      ),
    )

    const gender = yield* _(
      sendMessageWaitOrSkip<"any">(
        () => context.reply(`Какого вы пола?`, { reply_markup: GenderKeyboard }),
        () => conversation.waitFor("message:text"),
        async () => {
          await context.reply("Хорошо мы пока что пропустим ваш пол, вы всегда можете поменять его в настройках")
          return "any" as const;
        }
      ),
      Effect.map(
        Either.getOrElse(
          Match.type<Types.Context>().pipe(
            Match.when({ message: { text: "Мужчина 👨" } }, () => "men" as const),
            Match.when({ message: { text: "Женщина 👩" } }, () => "women" as const),
            Match.orElse(() => "any" as const)
          )
        )
      )
    )

    const description = yield* _(
      sendMessageWaitOrSkip(
        () => context.reply(`Напишите немного о себе`, { reply_markup: SkipKeyboard }),
        () => conversation.waitFor("message:text"),
        async () => {
          await context.reply("Хорошо мы оставим ваше описание пустым, вы всегда можете поменять его в настройках")
          return "";
        }
      ),
      Effect.map(
        Either.getOrElse(
          left => left.message!.text || ""
        )
      )
    )

    // class TagsIsEmptyError extends Data.TaggedError("TagsIsEmptyError") {}
    const tags = yield* _(
      sendMessageWaitOrSkip<string>(
        () => context.reply(
          `Выберите интересы для поиска, по ним мы будем искать для вас собеседника и по ним будут искать вас. 

Так же вы можете написать теги для сужения поиска собеседника, чтобы мы общались с наиболее подходящим собеседником.

Теги пишутся черезер пробел, например: Аниме игры фильмы`,
          {
            reply_markup: TagsKeyboard,
            parse_mode: "Markdown"
          }
        ),
        () => conversation.waitFor("message:text"),
        async () => Effect.gen(function*(_) {
          yield* safeReply(context, "Хорошо мы оставим оставим их пустыми, вы всегда можете поменять его в настройках")
          return "";
        }).pipe(
          Effect.catchAll(() => Effect.succeed("")),
          Effect.runPromise,
        )
      ),
      Effect.map(
        Either.getOrElse(
          left => left.message!.text!
        )
      ),
    )

    const Users = yield* UserService;

    yield* _(
      Users.add(
        {
          username: context.from!.username!,
          chat: context.chat!.id.toString(),
          name, age, gender, description,
          tags: String.toLowerCase(tags),
          rating: [0, 0],
        },
      ),
      Effect.andThen(
        (user) => safeReply(
          context,
          `Теперь вы зарегестрированы, добро пожаловать ${user.name}`,
          { reply_markup: MainMenu }
        )
      )
    )
    conversation.session.status = "auth";

  }).pipe(
    Effect.provide(UserServiceLive),
    Effect.catchTags({
      "ForbiddenError": () => Console.log(`${context.from?.username} заблокировал бота`),
    }),
    Effect.runPromise,
  )

export const toStartAuth = (context: Types.Context) =>
  Effect.gen(function*() {
    const user = yield* UserService.pipe(
      Effect.andThen(User => User.getSelf(context))
    );

    yield* safeReply(context, `Добро пожаловать ${user.name}`, { reply_markup: MainMenu })

  }).pipe(
    Effect.provide(UserServiceLive),
    Effect.catchTags({
      "ForbiddenError": () => Console.log(`${context.from?.username} заблокировал бота`),
      "UserNotFoundError": () => Console.error(`${context.from?.username} не найден`)
    }),
    Effect.runPromise,
  )


export const toStartInConnection = async (context: Types.Context) => safeReply(
  context,
  "У вас есть собеседник, для начала закончите диалог с ним"
).pipe(
  Effect.catchTags({
    "ForbiddenError": () => Console.log(`${context.from?.username} заблокировал бота`)
  }),
  Effect.runPromise
);

export const toStartInQueue = async (context: Types.Context) => safeReply(
  context,
  "Вы находитесь в поиске, для начала остановите поиск собеседника \stop"
).pipe(
  Effect.catchTags({
    "ForbiddenError": () => Console.log(`${context.from?.username} заблокировал бота`)
  }),
  Effect.runPromise
);

