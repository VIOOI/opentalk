import { Console, Context, Data, Effect, Layer, Option, Random } from "effect";
import { isNotNull } from "effect/Predicate";
import { Redis } from "../Databases/Redis.js";
import * as Types from "../Types.js";
import { AdsService, AdsServiceLive } from "./Ads.js";
import { UserNotFoundError } from "./Database.js";
import { UserService, UserServiceLive } from "./Users.js";
import { User } from "../Schemas/User.js";
import { Queue } from "../Schemas/Queue.js";
import { connectMessage, disconnectMessage } from "./Connection.helpers.js";

class UserIsNotConnection extends Data.TaggedError("UserIsNotConnection") { }

export class ConnectionService extends Context.Tag("ConnectionService")<
  ConnectionService,
  {
    connect: (context: Types.Context, self: Queue, that: Queue) => Effect.Effect<void, UserNotFoundError>,
    getCompanion: (context: Types.Context) => Effect.Effect<User, UserIsNotConnection | UserNotFoundError>
    disconnect: (self: Types.Context) => Effect.Effect<void, UserIsNotConnection | UserNotFoundError>
    isInConnection: (self: Types.Context) => Effect.Effect<boolean>
  }
>() { }

export const ConnectionServiceLive = Layer.effect(
  ConnectionService,
  Effect.gen(function*() {
    const User = yield* UserService;
    return {
      connect: (context: Types.Context, self: Queue, that: Queue) => Effect.all({
        that: User.getById(that.id),
        self: User.getSelf(context)
      }, { concurrency: "unbounded" }).pipe(
        Effect.andThen(
          (users) => Effect.all([
            connectMessage(context, users.self, users.that),
            connectMessage(context, users.that, users.self),
          ], { concurrency: "unbounded" })
        ),
        Effect.catchTags({
          "ForbiddenError": () => Console.log(self, that),
          "UnknownMessageError": () => Console.log(self, that)
        }),
        Effect.asVoid,
        Effect.provide(AdsServiceLive),
      ),
      
      getCompanion: (context: Types.Context) => Effect.promise(
        () => Redis.get(`connect:${context.from!.username!}`)
      ).pipe(
        Effect.filterOrFail(
          isNotNull,
          () => new UserIsNotConnection(),
        ),
        Effect.andThen(User.getById),
      ),

      disconnect: (self: Types.Context) => Effect.gen(function*(_) {
        const users = yield* Effect.all({
          self: User.getSelf(self),
          that: Effect.promise(() => Redis.get(`connect:${self.from!.username!}`)).pipe(
            Effect.filterOrFail(
              isNotNull,
              () => new UserIsNotConnection(),
            ),
            Effect.andThen(User.getById),
          )
        }, { concurrency: "unbounded" })

        const disconnectAll = (self: User, that: User) => Effect.gen(function*(_) {
          yield* Effect.promise(() => Redis.del(`connect:${self.id}`))
          yield* Effect.promise(() => Redis.del(`connect:${that.id}`))
        })


        yield* Effect.all([
          disconnectAll(users.self, users.that),
          disconnectMessage(self, users.self, users.that, true),
          disconnectMessage(self, users.that, users.self, false),
        ], { concurrency: "unbounded" })

      }).pipe(Effect.provide(AdsServiceLive)),

      isInConnection: (self: Types.Context) => Effect.promise(
        () => Redis.get(`connect:${self.from!.username!}`)
      ).pipe(
        Effect.filterOrFail(isNotNull, () => new UserIsNotConnection()),
        Effect.match({ onSuccess: () => true, onFailure: () => false, })
      )

    }
  })
).pipe(
  Layer.provide(UserServiceLive),
)
