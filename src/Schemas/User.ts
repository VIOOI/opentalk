import { Schema } from "@effect/schema";
// biome-ignore lint/suspicious/noShadowRestrictedNames: LINTER: 
import { Array, Effect, Number, Option, Ref, RegExp, String, Tuple, pipe } from "effect";


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

export const TagsSchema = Schema.transform(
  Schema.String,
  Schema.Array(Schema.Struct({
    name: Schema.String,
    power: Schema.Number,
    mod: Schema.Literal(-1, 0, 1)
  })),
  {
    encode: (self) => pipe(
      self,
      Array.map(self => `${self.mod === -1 ? "-" : self.mod === 1 ? "!" : ""}${self.name}${self.power > 1 ? (":" + self.power) : ""}`),
      Array.join(" "),
    ),
    decode: (self) => pipe(
      self.split(" "),
      Array.map(String.match(/^([!-]?)([a-zA-Zа-яА-Я]+)(?::(\d+))?$/)),
      // Array.map(h => {
      //   console.log(h);
      //   return h;
      // }),
      Array.map((regexpmatch) => {
        if (Option.isNone(regexpmatch)) return {
          name: "",
          power: 0,
          mod: 0 as (-1 | 0 | 1),
        }

        const [_, bool, name, power] = regexpmatch.value;

        return {
          name: `${name || ""}`,
          power: Number.parse(power || "1").pipe(
            Option.getOrElse(() => 1)
          ),
          mod: (String.isEmpty(bool! || "") ? 0 : bool! === "!" ? 1 : -1) as (-1 | 0 | 1)
        }
      }),
    )
  }
)

export type Tag = Schema.Schema.Type<typeof TagsSchema>;
export const deserializeTags = Schema.decodeUnknownSync(TagsSchema);
export const serializeTags = Schema.encodeUnknownSync(TagsSchema);
export const isValidateTags = Schema.decodeUnknownOption(TagsSchema);


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
  tags: TagsSchema,
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
  tags: [],
})
