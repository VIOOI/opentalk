// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
import { Array, Console, Context, Data, Effect, Layer, Option, Order } from "effect";
import { Redis } from "../Databases/Redis.js";
// import { User } from "../Models/User.model.js";
import { Queue, deserializeQueue, serializeQueue } from "../Schemas/Queue.js";
import { User } from "../Schemas/User.js";
import * as Types from "../Types.js";

class UserAlreadyInQueue extends Data.TaggedError("UserAlreadyInQueue") { }
class UserIsNotQueue extends Data.TaggedError("UserIsNotQueue") { }
class RedisAnyError extends Data.TaggedError("RedisAnyError") { }

export class QueueService extends Context.Tag("Queue")<
  QueueService,
  {
    append: (self: Queue) => Effect.Effect<void, UserAlreadyInQueue | RedisAnyError>
    removal: (self: Types.Context) => Effect.Effect<void, UserIsNotQueue | RedisAnyError>
    findRightOne: (self: Queue) => Effect.Effect<Option.Option<Queue>>
    make: (self: User, gender: User["gender"]) => Effect.Effect<Queue>
    isInQueue: (self: Types.Context) => Effect.Effect<boolean, RedisAnyError>
  }
>() { }

const byRaiting = Order.mapInput(Order.number, (self: Queue) => self.raiting)

const byTagMatches = (root: Queue): Order.Order<Queue> => (self: Queue, that: Queue) => {
  return Order.number(
    Array.intersection(root.tags, self.tags).length,
    Array.intersection(root.tags, that.tags).length
  )
}

const computedRaiting = ({ likes, dislikes }: { likes: number, dislikes: number }): number =>
  likes + dislikes === 0 ? 0 : likes / (likes + dislikes);


export const QueueServiceLive = Layer.succeed(
  QueueService,
  QueueService.of({
    append: (self: Queue) => Effect.tryPromise({
      try: () => Redis.exists(`queue:${self.id}`),
      catch: () => new RedisAnyError()
    }).pipe(
      Effect.filterOrFail(
        (r) => r === 0,
        () => new UserAlreadyInQueue(),
      ),
      Effect.andThen(() =>
        Effect.tryPromise({
          try: async () => {
            await Redis.hset(`queue:${self.id}`, serializeQueue(self))
            await Redis.expire(`queue:${self.id}`, 24 * 60 * 60)
          },
          catch: () => new RedisAnyError()
        })
      )
    ),

    removal: (self: Types.Context) => Effect.tryPromise({
      try: () => Redis.del(`queue:${self.from!.username!}`),
      catch: () => new RedisAnyError()
    }).pipe(
      Effect.filterOrFail(
        h => h > 0,
        () => new UserIsNotQueue()
      )
    ),

    findRightOne: (self: Queue) => Effect.promise(() => Redis.keys("queue:*")).pipe(
      Effect.andThen(
        Effect.forEach((queue) => Effect.promise(() => Redis.hgetall(queue || "")))
      ),
      Effect.map(Array.map(h => deserializeQueue(h))),
      Effect.map(Array.filter(
        (candidate) => {
          const isGenderMatch = (self: Queue, that: Queue) =>
            (self.searchGender === "any" && that.searchGender === self.gender)
            || (that.gender === self.searchGender && that.searchGender === self.gender)
            || (that.searchGender === "any" && self.searchGender === that.gender);

          return Math.abs(candidate.age - self.age) <= 5
            // && candidate.tags.some(tag => self.tags.includes(tag))
            && isGenderMatch(self, candidate)
        }
      )),
      Effect.map(Array.sort(Order.combine(byTagMatches(self), byRaiting))),
      Effect.map(Array.get(0)),
    ),

    make: (
      { id, chat, gender, age, tags, raiting }: User,
      searchGender: User["gender"]
    ) => Effect.promise(() => Redis.setex(`search:${id}`, 60 * 60, searchGender,))
      .pipe(
        Effect.as({
          id, chat, gender, age, tags,
          raiting: computedRaiting(raiting),
          searchGender,
        })
      ),

    isInQueue: (self: Types.Context) => Effect.gen(function*() {
      return yield* Effect.tryPromise({
        try: () => Redis.exists(`queue:${self.from!.username!}`),
        catch: () => new RedisAnyError()
      }).pipe(
        Effect.map(h => Boolean(h))
      )
    })
  })
)
