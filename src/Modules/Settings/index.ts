import { Effect } from "effect"
import * as Types from "../../Types.js"
import { SettingsMenu } from "./keyboards.js"
import { safeReply } from "../../Shared/safeSend.js"

export const toSettings = (context: Types.Context) =>
  safeReply(context, "Выберите настройки, которые вы хотели бы поменять:", { reply_markup: SettingsMenu })
    .pipe(
      Effect.tap(message => context.session.setting = message.message_id),
      Effect.runPromise
    )
