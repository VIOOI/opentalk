import { Schema } from "@effect/schema";
// biome-ignore lint/suspicious/noShadowRestrictedNames: LINTER: 
import { Array, Effect, Number, Option, String, Tuple, pipe } from "effect";
import * as Ref from "effect/Ref";


// const RaitingSchema = Schema.Struct({
//   likes: Schema.Number,
//   dislikes: Schema.Number,
// })
//
// const StringToNumber = Schema.transform(
//   Schema.String,
//   Schema.Number,
//   {
//     encode: h => `${h}`,
//     decode: h => Number(h)
//   }
// )

export const UserSchema = Schema.Struct({
  username: Schema.String,
  chat: Schema.String,
  name: Schema.String,
  gender: Schema.Literal("men", "women", "any"),
  age: Schema.Number,
  description: Schema.String,
  rating: Schema.transform(
    Schema.String,
    Schema.Tuple(Schema.Number, Schema.Number),
    {
      encode: self => `${self.at(0) || 0} ${self.at(1) || 0}`,
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
  tags: Schema.String,
});
export type User = Schema.Schema.Type<typeof UserSchema>;

export const deserializeUser = Schema.decodeUnknownSync(UserSchema);
export const serializeUser = Schema.encodeUnknownSync(UserSchema);
export const serializePartialUser = Schema.encodeUnknownSync(Schema.partial(UserSchema));
export const parseUser = Schema.decodeUnknownSync(Schema.parseJson(UserSchema));
export const stringifyUser = Schema.encodeUnknownSync(Schema.parseJson(UserSchema));


export const seedUser = Ref.make<User>({
  username: "default",
  chat: "0",
  gender: "any",
  name: "",
  age: 0,
  description: "",
  rating: [0, 0],
  tags: "",
})
