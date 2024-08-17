import { Data, Effect } from "effect";
import * as Types from "../Types.js";
import { ForceReply, InlineKeyboardMarkup, ReplyKeyboardMarkup, ReplyKeyboardRemove } from "grammy/types";


export class ForbiddenError extends Data.TaggedError("ForbiddenError") {}
export class UnknownMessageError extends Data.TaggedError("UnknownMessageError") {}

export const safeReply = (
  context: Types.Context,
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
  context: Types.Context,
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

