import { Data } from "effect";
import { Context, Effect } from "effect"
import { User } from "../Schemas/User.js"
import * as Types from "../Types.js"

export class UserAlreadyExistsError extends Data.TaggedError("UserAlreadyExistsError") { }
export class UserNotFoundError extends Data.TaggedError("UserNotFoundError") { }
export class DrizzleAnyError extends Data.TaggedError("DrizzleAnyError") { }


export class DatabaseUserService extends Context.Tag("DatabaseService")<
  DatabaseUserService,
  {
    add: (self: User) => Effect.Effect<User, UserAlreadyExistsError>
    remove: (context: Types.Context) => Effect.Effect<User, UserNotFoundError>
    // update: (that: Partial<User>) => Effect.Effect<User, UserNotFoundError>
    //
    getSelf: (context: Types.Context) => Effect.Effect<User, UserNotFoundError>
    getById: (self: string) => Effect.Effect<User, UserNotFoundError>
    // isAuthorized: (context: GrammyContext) => Effect.Effect<boolean>;
  }
>() { }
