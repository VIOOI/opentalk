import { Schema } from "@effect/schema";
// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
import { Array, String } from "effect";
import * as uuid from 'uuid';
import { UserSchema } from "./User.js";

export const AdsSchema = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("small", "post"),
  content: Schema.String,
  targetAge: Schema.transform(
    Schema.String,
    Schema.Tuple(Schema.Number, Schema.Number),
    {
      encode: ([min, max]) => `${min}-${max}`,
      decode: (str) => Array.map(
        String.split(str, "-"),
        s => Number(s)
      ) as unknown as readonly [number, number]
    }
  ),
  targetGender: UserSchema.fields.gender,
  targetTags: UserSchema.fields.tags,
  compaignType: Schema.Literal("views", "time"),
  maxViews: Schema.Number,
  startDate: Schema.String,
  endDate: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
})

export const deserializeAds = Schema.decodeUnknownSync(AdsSchema);
export const serializeAds = Schema.encodeUnknownSync(AdsSchema);

export type Ads = Schema.Schema.Type<typeof AdsSchema>

export const DefaultSmallAds: Ads = {
  id: uuid.v4(),
  type: "small",
  content: "Новости и полезная информация о боте @opentalkru",
  targetAge: [0, 99],
  targetGender: "any",
  targetTags: ["*"],
  compaignType: "time",
  maxViews: -1,
  startDate: Date.now().toString(),
  endDate: Date.now().toString(),
  createdAt: Date.now().toString(),
  updatedAt: Date.now().toString(),
}

export const DefaultPostAds: Ads = {
  id: uuid.v4(),
  type: "small",
  content: "Новости и полезная информация о боте @opentalkru",
  targetAge: [0, 99],
  targetGender: "any",
  targetTags: ["*"],
  compaignType: "time",
  maxViews: -1,
  startDate: Date.now().toString(),
  endDate: Date.now().toString(),
  createdAt: Date.now().toString(),
  updatedAt: Date.now().toString(),
}
