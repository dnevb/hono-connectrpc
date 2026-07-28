import { describe, it, expect } from 'bun:test'
import { Hono } from 'hono'
import { createContextValues, createContextKey } from '@connectrpc/connect'
import { create } from '@bufbuild/protobuf'
import type { HandlerContext } from '@connectrpc/connect'
import { connectrpcServer } from './index'
import { TestService, CallResponseSchema } from './gen/test/v1/test_pb'

describe('connectrpcServer', () => {
  it('returns a Hono instance', () => {
    const app = connectrpcServer({
      routes: (router) => {
        router.service(TestService, {
          call: (req) => create(CallResponseSchema, { data: req.data }),
        })
      },
    })
    expect(app).toBeInstanceOf(Hono)
  })

  it('handles POST requests', async () => {
    const app = connectrpcServer({
      routes: (router) => {
        router.service(TestService, {
          call: (req, _ctx) => create(CallResponseSchema, { data: `echo: ${req.data}` }),
        })
      },
    })

    const res = await app.request('http://localhost/test.v1.TestService/Call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'hello' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: 'echo: hello' })
  })

  it('handles GET requests for idempotent RPCs', async () => {
    const app = connectrpcServer({
      routes: (router) => {
        router.service(TestService, {
          call: (req, ctx) =>
            create(CallResponseSchema, {
              data: `method=${ctx.requestMethod} data=${req.data}`,
            }),
        })
      },
    })

    const res = await app.request(
      'http://localhost/test.v1.TestService/Call?connect=v1&encoding=json&message=%7B%22data%22%3A%22hello%22%7D',
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: 'method=GET data=hello' })
  })

  it('passes contextValues to handlers', async () => {
    const kAuth = createContextKey<string>('')
    const app = connectrpcServer({
      routes: (router) => {
        router.service(TestService, {
          call: (req, ctx: HandlerContext) =>
            create(CallResponseSchema, { data: `${req.data} ${ctx.values.get(kAuth)}` }),
        })
      },
      contextValues: () => createContextValues().set(kAuth, 'admin'),
    })

    const res = await app.request('http://localhost/test.v1.TestService/Call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'hello' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: 'hello admin' })
  })

  it('can be mounted with route()', async () => {
    const api = connectrpcServer({
      routes: (router) => {
        router.service(TestService, {
          call: (req) => create(CallResponseSchema, { data: req.data }),
        })
      },
    })

    const app = new Hono()
    app.route('/api', api)

    const res = await app.request('http://localhost/api/test.v1.TestService/Call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'mounted' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: 'mounted' })
  })

  it('returns 404 for paths not registered by ConnectRPC', async () => {
    const app = connectrpcServer({
      routes: (router) => {
        router.service(TestService, {
          call: (req) => create(CallResponseSchema, { data: req.data }),
        })
      },
    })

    const res = await app.request('/health')
    expect(res.status).toBe(404)
  })

  it('coexists with other Hono routes', async () => {
    const api = connectrpcServer({
      routes: (router) => {
        router.service(TestService, {
          call: (req) => create(CallResponseSchema, { data: req.data }),
        })
      },
    })

    const app = new Hono()
    app.route('/', api)
    app.get('/health', (c) => c.text('ok'))

    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })
})
