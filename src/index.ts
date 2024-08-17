import { Data, Effect, Layer, Schedule } from "effect"
import { ConnectionServiceLive } from "./Services/Connection.js"
import { Conversation } from "./Services/Conversations.js"
import { Config, Grammy, GrammyLive } from "./Services/Grammy.js"
import { QueueServiceLive } from "./Services/Queue.js"
import { Routing } from "./Services/Router.js"
import { UserServiceLive } from "./Services/User.js"


class GrammyAnyError extends Data.TaggedError("GrammyAnyError") {}


// Server Setup
const TelegramLive = Layer.scopedDiscard(
  Effect.gen(function*() {
    const grammy = yield* Grammy;
    yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => grammy.start(),
        catch: () => new GrammyAnyError()
      }),
      // Effect.sync(() => grammy.start()),
      () => Effect.sync(() => grammy.stop())
    )
  }).pipe(
      Effect.retry({ times: 5 })
    )
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
