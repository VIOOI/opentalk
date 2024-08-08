import { Data, Context, Effect, Layer } from "effect";
// import { GC } from "../types.js";
import { serializeUser, User } from "../Models/User.model.js";
import { Drizzle } from "../Databases/Drizzle.js";
import { UserTable } from "../Databases/User.table.js";

export class UserAlreadyExistsError extends Data.TaggedError("UserAlreadyExistsError") { }
export class UserNotFoundError extends Data.TaggedError("UserNotFoundError") { }
export class DrizzleAnyError extends Data.TaggedError("DrizzleAnyError") { }


export class DatabaseService extends Context.Tag("DatabaseService")<
DatabaseService,
{
  addedUser: (self: User) => Effect.Effect<User, DrizzleAnyError>,
}
>() {}

export const DatabaseServiceLive = Layer.succeed(
  DatabaseService,
  DatabaseService.of({
    addedUser: (self: User) => Effect.gen(function* (_) {
      const validateUser = serializeUser(self)
      return yield* Effect.tryPromise({
        try: () => Drizzle.insert(UserTable).values(validateUser),
        catch: () => new DrizzleAnyError()
      }).pipe(
          Effect.as(self)
        )
    })
  })
)
