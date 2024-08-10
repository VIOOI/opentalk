// biome-ignore lint/suspicious/noShadowRestrictedNames: LINTER:
import { Array, Boolean, Console, Context, Effect, Layer } from "effect"
import { Partial } from "type-plus"
import { Drizzle } from "../Databases/Drizzle.js"
import { Redis } from "../Databases/Redis.js"
import { UserTable } from "../Databases/Tables/User.js"
import { User, deserializeUser, serializeUser } from "../Schemas/User.js"
import * as Types from "../Types.js"
import { UserAlreadyExistsError, UserNotFoundError } from "./Database.js"
import { eq } from "drizzle-orm"

export class UserService extends Context.Tag("UserService")<
  UserService,
  {
    add: (self: User) => Effect.Effect<User, UserAlreadyExistsError>
    delete: (context: Types.Context) => Effect.Effect<User, UserNotFoundError>
    //   update: (context: Types.Context, fields: Partial<User>) => Effect.Effect<User, UserNotFoundError>

    getSelf: (context: Types.Context) => Effect.Effect<User, UserNotFoundError>
    getById: (self: string) => Effect.Effect<User, UserNotFoundError>
  }
>() { }

export const UserServiceLive = Layer.succeed(
  UserService,
  UserService.of({
    add: (self: User) => {
      const validSelf = serializeUser(self)
      

      return Effect.tryPromise({
        try: () => Drizzle.insert(UserTable).values(validSelf).returning(),
        catch: () => new UserAlreadyExistsError()
      }).pipe(
        Effect.map(Array.unsafeGet(0)),
        Effect.andThen(() => Effect.promise(async () => {
          await Redis.hset(`user:${self.id}`, validSelf)
          await Redis.expire(`user:${self.id}`, 24 * 60 * 60)
        })),
        Effect.as(self)
      )
    },

    delete: (context: Types.Context) => Effect.tryPromise({
      try: () => Drizzle.delete(UserTable).where(eq(UserTable.id, context.from!.username!)).returning(),
      catch: () => new UserNotFoundError()
    }).pipe(
      Effect.filterOrFail(
        Array.isEmptyArray,
        () => new UserNotFoundError(),
      ),
      Effect.map(Array.unsafeGet(0)),
      Effect.map(deserializeUser)
    ),


    getSelf(context: Types.Context) {
      return this.getById(context.from!.username!);
    },

    getById: (self: string) => Effect.gen(function*(_) {
      
      const getFromDatabase = Effect.promise(() => Drizzle.query.UserTable.findFirst({
        where: (user, { eq }) => eq(user.id, self)
      })).pipe(
        Effect.filterOrFail(
          (user) => user !== undefined,
          () => new UserNotFoundError()
        ),
      )
      return yield* _(
        Boolean.match(
          yield* _(
            Effect.promise(() => Redis.exists(`user:${self}`)),
            Effect.map(h => h !== 0)
          ),
          {
            onTrue: () => Effect.promise(() => Redis.hgetall(`user:${self}`)),
            onFalse: () => getFromDatabase,
          }
        ),
        Effect.map(deserializeUser),
        Effect.flatMap(user => Effect.promise(
          async () => {
            await Redis.hset(`user:${self}`, serializeUser(user));
            await Redis.expire(`user:${self}`, 24 * 60 * 60)
            return user
          }
        )),
      )
    }),
  })
)
