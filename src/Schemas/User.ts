import { Schema } from "@effect/schema";
// biome-ignore lint/suspicious/noShadowRestrictedNames: LINTER: 
import { Array, Effect, String, pipe } from "effect";
import * as Ref from "effect/Ref";


const RaitingSchema = Schema.Struct({
  likes: Schema.Number,
  dislikes: Schema.Number,
})

const StringToNumber = Schema.transform(
  Schema.String,
  Schema.Number,
  {
    encode: h => `${h}`,
    decode: h => Number(h)
  }
)

export const UserSchema = Schema.Struct({
  id: Schema.String,
  chat: StringToNumber,
  gender: Schema.Literal("men", "women", "any"),
  name: Schema.String,
  age: StringToNumber,
  description: Schema.String,
  raiting: Schema.transform(
    Schema.String,
    RaitingSchema,
    {
      encode: self => `${self.likes}/${self.dislikes}`,
      decode: self => pipe(
        String.split(self, "/"),
        Array.map(s => Number(s)),
        ([ likes, dislikes ]) => ({ likes: likes!, dislikes: dislikes! })
      )
    }
  ),
  tags: Schema.transform(
    Schema.String,
    Schema.Array(Schema.String),
    {
      encode: Array.join(" "),
      decode: String.split(" ")
    }
  )
});
export type User = Schema.Schema.Type<typeof UserSchema>;

export const deserializeUser = Schema.decodeUnknownSync(UserSchema);
export const serializeUser = Schema.encodeUnknownSync(UserSchema);
// export const validateUser = Schema.validateSync(UserSchema);


export const seedUser = Ref.make<User>({
  id: "default",
  chat: 0,
  gender: "any",
  name: "",
  age: 0,
  description: "",
  raiting: { likes: 0, dislikes: 0 },
  tags: [],
})
