import { Console, Effect, Match, Record, Ref } from "effect";
import { Keyboard } from "grammy";
import { v4 as uuidv4 } from 'uuid';
import { Drizzle } from "../Databases/Drizzle.js";
import { NewAds } from "../Databases/Tables/Ads.js";
import { ads } from "../Databases/tables.js";
import { MainMenu } from "../Keyboards/MainKeyboard.js";
import { TagsKeyboard } from "../Keyboards/TagsKeyboard.js";
import { Ads } from "../Schemas/Ads.js";
import { sendMessageWait } from "../Shared/safeConversation.js";
import { safeReply, safeSendMessage } from "../Shared/safeSend.js";
import * as Types from "../Types.js";

const AdsTypeKeyboard = new Keyboard()
  .text("Маленькая").row()
  .text("Большая").row()
  .text("Пост").row().resized().oneTime()

export const GenderKeyboard = new Keyboard()
  .text("Мужчины").text("Любые").text("Женщины").row().resized().oneTime()


export const addedAds = (conversation: Types.Conversation, context: Types.Context) => Effect.gen(function*(_) {
  const sessionCategories = conversation.session.categories;

  const newAds = yield* Ref.make(Record.fromEntries([
    ["id", uuidv4()],
    ["type", "small"],
    ["content", ""],
    ["age", "0 99"],
    ["gender", "any"],
    ["tags", ""],
  ]))
  const matcherType = Match.type<string>().pipe(
    Match.when("Маленькая", () => "small"),
    Match.when("Большая", () => "large"),
    Match.when("Пост", () => "forwared"),
    Match.orElse(() => "small")
  )

  yield* sendMessageWait(
    () => context.reply("Какой тип рекламы?", { reply_markup: AdsTypeKeyboard }),
    () => conversation.waitFor(":text"),
  ).pipe(
    Effect.map(h => h.message!.text!),
    Effect.map(matcherType),
    // @ts-ignore
    Effect.andThen((self) => Ref.update(newAds, Record.set("type", self))),
    Effect.catchAll(() => Effect.succeed("Маленькая")),
  )

  yield* sendMessageWait(
    () => context.reply("Диапозон возраста"),
    () => conversation.waitFor(":text"),
  ).pipe(
    Effect.map(h => h.message!.text!),
    // @ts-ignore
    Effect.andThen((self) => Ref.update(newAds, Record.set("age", self))),
  )


  yield* sendMessageWait(
    () => context.reply("Выберите пол", { reply_markup: GenderKeyboard }),
    () => conversation.waitFor(":text"),
  ).pipe(
    Effect.map(
      Match.type<Types.Context>().pipe(
        Match.when({ message: { text: "Мужчины" } }, () => "men" as const),
        Match.when({ message: { text: "Женщины" } }, () => "women" as const),
        Match.orElse(() => "any" as const)
      )
    ),
    // @ts-ignore
    Effect.andThen((self) => Ref.update(newAds, Record.set("gender", self))),
  )
  yield* Effect.promise(() => context.reply("Выберите категории для рекламы", { reply_markup: TagsKeyboard }))
  // yield* safeReply(context, "Выберите категории для рекламы", { reply_markup: TagsKeyboard });
  // yield* sendMessageWait(
  //   () => context.reply("Введите теги"),
  //   () => conversation.waitFor(":text"),
  // ).pipe(
  //   Effect.map(h => h.message!.text!),
  //     // @ts-ignore
  //   Effect.andThen((self) => Ref.update(newAds, Record.set("tags", self))),
  // )

  yield* Effect.if(
    (yield* Ref.get(newAds)).type === "forwared",
    {
      onTrue: () => sendMessageWait(
        () => context.reply("Пришлите рекламный пост"),
        () => conversation.waitFor(":forward_origin"),
      ).pipe(Effect.map(({ message }) => `${message?.chat.id} ${message?.message_id}`)),

      onFalse: () => sendMessageWait(
        () => context.reply("Напишите рекламный текст"),
        () => conversation.waitFor(":text"),
      ).pipe(Effect.map(({ message }) => message!.text!)),
    }
  ).pipe(
    // @ts-ignore
    Effect.andThen((self) => Ref.update(newAds, Record.set("content", self))),
  )

  // @ts-ignore
  yield* Ref.updateAndGet(newAds, Record.set("tags", conversation.session.categories.join(" "))).pipe(
    // Effect.tap(Console.log),
    Effect.andThen(
      (value) => Effect.promise(
        () => Drizzle.insert(ads).values(value)
      ),
    ),
    Effect.tap(() => Effect.sync(() => conversation.session.categories = sessionCategories)),
    Effect.tap(() => safeReply(context, "Реклама добавлена", { reply_markup: MainMenu }))
  )

}).pipe(
  Effect.runPromise,
)
