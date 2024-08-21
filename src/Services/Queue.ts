import {
  // biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
  Array,
  Tuple,
  Console,
  Context,
  Data,
  Effect,
  Layer,
  Match,
  Option,
  Order,
  pipe,
} from "effect";
import { Redis } from "../Databases/Redis.js";
// import { User } from "../Models/User.model.js";
import {
  Queue,
  QueueSchema,
  deserializeQueue,
  parseQueue,
  serializeQueue,
  stringifyQueue,
} from "../Schemas/Queue.js";
import * as Types from "../Types.js";
import { deserializeUser, parseUser, User } from "../Schemas/User.js";

class UserAlreadyInQueue extends Data.TaggedError("UserAlreadyInQueue") { }
class UserIsNotQueue extends Data.TaggedError("UserIsNotQueue") { }
class RedisAnyError extends Data.TaggedError("RedisAnyError") { }

export class QueueService extends Context.Tag("Queue")<
  QueueService,
  {
    add: (
      self: Queue,
    ) => Effect.Effect<void, UserAlreadyInQueue | RedisAnyError>;
    delete: (
      self: Types.Context,
    ) => Effect.Effect<void, UserIsNotQueue | RedisAnyError>;
    find: (self: Queue) => Effect.Effect<Option.Option<Queue>>;
    make: (
      context: Types.Context,
      self: User,
      gender: User["gender"],
    ) => Effect.Effect<Queue>;
    print: (self: User) => Effect.Effect<string>,
    isInQueue: (self: Types.Context) => Effect.Effect<boolean, RedisAnyError>;
  }
>() { }

const byRaiting = Order.mapInput(Order.number, (self: Queue) => self.raiting);

const equelTags = (self: User["tags"][number], that: User["tags"][number]) =>
  self.name == that.name;

const byTagMatches =
  (root: Queue): Order.Order<Queue> =>
    (self: Queue, that: Queue) => {
      return Order.number(
        pipe(
          self.tags,
          Array.filter((h) => Array.some(root.tags, (t) => equelTags(h, t))),
          Array.reduce(0, (accum, tag) => accum + tag.power),
        ),
        pipe(
          that.tags,
          Array.filter((h) => Array.some(root.tags, (t) => equelTags(h, t))),
          Array.reduce(0, (accum, tag) => accum + tag.power),
        )
      );
    };

const computedRaiting = ([like, dislike]: readonly [number, number]): number =>
  like + dislike === 0 ? 0 : like / (like + dislike);

const cahedQueue = (self: Queue) =>
  Effect.promise(() =>
    Redis.set(`queue:${self.username}`, stringifyQueue(self)),
  );
// const deleteCahedQueue = (self: Queue) =>
//   Effect.promise(() => Redis.del(`queue:${self.username}`));
// const getCahedQueue = (self: Queue) =>
//   Effect.promise(() => Redis.hgetall(`queue:${self.username}`)).pipe(
//     Effect.map(parseQueue),
//   );

// likes + dislikes === 0 ? 0 : likes / (likes + dislikes);
const isGenderMatch = (self: Queue, that: Queue) =>
  (self.searchGender === "any" && that.searchGender === self.gender) ||
  (that.gender === self.searchGender && that.searchGender === self.gender) ||
  (that.searchGender === "any" && self.searchGender === that.gender);

const getTagsWithMod = (self: Queue["tags"], mod: -1 | 0 | 1) => pipe(
  self,
  Array.filter((self) => self.mod === mod),
  Array.map(self => self.name)
)
const getImportantlyFull = (self: Queue["tags"], that: Array<string>) => pipe(
  self,
  Array.filter(({ name }) => that.includes(name)),
  Array.length,
  h => h === that.length
)
const getNotAbsent = (self: Queue["tags"], that: Array<string>) => pipe(
  self,
  Array.filter(({ name }) => that.includes(name)),
  Array.length,
  h => h === 0
)

