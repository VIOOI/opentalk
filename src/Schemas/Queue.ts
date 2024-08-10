
import { Schema } from "@effect/schema";
import { UserSchema } from "./User.js";
// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
import { Array, String } from "effect";

const StringToNumber = Schema.transform(
  Schema.String,
  Schema.Number,
  {
    encode: h => `${h}`,
    decode: h => Number(h)
  }
)

export const QueueSchema = Schema.Struct({
  id: UserSchema.fields.id,
  chat: StringToNumber,
  gender: UserSchema.fields.gender,
  searchGender: UserSchema.fields.gender,
  age: StringToNumber,
  tags: Schema.transform(
    Schema.String,
    Schema.Array(Schema.String),
    {
      encode: Array.join(" "),
      decode: String.split(" ")
    }
  ),
  raiting: StringToNumber,
})

export type Queue = Schema.Schema.Type<typeof QueueSchema>

export const deserializeQueue = Schema.decodeUnknownSync(QueueSchema);
export const serializeQueue = Schema.encodeUnknownSync(QueueSchema);

