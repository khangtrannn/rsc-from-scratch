renderToPipeableStream() encodes the server-rendered React model into Flight, and createFromFetch() is the other half of that protocol: it incrementally decodes the Flight response back into a React model that React DOM can render.

```
Server:
React tree → Flight encoder → network

Browser:
network → Flight decoder → React tree

Flight streaming
= data/model can arrive progressively

Suspense
= UI can reveal progressively
```

Flight is not a serialized snapshot of a fully completed React tree. It is a streamed graph of React model chunks. Ready parts can be sent immediately, while unresolved async parts are represented by references such as $L10 and fulfilled by later chunks. Suspense does not create the Flight stream; it defines UI boundaries for how pending streamed data should be revealed.

Flight streaming and UI streaming are different layers. Flight can send a partially resolved React model immediately, but without a Suspense boundary React cannot reveal the pending tree incrementally, so it keeps the previous committed UI until the suspended work resolves.

Suspense boundary placement determines the granularity of UI streaming.

Suspense boundary placement controls the granularity of what React has to replace with a fallback. React reconciliation can preserve unchanged surrounding UI even though the server still sent a new representation of the whole RSC tree.

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

---

Next.js App Router

4. Router-level partial RSC transport
   → don't resend shared layout at all

Our current implementation preserves the layout because React reconciles the newly received full RSC tree against the existing tree and reuses compatible fibers/DOM nodes. It is not yet Next-style shared-layout routing—the server still sends the layout again.

---

8081 — React Server
--conditions react-server

<Router />
   ↓
Server Components execute
   ↓
renderToPipeableStream()
   ↓
Flight ✅