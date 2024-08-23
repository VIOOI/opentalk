import { bold, fmt } from "@grammyjs/parse-mode";
import {
// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
	Array, Number,
	Console,
	Effect,
	Match,
	Option,
} from "effect";
import { GenderKeyboard } from "../Keyboards/GenderKeyboard.js";
import { MainMenu } from "../Keyboards/MainKeyboard.js";
import { SkipKeyboard } from "../Keyboards/SkipKeyboard.js";
import { UserService, UserServiceLive } from "../Services/User.js";
import { safeReply } from "../Shared/safeSend.js";
import * as Types from "../Types.js";
import { TagsKeyboard } from "../Keyboards/TagsKeyboard.js";
import {
	isValidateTags,
	User,
} from "../Schemas/User.js";

export const toStartNotAuth = (
	conversation: Types.Conversation,
	context: Types.Context,
) =>
	Effect.gen(function* (_) {
		yield* safeReply(
			context,
			`Для начала общения вы должны  зарегестрироваться. @opentalkru`,
		);

		const name = yield* Effect.gen(function* (_) {
			yield* safeReply(context, `Как вас зовут?`, {
				reply_markup: SkipKeyboard,
			});
			return yield* _(
				Effect.promise(() => conversation.waitFor("message:text")),
				Effect.flatMap(({ message }) =>
					Effect.if(message.text === "Пропустить", {
						onTrue: () =>
							Effect.succeed(context.from?.username || "Пользователь"),
						onFalse: () => Effect.succeed(message.text),
					}),
				),
			);
		});

		const age = yield* Effect.iterate(
			[Option.none(), true] as [Option.Option<number>, boolean],
			{
				while: state => Option.isNone(state[0]),
				body: ([_, isFirst]) =>
					Effect.gen(function* (_) {
						if (isFirst) yield* safeReply(context, "Сколько вам лет?");
						else yield* safeReply(context, "Вы должны ввести число от 1 до 99");

						return yield* _(
							Effect.promise(() => conversation.waitFor("message:text")),
							Effect.map(({ message }) => Number.parse(message.text)),
							Effect.map(Option.filter(state => state > 0 && state < 100)),
							Effect.map(
								option => [option, false] as [Option.Option<number>, boolean],
							),
						);
					}),
			},
		).pipe(Effect.map(state => Option.getOrElse(state[0], () => 18)));

		const gender = yield* Effect.iterate(
			[Option.none(), true] as [
				Option.Option<"men" | "women" | "any">,
				boolean,
			],
			{
				while: state => Option.isNone(state[0]),
				body: ([_, isFirst]) =>
					Effect.gen(function* (_) {
						if (isFirst)
							yield* safeReply(context, "Какого вы пола?", {
								reply_markup: GenderKeyboard,
							});
						else
							yield* safeReply(context, "Вы должны выбрать одну из кнопок", {
								reply_markup: GenderKeyboard,
							});
						return yield* _(
							Effect.promise(() => conversation.waitFor("message:text")),
							Effect.map(m => m.message.text),
							Effect.map(
								Match.type<string>().pipe(
									Match.when("Мужчина 👨", () => Option.some("men")),
									Match.when("Женщина 👩", () => Option.some("women")),
									Match.when("Другие 👽", () => Option.some("any")),
									Match.orElse(() => Option.none<string>()),
								),
							),
							Effect.map(
								option =>
									[option, false] as [
										Option.Option<"men" | "women" | "any">,
										boolean,
									],
							),
						);
					}),
			},
		).pipe(
			Effect.map(state => Option.getOrElse(state[0], () => "any" as const)),
		);

		const description = yield* Effect.gen(function* (_) {
			yield* safeReply(context, `Напишите немного о себе`, {
				reply_markup: SkipKeyboard,
			});
			return yield* _(
				Effect.promise(() => conversation.waitFor("message:text")),
				Effect.flatMap(({ message }) =>
					Effect.if(message.text === "Пропустить", {
						onTrue: () => Effect.succeed(""),
						onFalse: () => Effect.succeed(message.text),
					}),
				),
			);
		});

		const tags = yield* Effect.iterate(
			[Option.none(), true] as [Option.Option<User["tags"]>, boolean],
			{
				while: state => Option.isNone(state[0]),
				body: ([_, isFirst]) =>
					Effect.gen(function* (_) {
						if (isFirst)
							yield* safeReply(
								context,
								`Выберите интересы для поиска, по ним мы будем искать для вас собеседника и по ним будут искать вас. 

Так же вы можете написать теги (они пишутся через пробел без запятых) для сужения поиска собеседника, чтобы мы общались с наиболее подходящим собеседником.
Подробнее о том как писать более сложные теги вы можете прочитать в нашем [посте](https://t.me/opentalkru/22)

Теги пишутся черезер пробел, например: !аниме игры:5 -фильмы книги`,
								{
									reply_markup: TagsKeyboard,
									parse_mode: "Markdown",
								},
							);
						else
							yield* safeReply(
								context,
								"Вы ввели теги не правильно, прочтитайте пожалуйста пост и попробуйте снова",
								{ reply_markup: SkipKeyboard },
							);
						return yield* _(
							Effect.promise(() => conversation.waitFor("message:text")),
							Effect.andThen(({ message }) =>
								Effect.if(message.text === "Пропустить", {
									onTrue: () => Effect.succeed(Option.some<User["tags"]>([])),
									onFalse: () =>
										Effect.succeed(
											isValidateTags(message.text).pipe(
												Option.map(Array.filter(state => state.name !== "")),
												Option.filter(state => state.length > 0),
											),
										),
								}),
							),
							Effect.tap(Console.log),
							Effect.map(
								option =>
									[option, false] as [Option.Option<User["tags"]>, boolean],
							),
						);
					}),
			},
		).pipe(
			Effect.map(state => Option.getOrElse(state[0], () => [] as User["tags"])),
		);

		yield* UserService.pipe(
			Effect.andThen(service =>
				service.add({
					username: context.from!.username!,
					chat: context.chat!.id.toString(),
					name,
					age,
					gender,
					description,
					tags,
					rating: [0, 0],
				}),
			),
			Effect.andThen(user =>
				safeReply(
					context,
					`Теперь вы зарегестрированы, добро пожаловать ${user.name}`,
					{ reply_markup: MainMenu },
				),
			),
		);
	}).pipe(
		Effect.provide(UserServiceLive),
		Effect.catchTags({
			ForbiddenError: () =>
				Console.log(`${context.from?.username} заблокировал бота`),
		}),
		Effect.runPromise,
	);

