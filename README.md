Flight is not a serialized snapshot of a fully completed React tree. It is a streamed graph of React model chunks. Ready parts can be sent immediately, while unresolved async parts are represented by references such as $L10 and fulfilled by later chunks. Suspense does not create the Flight stream; it defines UI boundaries for how pending streamed data should be revealed.

```
Flight =
streamed React model graph

Ready subtree
→ send now

Async subtree
→ send reference now
→ send its chunk later

Suspense
→ controls UI reveal/fallback,
not the existence of streaming
```

---

```
click /hello-world
      ↓
navigate("/hello-world")
      ↓
fetchClientJSX()
      ↓
fetch("/rsc?url=/hello-world")
      ↓
Flight bytes
      ↓
createFromFetch()
      ↓
React model
      ↓
await
      ↓
root.render(...)
```

# Webpack

```
client.js
   │
   │ Webpack starts here
   ▼
dependency graph
   │
   ├── react
   ├── react-dom/client
   └── react-server-dom-webpack/client
              │
              ▼
        browser binding
              │
              ▼
         Webpack runtime
              │
              ▼
dist/client.js
```