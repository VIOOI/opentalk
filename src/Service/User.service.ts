import { Array, Brand, Console, Data, Effect, Context as EffectContext, Layer, Ref } from "effect";
import { Drizzle } from "../Databases/Drizzle.js";
import { Redis } from "../Databases/Redis.js";
import { GrammyLive } from "../Grammy.js";
import { deserializeUser, serializeUser, User } from "../Models/User.model.js";
import { GC } from "../types.js";
import {
  UserAlreadyExistsError,
  UserNotFoundError,
} from "./Database.service.js";
import { UserTable } from "../Databases/User.table.js";
import { eq } from "drizzle-orm";

export class UserService extends EffectContext.Tag("UserService")<
  UserService,
  {
    registered: (self: User) => Effect.Effect<User, UserAlreadyExistsError>
    remove: (context: GC) => Effect.Effect<User, UserNotFoundError>
    // update: (that: Partial<User>) => Effect.Effect<User, UserNotFoundError>
    //
    getSelf: (context: GC) => Effect.Effect<User, UserNotFoundError>
    getById: (self: string) => Effect.Effect<User, UserNotFoundError>
    // isAuthorized: (context: GrammyContext) => Effect.Effect<boolean>;
  }
>() { }

export const UserServiceLive = Layer.succeed(
  UserService,
  UserService.of({
    getSelf: (context: GC) => Effect.gen(function*(_) {
      const localSelf = yield* Effect.promise(() => Redis.exists(`user:${context.from!.username!}`))
      if (localSelf !== 0) {
        return yield* Effect.promise(
          () => Redis.hgetall(`user:${context.from!.username!}`)
            .then(deserializeUser)
        );
      }
      return yield* _(
        Effect.promise(() => Drizzle.query.UserTable.findFirst({
          where: (user, { eq }) => eq(user.id, context.from!.username!)
        })),
        Effect.filterOrFail(
          (user) => user !== undefined,
          () => new UserNotFoundError()
        ),
        Effect.flatMap(user => Effect.promise(
          async () => {
            await Redis.hset(`user:${context.from!.username!}`, user);
            await Redis.expire(`user:${context.from!.username!}`, 24 * 60 * 60)
            return deserializeUser(user)
          }
        )),
      )

    }),
    getById: (self: string) => Effect.gen(function*(_) {
      const localSelf = yield* Effect.promise(() => Redis.exists(`user:${self}`))
      if (localSelf !== 0) {
        return yield* Effect.promise(
          () => Redis.hgetall(`user:${self}`)
            .then(deserializeUser)
        );
      }
      return yield* Effect.promise(
        () => Drizzle.query.UserTable.findFirst({
          where: (user, { eq }) => eq(user.id, self)
        })
      ).pipe(
        Effect.filterOrFail(
          (user) => user !== undefined,
          () => new UserNotFoundError()
        ),
        Effect.map(deserializeUser)
      );
    }),

    registered: (self: User) => Effect.tryPromise({
      try: () => Drizzle.insert(UserTable).values(serializeUser(self)).returning(),
      catch: () => new UserAlreadyExistsError()
    }).pipe(
      Effect.map(Array.unsafeGet(0)),
      Effect.andThen((user) => Effect.promise(async () => {
        await Redis.hset(`user:${self.id}`, user)
        await Redis.expire(`user:${self.id}`, 24 * 60 * 60)
      })),
      Effect.as(self)
    ),

    remove: (context: GC) => Effect.tryPromise({
      try: () => Drizzle.delete(UserTable).where(eq(UserTable.id, context.from!.username!)).returning(),
      catch: () => new UserNotFoundError()
    }).pipe(
      Effect.map(Array.unsafeGet(0)),
      Effect.map(deserializeUser)
    )
  }),
);
