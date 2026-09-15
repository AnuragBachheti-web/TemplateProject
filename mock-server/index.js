// The entrypoint: build the store from the canonical seed, bind a socket, serve.
//
// Kept separate from app.js so that tests (and any future embedding) can mount the request handler
// without binding a port, and so this file stays small enough to read as the deployment contract it
// is: PORT from the environment, host 0.0.0.0, graceful shutdown on SIGTERM.
//
//   npm run mock-api

import http from 'node:http'

import { createRequestHandler } from './app.js'
import { createStore } from './store.js'

// Render injects PORT and routes external traffic to it. 3001 is the local default, chosen to stay
// clear of Vite's 5173.
const PORT = Number(process.env.PORT) || 3001
// 0.0.0.0, not localhost: a container's health check and its router reach the process from outside
// its own loopback, so binding to 127.0.0.1 makes the service unreachable on any host platform.
const HOST = '0.0.0.0'

const store = createStore()
const server = http.createServer(createRequestHandler({ store }))

server.listen(PORT, HOST, () => {
  console.log(`[mock-server] action-stories mock API listening on http://${HOST}:${PORT}`)
  console.log(`[mock-server] serving ${store.proposals.size} Decision Objects from the normalized corpus`)
  console.log('[mock-server]   GET  /health')
  console.log('[mock-server]   GET  /v1/proposals')
  console.log('[mock-server]   GET  /v1/proposals/:proposal_id')
  console.log('[mock-server]   POST /v1/proposals/:proposal_id/actions')
})

// Render sends SIGTERM on deploy and on spin-down. Closing the server lets in-flight requests
// finish instead of having their connections cut mid-response.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`[mock-server] ${signal} received, shutting down`)
    server.close(() => process.exit(0))
  })
}
