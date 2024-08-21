
import { Schema } from "@effect/schema";
import { TagsSchema, UserSchema } from "./User.js";
// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
import { Array, String } from "effect";


export const QueueSchema = Schema.Struct({
  username: UserSchema.fields.username,
  chat: Schema.String,
  gender: UserSchema.fields.gender,
  searchGender: UserSchema.fields.gender,
  age: Schema.Number,
  categories: Schema.Array(Schema.String),
  tags: TagsSchema.to,
  raiting: Schema.Number,
})

export type Queue = Schema.Schema.Type<typeof QueueSchema>

export const deserializeQueue = Schema.decodeUnknownSync(QueueSchema);
export const serializeQueue = Schema.encodeUnknownSync(QueueSchema);
export const serializePartialQueue = Schema.encodeUnknownSync(Schema.partial(QueueSchema));
export const parseQueue = Schema.decodeUnknownSync(Schema.parseJson(QueueSchema));
export const stringifyQueue = Schema.encodeUnknownSync(Schema.parseJson(QueueSchema));

