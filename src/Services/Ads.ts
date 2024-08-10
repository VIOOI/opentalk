import { Array, Context, Data, Effect, Layer, Option, pipe } from "effect";
import { Drizzle } from "../Databases/Drizzle.js";
import { User } from "../Schemas/User.js";
import { Ads, DefaultPostAds, DefaultSmallAds, deserializeAds } from "../Schemas/Ads.js";
import { DrizzleAnyError } from "./Database.js";

// class AdNotMatchedError extends Data.TaggedError("AdNotMatchedError") { }

export class AdsService extends Context.Tag("AdsService")<
  AdsService,
  {
    getMatched: (self: User, type: Ads["type"]) => Effect.Effect<Option.Option<Ads>>
    getRandom: (type: Ads["type"]) => Effect.Effect<Ads>

  }
>() { }

const isWithinRange = (range: readonly [number, number], value: number): boolean =>
  value >= Math.min(...range) && value <= Math.max(...range);

const hasCommonTags = <T>(arr1: readonly T[], arr2: readonly T[]): boolean =>
  arr1.some(element => arr2.includes(element));

const getRandomAds = <T>(arr: readonly T[]) =>
  Array.get(arr, Math.floor(Math.random() * arr.length))




export const AdsServiceLive = Layer.succeed(
  AdsService,
  AdsService.of({

    getMatched: (self: User, type: Ads["type"]) => Effect.gen(function*(_) {
      const manyAds = yield* Effect.tryPromise({
        try: () => Drizzle.query.AdsTable.findMany({
          where: (ads, { eq, and, or }) => and(
            or(
              eq(ads.targetGender, self.gender),
              eq(ads.targetGender, "any")
            ),
            eq(ads.type, type),
          )
        }),
        catch: () => new DrizzleAnyError()
      }).pipe(
        Effect.filterOrFail(
          Array.isNonEmptyArray,
          () => new DrizzleAnyError(),
        )
      );

      return pipe(
        manyAds,
        Array.map(ads => deserializeAds(ads)),
        Array.filter(
          ads =>
            isWithinRange(ads.targetAge, self.age)
            // && hasCommonTags(ads.targetTags, self.tags)
        ),
        getRandomAds,
      )
    }).pipe(
      Effect.catchTag("DrizzleAnyError", () => Effect.succeed(Option.none()))
    ),
    getRandom: (type: Ads["type"]) => Effect.gen(function*(_) {
      const manyAds = yield* Effect.tryPromise({
        try: () => Drizzle.query.AdsTable.findMany({
          where: (ads, { eq, and }) => and(
            eq(ads.type, type),
          )
        }),
        catch: () => new DrizzleAnyError()
      }).pipe(
        Effect.filterOrFail(
          Array.isNonEmptyArray,
          () => new DrizzleAnyError(),
        )
      );

      return pipe(
        manyAds,
        Array.map(ads => deserializeAds(ads)),
        getRandomAds,
        Option.getOrElse(() => type === "small" ? DefaultSmallAds : DefaultPostAds)
      )
    }).pipe(
      Effect.catchTag("DrizzleAnyError", () => Effect.succeed(type === "small" ? DefaultSmallAds : DefaultPostAds))
    ),


  })
)
