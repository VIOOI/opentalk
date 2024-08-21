import { Array, Context, Data, Effect, Layer, Option, pipe, Random } from "effect";
import { Drizzle } from "../Databases/Drizzle.js";
// import { ads } from "../Databases/Tables/Ads.js";
// import { users } from "../Databases/Tables/User.js";
import {
  Ads,
  DefaultPostAds,
  DefaultSmallAds,
  deserializeAds,
} from "../Schemas/Ads.js";
import { User } from "../Schemas/User.js";
import * as Types from "../Types.js"
import { safeSendMessage } from "../Shared/safeSend.js";

class AdNotMatchedError extends Data.TaggedError("AdNotMatchedError") { }

export class AdsService extends Context.Tag("AdsService")<
  AdsService,
  {
    getMatched: (
      self: User,
      type: "small" | "large",
    ) => Effect.Effect<Option.Option<Ads>, AdNotMatchedError>;
    getRandom: (type: "small" | "large") => Effect.Effect<Ads>;
    sendBigAds: (ctx: Types.Context, self: User) => Effect.Effect<void>
    getInlineAds: (self: User) => Effect.Effect<Ads>,
    isBigAds: Effect.Effect<boolean>
  }
>() { }

const isWithinRange = (
  range: readonly [number, number],
  value: number,
): boolean => value >= Math.min(...range) && value <= Math.max(...range);

// const hasCommonTags = <T>(arr1: readonly T[], arr2: readonly T[]): boolean =>
// 	arr1.some(element => arr2.includes(element));

const unsafeGetRandomAds = <T>(arr: readonly T[]) =>
  Array.unsafeGet(arr, Math.floor(Math.random() * arr.length));

const getRandomAds = <T>(arr: readonly T[]) =>
  Array.get(arr, Math.floor(Math.random() * arr.length));

export const AdsServiceLive = Layer.succeed(
  AdsService,
  AdsService.of({
    getMatched: (self: User, type: "small" | "large") =>
      Effect.gen(function*(_) {
        const manyAds = yield* Effect.tryPromise({
          try: () =>
            Drizzle.query.ads.findMany({
              where: (ads, { eq, and, or }) =>
                and(
                  or(
                    eq(ads.gender, "any"),
                    eq(ads.gender, self.gender),
                  ),
                  type == "small"
                    ? eq(ads.type, "small")
                    : or(eq(ads.type, "large"), eq(ads.type, "forwared")),
                ),
            }),
          catch: () => new AdNotMatchedError(),
        }).pipe(
          Effect.filterOrFail(
            Array.isNonEmptyArray,
            () => new AdNotMatchedError(),
          ),
        );

        return pipe(
          manyAds,
          Array.map(h => deserializeAds(h)),
          Array.filter(
            ads => isWithinRange(ads.age, self.age!),
            // && hasCommonTags(ads.tags, self.tags)
          ),
          getRandomAds,
        );
      }).pipe(
        Effect.catchTag("AdNotMatchedError", () =>
          Effect.succeed(Option.none()),
        ),
      ),
    getRandom: (type: "small" | "large") =>
      Effect.gen(function*(_) {
        const manyAds = yield* Effect.tryPromise({
          try: () =>
            Drizzle.query.ads.findMany({
              where: (ads, { eq, or }) =>
                type == "small"
                  ? eq(ads.type, "small")
                  : or(eq(ads.type, "large"), eq(ads.type, "forwared")),
            }),
          catch: () => new AdNotMatchedError(),
        }).pipe(
          Effect.filterOrFail(
            Array.isNonEmptyArray,
            () => new AdNotMatchedError(),
          ),
        );

        return pipe(
          manyAds,
          Array.map(a => deserializeAds(a)),
          unsafeGetRandomAds,
        );
      }).pipe(
        Effect.catchTag("AdNotMatchedError", () =>
          Effect.succeed(type === "small" ? DefaultSmallAds : DefaultPostAds),
        ),
      ),

    sendBigAds(ctx: Types.Context, self: User) {
      return Effect.gen(this, function*(_) {
        const matchedAds = yield* this.getMatched(self, "large").pipe(
          Effect.flatMap(Option.match({
            onSome: ads => Effect.succeed(ads),
            onNone: () => this.getRandom("large"),
          })),
        );
        if (matchedAds.type === "large") yield* safeSendMessage(ctx, self.chat, matchedAds.content);
        else {
          const [fromChatId, messageId] = matchedAds.content
            .split(" ")
            .map(h => Number(h))
          
          ctx.api.forwardMessage(Number(self.chat), fromChatId!, messageId!)
        }
      }).pipe(
        Effect.catchAll(() => Effect.succeed(DefaultPostAds))
      )
    },
    getInlineAds(self: User) {
      return this.getMatched(self, "small").pipe(
        Effect.flatMap(Option.match({
          onSome: ads => Effect.succeed(ads),
          onNone: () => this.getRandom("small"),
        })),
        Effect.catchAll(() => Effect.succeed(DefaultSmallAds))
      );
    },
    isBigAds: Random.nextRange(0, 10).pipe(Effect.map(n => n > 8))
  }),
);
