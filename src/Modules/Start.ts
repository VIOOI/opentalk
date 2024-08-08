import { bold, fmt } from "@grammyjs/parse-mode";
// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
import { Array, Console, Data, Effect, Either, Layer, Match, Number, Option, String } from "effect";
import { GenderKeyboard } from "../Keyboards/Gender.js";
import { MainMenu } from "../Keyboards/Main.js";
import { SkipKeyboard } from "../Keyboards/Skip.js";
import { UserSchema } from "../Models/User.model.js";
import { DatabaseService, DatabaseServiceLive } from "../Service/Database.service.js";
import { UserService, UserServiceLive } from "../Service/User.service.js";
import { sendMessageWaitOrSkip } from "../Shared/safeConversation.js";
import { GC, GConversation } from "../types.js";
import { safeReply } from "../Shared/safeSend.js";


export const toStartNotAuth = (conversation: GConversation, context: GC) =>
  Effect.gen(function*(_) {

    console.log(context.from);
    yield* safeReply(context, ` Для начала общения вы должны  зарегестрироваться.
@opentalkru`)


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
          Match.type<GC>().pipe(
            Match.when({ message: { text: "Мужчина" } }, () => "men" as const),
            Match.when({ message: { text: "Женщина" } }, () => "women" as const),
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
      sendMessageWaitOrSkip<Array<string>>(
        () => context.reply(
          `Введите теги, для поиска, по ним мы будем искать для вас собеседника и по ним будут искать вас. 

‼️Внимание‼️
Теги это *самая важная часть для нашего бота*, на их основе мы подбираем вам наиболее подходящего собеседника. 
‼️*Без тегов мы не подберём вам собеседника*

Теги пишутся черезер пробел, например: Аниме игры фильмы`,
          {
            reply_markup: { remove_keyboard: true },
            parse_mode: "Markdown"
          }
        ),
        () => conversation.waitFor("message:text"),
        async () => Effect.gen(function*(_) {
          yield* safeReply(context, "Хорошо мы оставим оставим их пустыми, вы всегда можете поменять его в настройках")
          return Array.empty<string>();
        }).pipe(
          Effect.catchTags({
            "ForbiddenError": () => Effect.succeed(Array.empty<string>()),
            "UnknownMessageError": () => Effect.succeed(Array.empty<string>())
          }),
          Effect.runPromise,
        )
      ),
      Effect.map(
        Either.getOrElse(
          left => String.split(left.message!.text!, " ")
        )
      ),
      Effect.map(Array.map(String.toLowerCase))
    )

    const Database = yield* DatabaseService;

    yield* _(
      {
        id: context.from!.username!,
        chat: context.chatId!,
        name, age, gender, description,
        tags: Array.map(tags, String.toLowerCase),
        raiting: { likes: 0, dislikes: 0 },
      },
      Database.addedUser,
      Effect.andThen(
        (user) => safeReply(
          context,
          `Теперь вы зарегестрированы, добро пожаловать ${user.name}`,
          { reply_markup: MainMenu }
        )
      )
    )

  }).pipe(
    Effect.provide(DatabaseServiceLive),
    Effect.catchTags({
      "ForbiddenError": () => Console.log(`${context.from?.username} заблокировал бота`)
    }),
    Effect.runPromise,
  )

export const RToStartAuth = (context: GC) =>
  Effect.gen(function*() {
    const user = yield* UserService.pipe(
      Effect.andThen(User => User.getSelf(context))
    );

    yield* safeReply(context, `Добро пожаловать ${user.name}`, { reply_markup: MainMenu })

  }).pipe(
    Effect.provide(UserServiceLive),
    Effect.catchTags({
      "ForbiddenError": () => Console.log(`${context.from?.username} заблокировал бота`)
    }),
    Effect.runPromise,
  )


export const toStartInConnection = async (context: GC) => safeReply(
  context,
  "У вас есть собеседник, для начала закончите диалог с ним"
).pipe(
    Effect.catchTags({
      "ForbiddenError": () => Console.log(`${context.from?.username} заблокировал бота`)
    }),
    Effect.runPromise
  );

export const toStartInQueue = async (context: GC) => safeReply(
  context,
  "Вы находитесь в поиске, для начала остановите поиск собеседника"
).pipe(
    Effect.catchTags({
      "ForbiddenError": () => Console.log(`${context.from?.username} заблокировал бота`)
    }),
    Effect.runPromise
  );

