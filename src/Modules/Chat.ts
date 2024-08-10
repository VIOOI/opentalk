import { Console, Effect, Random } from "effect";
import * as Types from "../Types.js"
import { MainMenu } from "../Keyboards/Main.js";
import { ForbiddenError, safeReply, safeSendMessage, UnknownMessageError } from "../Shared/safeSend.js";
import { Redis } from "../Databases/Redis.js";
import { RaitingInlineKeyboard } from "../Keyboards/Raiting.js";
import { ConnectionService, ConnectionServiceLive } from "../Services/Connection.js";
import { sendBigAds, sendInlineAgs } from "../Services/Connection.helpers.js";
import { UserService, UserServiceLive } from "../Services/Users.js";
import { AdsServiceLive } from "../Services/Ads.js";

const disconnectOfForbidden = (context: Types.Context) => Effect.gen(function*(_) {
  const that = yield* ConnectionService.pipe(Effect.andThen((service) => service.getCompanion(context)));
  const self = yield* UserService.pipe(Effect.andThen(service => service.getSelf(context)))

  const isBigAds = yield* Random.nextRange(0, 10).pipe(Effect.map(n => n > 8));

  yield* Effect.promise(async () => Redis.del(`connect:${self.id}`, `connect:${that.id}`));
  yield* safeReply(
    context,
    "Вас собеседник заблокировал бота, нам пришлось разорвать соединение" + !isBigAds ? ("\n\n" + (yield* sendInlineAgs(self)).content) : "",
    { reply_markup: MainMenu }
  )
  yield* (isBigAds ? sendBigAds(context, self) : Effect.void);
  yield* safeReply(context, "Если хотите, оставьте мнение о вашем собеседнике. Рейтинг сильно влияет на поиск", { reply_markup: RaitingInlineKeyboard(that) })

}).pipe(
  Effect.provide(ConnectionServiceLive),
  Effect.provide(UserServiceLive),
  Effect.provide(AdsServiceLive),
)

export const Forwarding = Effect.gen(function*(_) {
  const connection = yield* ConnectionService;

  return {
    textMessage: (context: Types.Context) => Effect.all({
      user: connection.getCompanion(context),
      message: Effect.sync(() => context.message!)
    }).pipe(
      Effect.flatMap(
        ({ user, message }) => Effect.tryPromise({
          try: async () => {
            const that = await context.api.sendMessage(user.chat, message.text!)
            return { self: message, that }
          },
          catch: (error) => {
            if ((<{ error_code: number }>error).error_code === 403)
              return new ForbiddenError();
            return new UnknownMessageError();
          }
        })
      ),
      Effect.andThen(({ self, that }) => Effect.sync(() => context.session.history.push({
        self: self.message_id.toString(),
        that: that.message_id.toString()
      })))
    ).pipe(
      Effect.catchTags({
        "ForbiddenError": () => disconnectOfForbidden(context)
      }),
      Effect.runPromise
    ),

    photo: (context: Types.Context) => Effect.all({
      user: connection.getCompanion(context),
      file: Effect.promise(() => context.getFile())
    }).pipe(
      Effect.flatMap(
        ({ user, file }) => Effect.tryPromise({
          try: () => context.api.sendPhoto(user.chat, file.file_id),
          catch: (error) => {
            if ((<{ error_code: number }>error).error_code === 403)
              return new ForbiddenError();
            return new UnknownMessageError();
          }
        })
      )
    ).pipe(
      Effect.catchTags({
        "ForbiddenError": () => disconnectOfForbidden(context)
      }),
      Effect.runPromise
    ),

    video: (context: Types.Context) => Effect.all({
      user: connection.getCompanion(context),
      file: Effect.promise(() => context.getFile())
    }).pipe(
      Effect.flatMap(
        ({ user, file }) => Effect.tryPromise({
          try: () => context.api.sendVideo(user.chat, file.file_id),
          catch: (error) => {
            if ((<{ error_code: number }>error).error_code === 403)
              return new ForbiddenError();
            return new UnknownMessageError();
          }
        })
      )
    ).pipe(
      Effect.catchTags({
        "ForbiddenError": () => disconnectOfForbidden(context)
      }),
      Effect.runPromise
    ),

    videoNote: (context: Types.Context) => Effect.all({
      user: connection.getCompanion(context),
      file: Effect.promise(() => context.getFile())
    }).pipe(
      Effect.flatMap(
        ({ user, file }) => Effect.tryPromise({
          try: () => context.api.sendVideoNote(user.chat, file.file_id),
          catch: (error) => {
            if ((<{ error_code: number }>error).error_code === 403)
              return new ForbiddenError();
            return new UnknownMessageError();
          }
        })
      )
    ).pipe(
      Effect.catchTags({
        "ForbiddenError": () => disconnectOfForbidden(context)
      }),
      Effect.runPromise
    ),

    sticker: (context: Types.Context) => Effect.all({
      user: connection.getCompanion(context),
      file: Effect.promise(() => context.getFile())
    }).pipe(
      Effect.flatMap(
        ({ user, file }) => Effect.tryPromise({
          try: () => context.api.sendSticker(user.chat, file.file_id),
          catch: (error) => {
            if ((<{ error_code: number }>error).error_code === 403)
              return new ForbiddenError();
            return new UnknownMessageError();
          }
        })
      )
    ).pipe(
      Effect.catchTags({
        "ForbiddenError": () => disconnectOfForbidden(context)
      }),
      Effect.runPromise
    ),

    voice: (context: Types.Context) => Effect.all({
      user: connection.getCompanion(context),
      file: Effect.promise(() => context.getFile())
    }).pipe(
      Effect.flatMap(
        ({ user, file }) => Effect.tryPromise({
          try: () => context.api.sendVoice(user.chat, file.file_id),
          catch: (error) => {
            if ((<{ error_code: number }>error).error_code === 403)
              return new ForbiddenError();
            return new UnknownMessageError();
          }
        })
      )
    ).pipe(
      Effect.catchTags({
        "ForbiddenError": () => disconnectOfForbidden(context)
      }),
      Effect.runPromise
    ),
  }
})


export const toStopConvection = (context: Types.Context) => Effect.gen(function*() {
  const { disconnect } = yield* ConnectionService;
  yield* disconnect(context)
}).pipe(
  Effect.provide(ConnectionServiceLive),
  Effect.runPromise,
)
export const toStopConvectionIsNot = async (context: Types.Context) =>
  safeReply(context, "Для начала нужно найти собеседника", { reply_markup: MainMenu })
    .pipe(
      Effect.catchTags({
        "ForbiddenError": () => Console.log(context),
        "UnknownMessageError": () => Console.log(context)
      }),
      Effect.runPromise
    )
