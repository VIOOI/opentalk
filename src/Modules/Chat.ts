import { Console, Effect } from "effect";
import { MainMenu } from "../Keyboards/Main.js";
import { ConnectionService, ConnectionServiceLive } from "../Service/Connection.service.js";
import { GC } from "../types.js";
import { ForbiddenError, safeReply, UnknownMessageError } from "../Shared/safeSend.js";
import { User } from "../Models/User.model.js";
import { Redis } from "../Databases/Redis.js";
import { RaitingInlineKeyboard } from "../Keyboards/Raiting.js";

const lockout = (context: GC) => Effect.gen(function*(_) {
  const that = yield* ConnectionService.pipe(
    Effect.andThen((service) => service.getCompanion(context))
  );

  yield* Effect.promise(async () => Redis.del(`connect:${context.from!.username!}`, `connect:${that.id}`));
  yield* safeReply(context, "Вас собеседник заблокировал бота, нам пришлось разорвать соединение", { reply_markup: MainMenu })
  yield* safeReply(context, "Если хотите, оставьте мнение о вашем собеседнике. Рейтинг сильно влияет на поиск", { reply_markup: RaitingInlineKeyboard(that) })

}).pipe(Effect.provide(ConnectionServiceLive))

export const Forwarding = Effect.gen(function*(_) {
  const connection = yield* ConnectionService;

  return {
    textMessage: (context: GC) => Effect.all({
      user: connection.getCompanion(context),
      message: Effect.sync(() => context.message!.text)
    }).pipe(
      Effect.flatMap(
        ({ user, message }) => Effect.tryPromise({
          try: () => context.api.sendMessage(user.chat, message!),
          catch: (error) => {
            if ((<{ error_code: number }>error).error_code === 403)
              return new ForbiddenError();
            return new UnknownMessageError();
          }
        })
      )
    ).pipe(
      Effect.catchTags({
        "ForbiddenError": () => lockout(context)
      }),
      Effect.runPromise
    ),

    photo: (context: GC) => Effect.all({
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
        "ForbiddenError": () => lockout(context)
      }),
      Effect.runPromise
    ),

    video: (context: GC) => Effect.all({
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
        "ForbiddenError": () => lockout(context)
      }),
      Effect.runPromise
    ),

    videoNote: (context: GC) => Effect.all({
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
        "ForbiddenError": () => lockout(context)
      }),
      Effect.runPromise
    ),

    sticker: (context: GC) => Effect.all({
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
        "ForbiddenError": () => lockout(context)
      }),
      Effect.runPromise
    ),

    voice: (context: GC) => Effect.all({
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
        "ForbiddenError": () => lockout(context)
      }),
      Effect.runPromise
    ),
  }
})


export const toStopConvection = (context: GC) => Effect.gen(function*() {
  const { disconnect } = yield* ConnectionService;
  yield* disconnect(context)
}).pipe(
  Effect.provide(ConnectionServiceLive),
  Effect.runPromise,
)
export const toStopConvectionIsNot = async (context: GC) =>
  safeReply(context, "Для начала нужно найти собеседника", { reply_markup: MainMenu })
    .pipe(
      Effect.catchTags({
        "ForbiddenError": () => Console.log(context),
        "UnknownMessageError": () => Console.log(context)
      }),
      Effect.runPromise
    )
