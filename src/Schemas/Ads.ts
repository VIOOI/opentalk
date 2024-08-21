import { Schema } from "@effect/schema";
// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
import { Array, Number, Option, pipe, String, Tuple } from "effect";
import { v4 as uuidv4 } from 'uuid';
import { TagsSchema, UserSchema } from "./User.js";

export const AdsSchema = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("small", "large", "forwared"),
  content: Schema.String,
  age: Schema.transform(
    Schema.String,
    Schema.Tuple(Schema.Number, Schema.Number),
    {
      encode: self => `${Tuple.getFirst(self)} ${Tuple.getSecond(self)}`,
      decode: self => pipe(
        String.split(self, " "),
        Array.map(s => Number.parse(s).pipe(Option.getOrElse(() => 0))),
        num => Tuple.make(
          Array.unsafeGet(num, 0),
          Array.unsafeGet(num, 1),
        )
      )
    }
  ),
  gender: UserSchema.fields.gender,
  tags: UserSchema.fields.tags,
})

export const deserializeAds = Schema.decodeUnknownSync(AdsSchema);
export const serializeAds = Schema.encodeUnknownSync(AdsSchema);

export type Ads = Schema.Schema.Type<typeof AdsSchema>

export const DefaultSmallAds: Ads = {
  id: uuidv4(),
  type: "small",
  content: "Новости и полезная информация о боте @opentalkru",
  tags: [],
  gender: "any",
  age: [0, 99],
}

export const DefaultPostAds: Ads = {
  id: uuidv4(),
  type: "large",
  content: "Новости и полезная информация о боте @opentalkru",
  tags: [],
  gender: "any",
  age: [0, 99],
}
