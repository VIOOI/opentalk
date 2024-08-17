import { Console, Effect } from "effect";
// import { isNotNull } from "effect/Predicate";
import { Redis } from "../Databases/Redis.js";
// import { user } from "../Databases/Tables/User.js";
import { MainMenu } from "../Keyboards/MainKeyboard.js";
import { RaitingInlineKeyboard } from "../Keyboards/RaitingKeyboard.js";
import { StopConventionKeyboard } from "../Keyboards/StopConventionKeyboard.js";
// import { Queue } from "../Schemas/Queue.js";
import { User } from "../Schemas/User.js";
import { safeSendMessage } from "../Shared/safeSend.js";
import * as Types from "../Types.js";
import { AdsService, AdsServiceLive } from "./Ads.js";
import { QueueService } from "./Queue.js";
// import { UserNotFoundError } from "./Database.js";
// import { UserService, UserServiceLive } from "./Users.js";

export const disconnectOfForbidden = (
  context: Types.Context,
  self: User,
  that: User,
) =>
  Effect.gen(function* (_) {
    const ads = yield* AdsService;
    const isBigAds = yield* ads.isBigAds;

    const inlineAds = yield* ads
      .getInlineAds(self)
      .pipe(Effect.map((h) => (!isBigAds ? "\n\n" + h.content : "")));

    yield* Effect.promise(async () =>
      Redis.del(`connect:${self.username}`, `connect:${that.username}`),
    );
    yield* safeSendMessage(
      context,
      self.chat,
      `Вас собеседник заблокировал бота, нам пришлось разорвать соединение ${inlineAds}`,
      { reply_markup: MainMenu },
    );
    yield* isBigAds ? ads.sendBigAds(context, self) : Effect.void;
    yield* safeSendMessage(
      context,
      self.chat,
      "Если хотите, оставьте мнение о вашем собеседнике. Рейтинг сильно влияет на поиск",
      { reply_markup: RaitingInlineKeyboard(that as unknown as User) },
    );
  }).pipe(
    Effect.provide(AdsServiceLive),
    Effect.catchAll(() => Effect.void),
  );

export const disconnectMessage = (
  context: Types.Context,
  self: User,
  that: User,
  isyou: boolean,
) =>
  Effect.gen(function* (_) {
    const ads = yield* AdsService;
    const isBigAds = yield* ads.isBigAds;
    // const isBigAds = true;

    const message = isyou
      ? "Вы завершили чат с собеседником( "
      : "Собеседник завершил с вами чат( ";

    const inlineAds = yield* ads
      .getInlineAds(self)
      .pipe(Effect.map((h) => (!isBigAds ? "\n\n" + h.content : "")));

    yield* safeSendMessage(context, self.chat, message + inlineAds, {
      reply_markup: MainMenu,
    });
    yield* isBigAds ? ads.sendBigAds(context, self) : Effect.void;
    yield* safeSendMessage(
      context,
      self.chat,
      "Если хотите, оставьте мнение о вашем собеседнике. Рейтинг сильно влияет на поиск\n@opentalkru",
      { reply_markup: RaitingInlineKeyboard(that) },
    );
  }).pipe(
    Effect.catchTags({
      ForbiddenError: () => Console.log(self),
      UnknownMessageError: () => Console.log(self),
    }),
    Effect.provide(AdsServiceLive),
  );

export const connectMessage = (
  context: Types.Context,
  self: User,
  that: User,
) =>
  Effect.gen(function* (_) {
    const queue = yield* QueueService;
    yield* Effect.promise(async () => {
      await Redis.set(`connect:${self.username}`, that.username);
      await Redis.del(`queue:${self.username}`);
    });

    yield* safeSendMessage(
      context,
      self.chat,
      "Мы нашли для вас собеседника, приятного общения",
    );
    yield* safeSendMessage(context, self.chat, yield* queue.print(that), {
      reply_markup: StopConventionKeyboard,
    });
  }).pipe(
    Effect.catchTags({
      ForbiddenError: () => disconnectOfForbidden(context, self, that),
    }),
  );