export const QueueServiceLive = Layer.succeed(
  QueueService,
  QueueService.of({
    add: (self: Queue) =>
      Effect.tryPromise({
        try: () => Redis.exists(`queue:${self}`),
        catch: () => new RedisAnyError(),
      }).pipe(
        Effect.filterOrFail(
          r => r === 0,
          () => new UserAlreadyInQueue(),
        ),
        Effect.andThen(() => cahedQueue(self)),
      ),

    delete: (self: Types.Context) =>
      Effect.tryPromise({
        try: () => Redis.del(`queue:${self.from!.username!}`),
        catch: () => new RedisAnyError(),
      }).pipe(
        Effect.filterOrFail(
          h => h > 0,
          () => new UserIsNotQueue(),
        ),
      ),

    find: (self: Queue) => Effect.gen(function*(_) {
      const queue = yield* Effect.promise(() => Redis.keys("queue:*")).pipe(
        Effect.andThen(
          Effect.forEach(queue => Effect.promise(() => Redis.get(queue || ""))),
        ),
        Effect.map(Array.map(h => parseQueue(h))),
      )

      const selfImportantlyTags = getTagsWithMod(self.tags, 1);
      const selfAbsentTags = getTagsWithMod(self.tags, -1);

      const filteredQueue = Array.filter(queue, candidate => {
        const thatImportantlyTags = getTagsWithMod(candidate.tags, 1);
        const thatAbsentTags = getTagsWithMod(candidate.tags, -1);

        const isPermittedAge = Math.abs(candidate.age - self.age) <= 5;
        const isUniformCategories = Array.intersection(candidate.categories, self.categories).length > 0;
        const isImportantlyFull = getImportantlyFull(candidate.tags, selfImportantlyTags) 
          && getImportantlyFull(self.tags, thatImportantlyTags);
        const isNotAbsent = getNotAbsent(candidate.tags, selfAbsentTags) 
          && getNotAbsent(self.tags, thatAbsentTags)

        return isGenderMatch(self, candidate) &&
          isPermittedAge &&
          isNotAbsent &&
          isImportantlyFull &&
          isUniformCategories
      });

      return pipe(
        filteredQueue,
        Array.sort(Order.combine(byTagMatches(self), byRaiting)),
        Array.get(0),
      )
    }),
    print: (self: User) => Effect.gen(function*(_) {

      const matchgender = Match.type<User["gender"]>().pipe(
        Match.when("men", () => "♂"),
        Match.when("women", () => "♀"),
        Match.when("any", () => "⚤"),
        Match.exhaustive,
      )

      const moonPhases = ['☆', '☆', '☆', '★', '★'] as const;

      const moonRating = ([likes, dislikes]: readonly [number, number]): string => {
        const totalVotes = likes + dislikes;
        if (totalVotes === 0) return "Оценок пока нету";

        const starRating = Math.round((likes / totalVotes) * 10) / 2;

        return pipe(
          Array.range(1, 5),
          Array.map((_, i) =>
            Array.get(moonPhases, Math.min(Math.floor(Math.max(starRating - i, 0) * 4), 4)).pipe(
              Option.getOrElse(() => "")
            )
          ),
          Array.join("")
        )
      };

      return `${self.name} ${self.age} 
${matchgender(self.gender)} ${moonRating(self.rating)}
${self.description}`
    }),

    make: (
      context: Types.Context,
      { username, chat, gender, age, tags, rating }: User,
      searchGender: User["gender"],
    ) => Effect.sync(() => QueueSchema.make({
      username,
      chat,
      gender: gender || "any",
      age: age || 18,
      categories: context.session.categories,
      tags,
      raiting: computedRaiting(rating),
      searchGender,
    })),

    isInQueue: (self: Types.Context) =>
      Effect.gen(function*() {
        return yield* Effect.tryPromise({
          try: () => Redis.exists(`queue:${self.from!.username!}`),
          catch: () => new RedisAnyError(),
        }).pipe(Effect.map(h => Boolean(h)));
      }),
  }),
);
