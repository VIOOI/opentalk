import { Data, Effect, Either } from "effect";
import { LazyArg } from "effect/Function";
import { Message } from "grammy/types";
import * as Types from "../Types.js";
import { ForbiddenError, UnknownMessageError } from "./safeSend.js";

export class MessageError extends Data.TaggedError("MessageError") { }

export const sendMessageWait = (
  self: LazyArg<Promise<Message.TextMessage>>,
  that: LazyArg<Promise<Types.Context>>
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
  that: LazyArg<Promise<Types.Context>>,
  orSkiper: LazyArg<Promise<T>>
): Effect.Effect<Either.Either<T, Types.Context>, MessageError, never> =>
  Effect.gen(function*(_) {
    yield* _(Effect.promise(self))
    const response = yield* _(Effect.promise(that))
    if (response.message === undefined) return yield* _(Effect.fail(new MessageError()))
    if (response.message.text === "Пропустить") return yield* _(Effect.promise(orSkiper), Effect.map(Either.right))
    return Either.left(response);
  })

