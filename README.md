# hono-connectrpc

ConnectRPC integration for [Hono](https://hono.dev/).

```ts
import { Hono } from 'hono'
import { connectrpcServer } from 'hono-connectrpc'
import { ElizaService } from './gen/eliza_pb.js'

const app = new Hono()

app.route('/api', connectrpcServer({
  routes: (router) => {
    router.service(ElizaService, {
      say: (req) => ({ sentence: `You said: ${req.sentence}` }),
    })
  },
}))

export default app
```

## Install

```sh
bun add hono-connectrpc @connectrpc/connect hono
```

Requires `hono >= 4.0.0` and `@connectrpc/connect ^2.0.0`.

## Usage

`connectrpcServer` returns a `Hono` instance. Mount it anywhere with `app.route()` — Hono's router handles path matching and prefix stripping.

```ts
import { Hono } from 'hono'
import { connectrpcServer } from 'hono-connectrpc'
import { ElizaService } from './gen/eliza_pb.js'

const app = new Hono()

// root mount
app.route('/', connectrpcServer({
  routes: (router) => {
    router.service(ElizaService, {
      say: (req) => ({ sentence: `You said: ${req.sentence}` }),
    })
  },
}))
```

### Mounting under a prefix

```ts
app.route('/api', connectrpcServer({
  routes: (router) => {
    router.service(ElizaService, { /* ... */ })
  },
}))
// → routes at /api/package.Service/Method
```

### Context values

Pass data from the Hono context to ConnectRPC handlers via `contextValues`:

```ts
import { createContextKey, createContextValues } from '@connectrpc/connect'

const kAuth = createContextKey<string>('')

app.route('/', connectrpcServer({
  routes: (router) => {
    router.service(ElizaService, {
      say: (req, ctx) => ({
        sentence: `You said: ${req.sentence} (user: ${ctx.values.get(kAuth)})`,
      }),
    })
  },
  contextValues: (c) =>
    createContextValues().set(kAuth, c.req.header('X-User') ?? 'anonymous'),
}))
```
