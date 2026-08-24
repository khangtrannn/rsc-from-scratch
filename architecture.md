A global Flight queue bridges server-generated inline scripts and the client Flight ReadableStream. Before the client runtime loads, it buffers chunks. After bootstrap, its push() method becomes a live sink that feeds new chunks directly into the Flight decoder.

```
before client:
push → buffer

after client:
push → ReadableStream → Flight decoder
```

---

Initial navigation and client navigation originate from the same RSC server. The difference is who consumes the Flight output: initial navigation sends it through an SSR renderer and also gives it to the browser for hydration, while client navigation sends Flight directly to the existing browser React runtime.

Same RSC producers.

Initial:
Flight -> SSR + hydration

Navigation:
Flight -> client reconciliation

## Initial load

```
GET /hello-world
        ↓
8080 Public/SSR server
        ↓
GET 8081/rsc?url=/hello-world
        ↓
Server Components execute
        ↓
Flight
      /      \
     /        \
SSR branch   browser branch
    ↓             ↓
React model      Flight
    ↓             ↓
HTML             embedded
     \            /
      \          /
       document
          ↓
       Browser
          ↓
      hydrateRoot
```

## Client navigation

```
/
↓ click

/hello-world
      ↓
GET /rsc?url=/hello-world
      ↓
Flight only
      ↓
createFromFetch()
      ↓
root.render()
```

---

The RSC server executes Server Components and serializes their rendered result into Flight. A consumer uses an RSC client decoder such as createFromNodeStream() to turn Flight back into a React model. SSR is one such consumer: after decoding Flight, it passes that React model to react-dom/server to produce HTML.

```
8081
────────────────────
React Server condition

Server Components
Flight encoder


8080
────────────────────
Normal React condition

Flight decoder
react-dom/server
HTML
```

```
8081 = RSC producer
       Server Components → Flight

8080 = public gateway
       currently only forwards Flight

Browser = RSC consumer
          Flight → React model
```

8081 produces React Server output. 8080 must behave as a React Client of that output, so it should use normal React rather than the react-server condition.

---

```
8081 — React Server
────────────────────────────

<Router />
   ↓
execute Server Components
   ↓
renderToPipeableStream()
   ↓
FLIGHT


             │
             ▼


8080 — SSR environment
────────────────────────────

createFromNodeStream()
   ↓
REACT MODEL
   ↓
react-dom/server        ← NEXT STEP
   ↓
HTML

             │
             ▼

Browser
```


```
Browser navigation:

Flight
 ↓
createFromFetch()
 ↓
React model
 ↓
react-dom/client

---

Initial SSR:

Flight
 ↓
createFromNodeStream()
 ↓
React model
 ↓
react-dom/server
```

```
                    Flight
                      │
              ┌───────┴────────┐
              │                │
              ▼                ▼
createFromNodeStream()    createFromFetch()
              │                │
              └───────┬────────┘
                      ▼
                 React model
                  /         \
                 /           \
        react-dom/server   react-dom/client
              │                │
              ▼                ▼
             HTML             DOM
```

```
SERVER ENCODE

React model
   ↓
react-server-dom-webpack/server
renderToPipeableStream()
   ↓
Flight


NODE DECODE

Flight
   ↓
react-server-dom-webpack/client.node
createFromNodeStream()
   ↓
React model


BROWSER DECODE

Flight
   ↓
react-server-dom-webpack/client
createFromFetch()
   ↓
React model
```

```
                 8081 — RSC SERVER

                <Router />
                    │
                    ▼
 react-server-dom-webpack/server
       renderToPipeableStream()
                    │
                    ▼
               FLIGHT STREAM
                    │
                    │ HTTP
                    ▼


                 8080 — SSR SERVER

          createFromNodeStream()
                    │
                    ▼
               React model
                    │
                    ▼
             react-dom/server
       renderToPipeableStream()
                    │
                    ▼
                HTML STREAM
                    │
                    ▼
                 Browser
```

Flight is the wire format. renderToPipeableStream() is the Flight encoder, while createFromNodeStream() is a Node-side Flight decoder. The decoder reconstructs a React model, which can then be handed to another React renderer such as react-dom/server for SSR.