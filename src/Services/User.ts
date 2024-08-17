// import { UserAlreadyExistsError, UserNotFoundError } from "./Database.js"
import { eq } from "drizzle-orm"
// biome-ignore lint/suspicious/noShadowRestrictedNames: LINTER:
import { Array, Boolean, Console, Context, Data, Effect, Layer } from "effect"
import { Partial } from "type-plus"
import { Drizzle } from "../Databases/Drizzle.js"
import { Redis } from "../Databases/Redis.js"
// import { User, UserTable } from "../Databases/Tables/User.js"
import { User, deserializeUser, parseUser, serializePartialUser, serializeUser } from "../Schemas/User.js"
import * as Types from "../Types.js"
import { users } from "../Databases/Tables/User.js"
import { Schema } from "@effect/schema"
import { isNotNull, isNotUndefined } from "effect/Predicate"

export class UserAlreadyExistsError extends Data.TaggedError("UserAlreadyExistsError") { }
export class UserNotFoundError extends Data.TaggedError("UserNotFoundError") { }

export class UserService extends Context.Tag("UserService")<
  UserService,
  {
    add: (self: User) => Effect.Effect<User>
    delete: (self: Types.Context) => Effect.Effect<User, UserNotFoundError>
    update: (self: Types.Context, fields: Partial<User>) => Effect.Effect<User, UserNotFoundError>

    getSelf: (self: Types.Context) => Effect.Effect<User, UserNotFoundError>
    getById: (self: User["username"]) => Effect.Effect<User, UserNotFoundError>
  }
>() { }

const cahedUser = (self: User) => Effect.promise(() => Redis.hset(`user:${self.username}`, self));
const deleteCahedUser = (self: User) => Effect.promise(() => Redis.del(`user:${self.username}`));
const getCahedUser = (self: Types.Context) => Effect.promise(() => Redis.hgetall(`user:${self.from!.username!}`)).pipe(
  Effect.map(parseUser)
);

export const UserServiceLive = Layer.succeed(
  UserService,
  UserService.of({

    add: (self: User) => Effect.gen(function*(_) {
      // yield* Console.info(self);
      yield* Effect.tryPromise({
        try: () => Drizzle.insert(users).values(serializeUser(self)),
        catch: () => new UserAlreadyExistsError(),
      });
      yield* cahedUser(self);
      return self;
    }).pipe(
      Effect.catchTag(
        "UserAlreadyExistsError",
        () => Effect.promise(() => Drizzle.update(users).set(serializeUser(self))
          .where(eq(users.username, self.username)).returning())
          .pipe(
            Effect.map(deserializeUser),
            Effect.tap(cahedUser)
          )
      )
    ),

    delete: (self: Types.Context) => Effect.tryPromise({
      try: () => Drizzle.delete(users).where(eq(users.username, self.from!.username!)).returning(),
      catch: () => new UserNotFoundError(),
    }).pipe(
      Effect.map(Array.unsafeGet(0)),
      Effect.map(deserializeUser),
      Effect.tap(deleteCahedUser)
    ),

    update: (self: Types.Context, fields: Partial<User>) => Effect.tryPromise({
      try: () => Drizzle.update(users).set(serializePartialUser(fields)).where(eq(users.username, self.from!.username!)).returning(),
      catch: () => new UserNotFoundError(),
    }).pipe(
      Effect.map(Array.unsafeGet(0)),
      Effect.map(deserializeUser),
      Effect.tap(cahedUser)
    ),

    getSelf(self: Types.Context) {
      return this.getById(self.from!.username!)
    },

    getById: (self: User["username"]) => Effect.tryPromise({
      try: () => Redis.get(`user:${self}`),
      catch: () => new Error(),
    }).pipe(
      Effect.filterOrFail( isNotNull, () => new Error())
    ).pipe(
      Effect.matchEffect({
        onFailure: () => Effect.tryPromise({
          try: () => Drizzle.query.users.findFirst({
            where: (user, { eq }) => eq(user.username, self)
          }),
          catch: () => new UserNotFoundError(),
        }).pipe(
          Effect.filterOrFail( isNotUndefined, () => new UserNotFoundError()),
          Effect.map(deserializeUser),
          Effect.tap(cahedUser)
        ),
        onSuccess: (user) => Effect.succeed(deserializeUser(user)),
      }),
    )

  })
)
