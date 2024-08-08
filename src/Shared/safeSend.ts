import { Data, Effect } from "effect";
import { GC } from "../types.js";
import { RawApi } from "grammy";
import { ForceReply, InlineKeyboardMarkup, ReplyKeyboardMarkup, ReplyKeyboardRemove } from "grammy/types";
import { ConnectionService } from "../Service/Connection.service.js";


export class ForbiddenError extends Data.TaggedError("ForbiddenError") {}
export class UnknownMessageError extends Data.TaggedError("UnknownMessageError") {}

// export type Payload<M extends Methods<R>, R extends RawApi> = M extends unknown ? R[M] extends (signal?: AbortSignal) => unknown ? {} : R[M] extends (args: any, signal?: AbortSignal) => unknown ? Parameters<R[M]>[0] : never : never;
//
// export type Other<R extends RawApi, M extends Methods<R>, X extends string = never> = Omit<Payload<M, R>, X>;
// export type Methods<R extends RawApi> = string & keyof R;
// type Other<M extends Methods<RawApi>, X extends string = never> = OtherApi<RawApi, M, X>;

export const safeReply = (
  context: GC,
  message: string,
  other?: { reply_markup: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply }
) => Effect.tryPromise({
  try: async () => context.reply(message, other),
  catch: (error) => {
    if ((<{ error_code: number }>error).error_code === 403) 
      return new ForbiddenError();
    return new UnknownMessageError();
  }
})

export const safeSendMessage = (
  context: GC,
  chat_id: number | string,
  message: string,
  other?: { reply_markup: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply }
) => Effect.tryPromise({
  try: async () => context.api.sendMessage(chat_id, message, other),
  catch: (error) => {
    if ((<{ error_code: number }>error).error_code === 403) 
      return new ForbiddenError();
    return new UnknownMessageError();
  }
})

