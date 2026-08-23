# Why Input State Is Lost on the First Navigation

## Initial state

The server renders HTML, so the browser creates the `<input>` DOM node. However,
the client hydrates with `null`:

```js
const root = hydrateRoot(document, null);
```

After typing `"Hello World"`, the two sides look like this:

```text
Browser DOM: <input value="Hello World">
React tree:  null
```

The value exists only in the live DOM node. React does not have a matching Fiber
tree for the server-rendered DOM.

## First navigation: the value is lost

Here, **first navigation** means the first call to `root.render()` after a full
page load or reload—not the initial page load itself.

Navigation fetches the new client JSX and calls:

```js
root.render(newClientJSX);
```

React transitions from `null` to the new JSX tree. Because it was not given the
initial JSX during hydration, it cannot properly reconcile the new tree with the
existing SSR DOM. The old input is replaced:

```text
Old node: <input value="Hello World">  // removed
New node: <input value="">             // created
```

The value is lost because it belonged to the old DOM node.

## Later navigations: the value is preserved

After the first render, React has a complete Fiber tree. On later navigations,
React reconciles the current tree with the new client JSX.

If the input has the same type, key, and position, React reuses its existing DOM
node:

```text
Current <input> -> New <input> -> Reuse the same DOM node
```

Because the node is reused, browser-managed state such as `input.value` remains.

## Reproduction

```text
Reload Home
-> Type "First"
-> Navigate to a post
-> Value is lost

Type "Second"
-> Navigate back Home
-> Value is preserved

Navigate to another post
-> Value is still preserved
```

Reloading creates a new React root, so the behavior starts over.

## Proper fix

Send the initial client JSX with the server-rendered HTML and hydrate with it:

```js
const initialJSX = getInitialClientJSX();
const root = hydrateRoot(document, initialJSX);
```

React can then attach its Fiber tree to the existing SSR DOM from the beginning.
The first navigation can reconcile the trees and reuse the original input node.

## Mental model

```text
hydrateRoot(document, null)
-> React does not know the initial SSR tree
-> First render replaces the input
-> DOM state is lost

hydrateRoot(document, initialJSX)
-> React attaches to the initial SSR DOM
-> Navigation reconciles the trees
-> The input DOM node is reused
-> DOM state is preserved
```

> React preserves state by preserving node identity—not by copying its value.
