```
RSC server
   ↓
Flight stream
   ↓
tee()
  /   \
 /     \
SSR     browser branch
 │          │
 │     readFlightChunks()
 │          │
 │     [c1,c2,c3,c4]
 │          │
HTML        │
stream      │
 ↓          │
browser     │
            ↓
     wait until complete
            ↓
<script>
 queue.push(c1)
 queue.push(c2)
 queue.push(c3)
 queue.push(c4)
 done
</script>
```

Browser-side Flight decoding/hydration cannot start until the complete Flight payload has been collected and injected.

```
Flight response
      ↓
     tee()
   /       \
ssrStream   browserStream
   ↓
createFromNodeStream()
   ↓
 model
```

---

# New Flow

```
Browser
   │
   │ GET /hello-world
   ▼
8080
   │
   │ fetch RSC from :8081
   ▼
Flight stream
   │
  tee()
 ┌─┴─────────────────┐
 │                   │
 ▼                   ▼
ssrStream       browserStream
 │                   │
 ▼                   │
Flight decoder        │
 │                   │
 ▼                   │
React model           │
 │                   │
 ▼                   │
SSR                   │
 │                   │
 ▼                   │
HTML stream           │
 │                   │
 │              store temporarily:
 │
 │             Map[flightId]
 │                   =
 │             browserStream
 │
 ▼
Browser receives:
HTML
+
/initial-flight?id=123
```

```
fetch(__INITIAL_FLIGHT_URL__)
          ↓
response.body
          ↓
chunk c1
          ↓
__FLIGHT_QUEUE__.push(c1)
          ↓
ReadableStream.enqueue(c1)
          ↓
Flight decoder
```