import { Hono } from 'hono'
import { createConnectRouter } from '@connectrpc/connect'
import {
  universalServerRequestFromFetch,
  universalServerResponseToFetch,
} from '@connectrpc/connect/protocol'
import type { ConnectRouter, ConnectRouterOptions, ContextValues } from '@connectrpc/connect'
import type { Context } from 'hono'

export type ConnectrpcServerOptions = ConnectRouterOptions & {
  routes: (router: ConnectRouter) => void
  contextValues?: (c: Context) => ContextValues | Promise<ContextValues>
}

export function connectrpcServer(options: ConnectrpcServerOptions): Hono {
  const router = createConnectRouter(options)
  options.routes(router)

  const app = new Hono()

  for (const handler of router.handlers) {
    app.on(handler.allowedMethods, handler.requestPath, async (c) => {
      const contextValues = await options.contextValues?.(c)
      const uReq = universalServerRequestFromFetch(c.req.raw, {})
      uReq.contextValues = contextValues
      const uRes = await handler(uReq)
      return universalServerResponseToFetch(uRes)
    })
  }

  return app
}
