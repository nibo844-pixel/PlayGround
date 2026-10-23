import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const port = Number(process.env.PORT || 3000)
const host = '0.0.0.0'
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
}

if (!existsSync(join(root, 'index.html'))) {
  console.error(`No built app found at ${root}. Run npm run build first.`)
  process.exit(1)
}

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', 'http://localhost')
  if (url.pathname === '/healthz') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    response.end('{"status":"ok"}')
    return
  }

  let pathname
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    response.writeHead(400).end('Bad request')
    return
  }

  let file = resolve(root, '.' + pathname)
  if (file !== root && !file.startsWith(root + sep)) {
    response.writeHead(404).end('Not found')
    return
  }

  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html')
  } catch {
    if (!extname(pathname)) file = join(root, 'index.html')
  }

  try {
    const info = statSync(file)
    if (!info.isFile()) throw new Error('not a file')
    const extension = extname(file).toLowerCase()
    response.writeHead(200, {
      'Content-Type': mime[extension] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin'
    })
    if (request.method === 'HEAD') {
      response.end()
      return
    }
    createReadStream(file).pipe(response)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found')
  }
})

server.listen(port, host, () => {
  console.log(`Mira is serving ${root} at http://${host}:${port}`)
})

function shutdown() {
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 3000).unref()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
