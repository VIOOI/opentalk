import { Effect, Layer } from "effect"
import { Config, Grammy, GrammyLive } from "./Services/Grammy.js"
import { Routing } from "./Services/Router.js"
import { Conversation } from "./Services/Conversations.js"
import { UserServiceLive } from "./Services/User.js"
import { ConnectionServiceLive } from "./Services/Connection.js"
import { QueueServiceLive } from "./Services/Queue.js"



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
      Layer.provide(Routing),
      Layer.provide(Config),
      // Layer.provide(Conversation),
      
      Layer.provide(UserServiceLive),
      Layer.provide(ConnectionServiceLive),
      Layer.provide(QueueServiceLive),

      Layer.provide(GrammyLive),
    )
  )
)
