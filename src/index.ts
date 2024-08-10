import { Effect, Layer } from "effect"
import { Config, Grammy, GrammyLive } from "./Services/Grammy.js"
import { Router } from "./Services/Router.js"
import { Conversation } from "./Services/Conversations.js"



// Server Setup
const TelegramLive = Layer.scopedDiscard(
  Effect.gen(function*() {
    const grammy = yield* Grammy;
    yield* Effect.acquireRelease(
      Effect.sync(() => grammy.start()),
      () => Effect.sync(() => grammy.stop())
    )
  })
)


Effect.runFork(
  Layer.launch(
    TelegramLive.pipe(
      Layer.provide(Router),
      Layer.provide(Conversation),
      Layer.provide(Config),

      Layer.provide(GrammyLive),
    )
  )
)
