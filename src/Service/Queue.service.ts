// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
import { Array, Console, Context, Data, Effect, Layer, Option, Order } from "effect";
// import { User } from "../Models/User.model.js";
import { deserializeQueue, Queue, serializeQueue } from "../Models/Queue.model.js";
import { Redis } from "../Databases/Redis.js";
import { User } from "../Models/User.model.js";
import { GC } from "../types.js";

class UserAlreadyInQueue extends Data.TaggedError("UserAlreadyInQueue") { }
class UserIsNotQueue extends Data.TaggedError("UserIsNotQueue") { }
class RedisAnyError extends Data.TaggedError("RedisAnyError") { }

export class QueueService extends Context.Tag("Queue")<
  QueueService,
  {
    append: (self: Queue) => Effect.Effect<void, UserAlreadyInQueue | RedisAnyError>
    removal: (self: GC) => Effect.Effect<void, UserIsNotQueue | RedisAnyError>
    findRightOne: (self: Queue) => Effect.Effect<Option.Option<Queue>>
    make: (self: User, gender: User["gender"]) => Effect.Effect<Queue>
    isInQueue: (self: GC) => Effect.Effect<boolean, RedisAnyError>
  }
>() { }

const byRaiting = Order.mapInput(Order.number, (self: Queue) => self.raiting)

// arr1.filter(item => arr2.includes(item));
const byTagMatches = (root: Queue): Order.Order<Queue> => (self: Queue, that: Queue) => {
  return Order.number(
    Array.intersection(root.tags, self.tags).length,
    Array.intersection(root.tags, that.tags).length
  )
}

const calcRaiting = (likes: number, dislikes: number): number =>
  likes + dislikes === 0 ? 0 : likes / (likes + dislikes);

export const QueueServiceLive = Layer.succeed(
  QueueService,
  QueueService.of({
    append: (self: Queue) => Effect.gen(function*(_) {
      // console.log(self)
      yield* Effect.tryPromise({
        try: () => Redis.exists(`queue:${self.id}`),
        catch: () => new RedisAnyError()
      }).pipe(
        Effect.filterOrFail(
          (r) => r === 0,
          () => new UserAlreadyInQueue(),
        )
      )
      // console.log(serializeQueue(self))
      yield* Effect.tryPromise({
        try: async () => {
          await Redis.hset(`queue:${self.id}`, serializeQueue(self))
          await Redis.expire(`queue:${self.id}`, 24 * 60 * 60)
        },
        catch: () => new RedisAnyError()
      })
    }),

    removal: (self: GC) => Effect.gen(function*(_) {
      yield* _(
        Effect.tryPromise({
          try: () => Redis.del(`queue:${self.from!.username!}`),
          catch: () => new RedisAnyError()
        }),
        Effect.filterOrFail(
          h => h > 0,
          () => new UserIsNotQueue()
        )
      )
    }),

    findRightOne: (self: Queue) => Effect.gen(function*() {
      return yield* Effect.forEach(
        yield* Effect.promise(() => Redis.keys("queue:*")),
        (queue) => Effect.promise(() => Redis.hgetall(queue || ""))
      ).pipe(
        Effect.map(Array.map(h => deserializeQueue(h))),
        Effect.map(Array.filter(
          (candidate) => {
            const isGenderMatch = (self: Queue, that: Queue) =>
              (self.searchGender === "any" && that.searchGender === self.gender)
              || (that.gender === self.searchGender && that.searchGender === self.gender)
              || (that.searchGender === "any" && self.searchGender === that.gender);

            console.log(candidate.tags, self.tags, candidate.tags.some(tag => self.tags.includes(tag)));

            return Math.abs(candidate.age - self.age) <= 5
              && candidate.tags.some(tag => self.tags.includes(tag))
              && isGenderMatch(self, candidate)
          }
        )),
        Effect.map(Array.sort(Order.combine(byTagMatches(self), byRaiting))),
        Effect.map(Array.get(0)),
      )
    }),

    make: ({ id, chat, gender: selfGender, age, tags, raiting }: User, gender: User["gender"]) => Effect.gen(function*() {
      yield* Effect.promise(() => Redis.setex(`lastsearch:${id}`, 60 * 60, gender,))
      return {
        id,
        chat,
        gender: selfGender,
        age, tags,
        raiting: calcRaiting(raiting.likes, raiting.dislikes),
        searchGender: gender,
      }
    }),

    isInQueue: (self: GC) => Effect.gen(function*() {
      return yield* Effect.tryPromise({
        try: () => Redis.exists(`queue:${self.from!.username!}`),
        catch: () => new RedisAnyError()
      }).pipe(
        Effect.map(h => h === 0 ? false : true)
      )
    })
  })
)