export const toStartAuth = (context: Types.Context) =>
	Effect.gen(function* () {
		const user = yield* UserService.pipe(
			Effect.andThen(User => User.getSelf(context)),
		);

		yield* safeReply(context, `Добро пожаловать ${user.name}`, {
			reply_markup: MainMenu,
		});
	}).pipe(
		Effect.provide(UserServiceLive),
		Effect.catchTags({
			ForbiddenError: () =>
				Console.log(`${context.from?.username} заблокировал бота`),
			UserNotFoundError: () =>
				Console.error(`${context.from?.username} не найден`),
		}),
		Effect.runPromise,
	);

export const toStartInConnection = async (context: Types.Context) =>
	safeReply(
		context,
		"У вас есть собеседник, для начала закончите диалог с ним",
	).pipe(
		Effect.catchTags({
			ForbiddenError: () =>
				Console.log(`${context.from?.username} заблокировал бота`),
		}),
		Effect.runPromise,
	);

export const toStartInQueue = async (context: Types.Context) =>
	safeReply(
		context,
		"Вы находитесь в поиске, для начала остановите поиск собеседника stop",
	).pipe(
		Effect.catchTags({
			ForbiddenError: () =>
				Console.log(`${context.from?.username} заблокировал бота`),
		}),
		Effect.runPromise,
	);
