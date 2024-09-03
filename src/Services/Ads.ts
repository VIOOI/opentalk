import {
  Array,
  Console,
  Context,
  Data,
  Effect,
  Layer,
  Match,
  Order,
  Random,
  Ref,
} from "effect";
import { Drizzle } from "../Databases/Drizzle.js";
import { DrizzleAds, ads as TableAds } from "../Databases/Tables/Ads.js";
// import { users } from "../Databases/Tables/User.js";
import {
  Ads,
  DefaultPostAds,
  DefaultSmallAds,
  deserializeAds,
} from "../Schemas/Ads.js";
import { User } from "../Schemas/User.js";
import { isNotUndefined } from "effect/Predicate";
import { eq } from "drizzle-orm";
// import { safeSendMessage, UnknownMessageError } from "../Shared/safeSend.js";
// import * as Types from "../Types.js";
// import { MainMenu } from "../Keyboards/MainKeyboard.js";
// import { ForbiddenError } from "../../build/Shared/safeSend.cjs";

class AdNotMatchedError extends Data.TaggedError("AdNotMatchedError") { }

export class AdsService extends Context.Tag("AdsService")<
  AdsService,
  {
    getForDatabse: (self: User) => Effect.Effect<Array<DrizzleAds>, AdNotMatchedError>;
    get: (self: User) => Effect.Effect<Ads>;
    increase: (self: Ads) => Effect.Effect<void>;
  }
>() { }


export const AdsServiceLive = Layer.succeed(
  AdsService,
  AdsService.of({

    getForDatabse: (self: User) =>
      Effect.tryPromise({
        try: () =>
          Drizzle.query.ads.findMany({
            where: (ads, { eq, or }) =>
              or(eq(ads.gender, "any"), eq(ads.gender, self.gender)),
          }),
        catch: () => new AdNotMatchedError(),
      }).pipe(
        Effect.map(Array.map(ad => {
          if (ad.type === "small") return { ...ad, probability: ad.probability! + 2 };
          return ad;
        })),
      ),

    increase: (self: Ads) => Match.value(self).pipe(
      Match.when({ impressions: -1 }, () => Effect.void),
      Match.when({ count: self.impressions - 1 }, () => Effect.promise(
        () => Drizzle.delete(TableAds)
          .where(eq(TableAds.id, self.id))
      )),
      Match.orElse(() => Effect.promise(
        () => Drizzle.update(TableAds)
          .set({ count: self.count + 1 })
          .where(eq(TableAds.id, self.id))
      ))
    ),

    get(self: User) {

      return Effect.gen(this, function*(_) {
        const ads = yield* this.getForDatabse(self);

        const total = Array.reduce(ads, 0, (acc, ad) => acc + (ad.probability || 0))
        const random = yield* Random.next.pipe(Effect.map(n => n * total))
        const current = yield* Ref.make(0);

        return yield* Effect.all(

          Array.map(ads, (ad) => Ref.updateAndGet(current, n => n + (ad.probability || 0)).pipe(
            Effect.flatMap(current =>
              Effect.if(current > random, {
                onTrue: () => Effect.succeed(ad),
                onFalse: () => Effect.fail(new AdNotMatchedError()),
              })
            ),
          ))

        ).pipe(
          Effect.map(Array.filter(isNotUndefined)),
          Effect.map(Array.unsafeGet(0)),
          Effect.map(deserializeAds),
          // @ts-ignore
          Effect.tap((ad) => this.increase(ad))
        )
      }).pipe(
        Effect.tap(Console.log),
        Effect.catchAll(() => Effect.succeed(DefaultSmallAds)),
      );

    }
  }),
);
