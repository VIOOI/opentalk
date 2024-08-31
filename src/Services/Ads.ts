import {
  Array,
  Console,
  Context,
  Data,
  Effect,
  Layer,
  Random,
  Ref,
} from "effect";
import { Drizzle } from "../Databases/Drizzle.js";
// import { DrizzleAds } from "../Databases/Tables/Ads.js";
// import { ads } from "../Databases/Tables/Ads.js";
// import { users } from "../Databases/Tables/User.js";
import {
  Ads,
  DefaultPostAds,
  DefaultSmallAds,
  deserializeAds,
} from "../Schemas/Ads.js";
import { User } from "../Schemas/User.js";
import { isNotUndefined } from "effect/Predicate";
// import { safeSendMessage, UnknownMessageError } from "../Shared/safeSend.js";
// import * as Types from "../Types.js";
// import { MainMenu } from "../Keyboards/MainKeyboard.js";
// import { ForbiddenError } from "../../build/Shared/safeSend.cjs";

class AdNotMatchedError extends Data.TaggedError("AdNotMatchedError") { }

export class AdsService extends Context.Tag("AdsService")<
  AdsService,
  {
    get: (self: User) => Effect.Effect<Ads>;
  }
>() { }

const getDrizzleAds = (gender: User["gender"]) =>
  Effect.tryPromise({
    try: () =>
      Drizzle.query.ads.findMany({
        where: (ads, { eq, and, or }) =>
          and(
            or(eq(ads.gender, "any"), eq(ads.gender, gender)),
            // type == "small"
            //   ? eq(ads.type, "small")
            //   : or(eq(ads.type, "large"), eq(ads.type, "forwared")),
          ),
      }),
    catch: () => new AdNotMatchedError(),
  }).pipe(
    Effect.map(Array.map(ad => {
      if (ad.type === "small") return { ...ad, probability: ad.probability! + 1.2 };
      return { ...ad, probability: ad.probability! + 0.2 };
    }))
  );


export const AdsServiceLive = Layer.succeed(
  AdsService,
  AdsService.of({
    get: (self: User) =>
      Effect.gen(function*(_) {
        const ads = yield* getDrizzleAds(self.gender);

        const total = Array.reduce(ads,
          0, (acc, ad) => acc + (ad.probability || 0),
        )
        const random = yield* Random.next.pipe(Effect.map(n => n * total))
        const current = yield* Ref.make(0);

        return yield* Effect.all(
          Array.map(
            ads,
            (ad) => Effect.gen(function*(_) {

              const cur = yield* Ref.updateAndGet(current, n => n + (ad.probability || 0))
              // current = current + (ad.probability || 0)
              // yield* Console.log(total, self, random, ad.probability, cur > random)
              if (cur > random)
                return ad
              else yield* Effect.fail(new AdNotMatchedError());
            }),
          )
        ).pipe(
          Effect.map(Array.filter(isNotUndefined)),
          Effect.map(Array.unsafeGet(0)),
          Effect.map(deserializeAds)
        )
      }).pipe(
        Effect.tap(Console.log),
        Effect.catchAll(() => Effect.succeed(DefaultSmallAds)),
      ),
  }),
);
