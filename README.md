This library is for slots in ReactJS

## Define slots in a component

To define slots in a component, the function

```tsx
import * as S from "@namelessdev/slots";
const { SlotOne, SlotTwo, Default } = S.retrive(children, "slot_one", {
	name: "slot_two", // Slot name
	filter: ..., // Filter for what items can go in the slot
	overreding: ..., // Overwrite props elements
})
```

It takes a component children as the first argument and an unlimited number of arguments that are slot settings. Returns an object with slot components with the same names as the slot settings, only in `PascalCase` `slot_name → SlotName` and so slot `Default`, these are items that did not fall into any slot. The slot name must be strictly in `snake_case`. If you if you write settings for the `default` slot, they will apply to items that are not in any slot.

Slot settings can be of two types.

1. `string` - slot name
2. `SlotInfo` - slot settings

   ```tsx
   type SlotInfo<N extends string> = {
     name: N;
     filter?: FilterSlot;
     overreding?: OverredingSlot;
   };
   type FilterSlot = (children: React.ReactNode) => boolean;
   type OverredingSlot = (
     props: Record<string, unknown>,
   ) => Record<string, unknown>;
   ```

   The slot filter takes a `ReactNode` element and returns boolean, if the value is `false` then this element will not go into a slot in the component. You can do anything you want in this function, you can even filter by props using zod.

   Overreding is used to overwrite the props. This function takes the props of a component and returns the modified props.

### Create slot settings

There is a create function that helps to create slot settings, it takes a slot name and a settings object

```ts
interface ConfigSlot {
  filter?: FilterSlot,
  overreding?: OverredingSlot,
}

export const create = <const N extends string>(name: N, config?: ConfigSlot): SlotInfo<N> => ({
  name,
  filter: config && config.filter,
  overreding: config && config.overreding
})

const SlotImage = create("image", {
	filter: ...
	overreding: ...
})
const SlotTitle = create("title")
```

## Using Slots

Once you have defined slots, you can use them in your markup

```tsx
return (
	<div>
		<SlotOne />
		<section>
			<SlotTwo>
			 This text will be displayed if this slot has not been transferred
			</SlotTwo>
		</section>
		<Default />
	<div>
)
```

## Slot transfer

There are three ways to transfer slots to a component

### 1 way

You can use the slot attribute to write the name of the slot you want to put this item in

```tsx
<ComponentWithSlot>
	<h1 slot="slot_one">Hello</h1>
	<p slot="slot_two">World</p>
	Element in Default slot
<ComponentWithSlot>
```

### 2 way

You can wrap items that you want to be part of a slot with the `<slot>` tag and give it a name. This is useful when the slot part is plain text.

```tsx
<ComponentWithSlot>
	<slot name="slot_one">
		<h1>Hello</h1>
		<p>World</p>
	</slot>
	<slot name="slot_two">This is Primitive</slot>
	Element in Default slot
<ComponentWithSlot>
```

### 3 way

You can create components that will be slots. Two functions `S.slot` and `S.wrap` are used for this purpose

`S.slot` creates a simple component that says the children are slot elements. It takes the name of the slot

```tsx
import type { Slot } from "@namelessdev/slots";

type ComponentWithSlot = FC<{
  children: ReactNode;
}> & {
  SlotOne: Slot<"slot_one", /* you can specify the type that this slot should accept */>;
};

ComponentWithSlot.SlotOne = S.slot("slot_one")

<ComponentWithSlot>
	<ComponentWithSlot.SlotOne>
		Hello
	<ComponentWithSlot.SlotOne>
<ComponentWithSlot>
```

`S.wrap` creates a wrapper component. If you only need an image in a slot, you can create a wrapper component that not only says that it is a slot, but also accepts all the props of the Image component or any other component you pass to it

```tsx
import type { Wrapper } from "@namelessdev/slots";
type ComponentWithSlot = FC<{
  children: ReactNode;
}> & {
  Image: SlotWrap<
    "image",
    typeof LazyLoadImage /* you can specify the type that this slot should accept */
  >;
};

ComponentWithSlot.Image = S.wrapper("image", LazyLoadImage);

<ComponentWithSlot.Image src="link/to/image.png" alt="" />;
```

## Example of use

```tsx
import * as S from "@namelessdev/slots";
import type { Slot, SlotWrap } from "@namelessdev/slots";

type ButtonComponent = FC<{
  children: ReactNode;
}> & {
  Title: S.Slot<"title">;
  Image: S.SlotWrap<"image", "img">;
};

const sdefault = S.settings("default", {
  filter: (element) => !isValidElement(element),
  overreding: (props) =>
    Object.assign({}, props, {
      className: `${props.className} mb-3 font-normal text-gray-700 dark:text-gray-400`,
    }),
});

const simage = S.settings("image");

export const Card: ButtonComponent = ({ children }) => {
  const { Default, Title, Image } = S.retrive(
    children,
    "title",
    simage,
    sdefault,
  );

  return (
    <Box className="flex flex-col items-center bg-white rounded-lg border border-gray-200 shadow md:flex-row md:max-w-xl dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700">
      <Image />
      <Box className="flex flex-col justify-between p-4 leading-normal">
        <h5 className="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          <Title />
        </h5>
        <Default />
      </Box>
    </Box>
  );
};

Card.Title = S.slot("title");
Card.Image = S.wrap("image", "img");
```
