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