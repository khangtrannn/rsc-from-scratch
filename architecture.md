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