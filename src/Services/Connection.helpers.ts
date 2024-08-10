import { Console, Context, Data, Effect, Layer, Option, Random } from "effect";
import { isNotNull } from "effect/Predicate";
import { Redis } from "../Databases/Redis.js";
import { MainMenu } from "../Keyboards/Main.js";
import { RaitingInlineKeyboard } from "../Keyboards/Raiting.js";
import { StopConventionKeyboard } from "../Keyboards/StopConvention.js";
import { safeReply, safeSendMessage } from "../Shared/safeSend.js";
import * as Types from "../Types.js";
import { AdsService, AdsServiceLive } from "./Ads.js";
import { UserNotFoundError } from "./Database.js";
import { UserService, UserServiceLive } from "./Users.js";
import { User } from "../Schemas/User.js";
import { Queue } from "../Schemas/Queue.js";

export const disconnectOfForbidden = (
  context: Types.Context,
  self: User,
  that: User
) => Effect.gen(function*(_) {
  const isBigAds = yield* Random.nextRange(0, 10).pipe(Effect.map(n => n > 8));

  yield* Effect.promise(async () => Redis.del(`connect:${self.id}`, `connect:${that.id}`));
  yield* safeSendMessage(
    context,
    self.chat,
    "Вас собеседник заблокировал бота, нам пришлось разорвать соединение" + !isBigAds ? ("\n\n" + (yield* sendInlineAgs(self)).content) : "",
    { reply_markup: MainMenu }
  )
  yield* (isBigAds ? sendBigAds(context, self) : Effect.void);
  yield* safeSendMessage(context, self.chat, "Если хотите, оставьте мнение о вашем собеседнике. Рейтинг сильно влияет на поиск", { reply_markup: RaitingInlineKeyboard(that as unknown as User) })

})

export const sendBigAds = (ctx: Types.Context, self: User) => Effect.gen(function*(_) {
  const ads = yield* AdsService;
  const matchedAds = yield* ads.getMatched(self, "post").pipe(
    Effect.flatMap(Option.match({
      onSome: ads => Effect.succeed(ads),
      onNone: () => ads.getRandom("post"),
    })),
  );

  yield* safeSendMessage(ctx, self.chat, matchedAds.content);
})

export const sendInlineAgs = (self: User) => Effect.gen(function*(_) {
  const ads = yield* AdsService;
  return yield* ads.getMatched(self, "small").pipe(
    Effect.flatMap(Option.match({
      onSome: ads => Effect.succeed(ads),
      onNone: () => ads.getRandom("small"),
    })),
  );
})

export const disconnectMessage = (context: Types.Context, self: User, that: User, isyou: boolean) => Effect.gen(function*(_) {
  const isBigAds = yield* Random.nextRange(0, 10).pipe(Effect.map(n => n > 8));

  const message = isyou
    ? "Вы завершили чат с собеседником( "
    : "Собеседник завершил с вами чат( "


  yield* safeSendMessage(
    context,
    self.chat,
    `${message}\n\n${!isBigAds ? (yield* sendInlineAgs(self)).content : ""}`,
    { reply_markup: MainMenu }
  )
  yield* (isBigAds ? sendBigAds(context, self) : Effect.void);
  yield* safeSendMessage(
    context,
    self.chat,
    "Если хотите, оставьте мнение о вашем собеседнике. Рейтинг сильно влияет на поиск\n@opentalkru",
    { reply_markup: RaitingInlineKeyboard(that) }
  )
}).pipe(
  Effect.catchTags({
    "ForbiddenError": () => Console.log(self),
    "UnknownMessageError": () => Console.log(self)
  }),
)

const genderToEmoji = (self: User["gender"]) => ({ "men": "👨", "women": "👩", "any": "👽" })[self]
const printQueue = (self: User) =>
  `${genderToEmoji(self.gender)} ${self.name} ${self.age}\n${self.description}`

export const connectFromQueue = (self: User, that: User) => Effect.promise(async () => {
  await Redis.set(`connect:${self.id}`, that.id)
  await Redis.del(`queue:${self.id}`)
})

export const connectMessage = (
  context: Types.Context,
  self: User,
  that: User,
) => Effect.gen(function*(_) {
  yield* connectFromQueue(self, that);

  yield* safeSendMessage(context, self.chat, "Мы нашли для вас собеседника, приятного общения")
  yield* safeSendMessage(context, self.chat, printQueue(that), { reply_markup: StopConventionKeyboard })
}).pipe(
  Effect.catchTags({
    "ForbiddenError": () => disconnectOfForbidden(context, self, that)
  }),
)

