import { Any } from "@effect/schema/Schema";
import { Data, Effect, Either, Record } from "effect";
import { LazyArg } from "effect/Function";
import { Message } from "grammy/types";
import { GC } from "../types.js";
import { Context } from "grammy";
import { ForbiddenError, UnknownMessageError } from "./safeSend.js";

export class MessageError extends Data.TaggedError("MessageError") { }

export const sendMessageWait = (
  self: LazyArg<Promise<Message.TextMessage>>,
  that: LazyArg<Promise<GC>>
) =>
  Effect.gen(function*(_) {
    yield* _(Effect.tryPromise({
      try: self,
      catch: (error) => {
        if ((<{ error_code: number }>error).error_code === 403)
          return new ForbiddenError();
        return new UnknownMessageError();
      }
    }))
    const response = yield* _(Effect.promise(that))
    if (response.message === undefined) return yield* _(Effect.fail(new MessageError()))
    return response;
  })

export const sendMessageWaitOrSkip = <T>(
  self: LazyArg<Promise<Message.TextMessage>>,
  that: LazyArg<Promise<GC>>,
  orSkiper: LazyArg<Promise<T>>
): Effect.Effect<Either.Either<T, GC>, MessageError, never> =>
  Effect.gen(function*(_) {
    yield* _(Effect.promise(self))
    const response = yield* _(Effect.promise(that))
    if (response.message === undefined) return yield* _(Effect.fail(new MessageError()))
    if (response.message.text === "Пропустить") return yield* _(Effect.promise(orSkiper), Effect.map(Either.right))
    return Either.left(response);
  })

// const stopAllConversion = (context: GC) => Effect.runPromise(
//   Effect.promise(() => context.conversation.active())
//     .pipe(
//       Effect.andThen((conv) => Effect.all(
//         Record.keys(conv)
//           .map(conv => Effect.promise(() => context.conversation.exit(conv)))
//       ))
//     )
// )
