import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'src')
const output = join(root, 'dist')

if (!existsSync(join(source, 'index.html'))) {
  console.error('Build failed: src/index.html is missing.')
  process.exit(1)
}

rmSync(output, { recursive: true, force: true })
mkdirSync(output, { recursive: true })
cpSync(source, output, { recursive: true })

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

const files = walk(output)
const bytes = files.reduce((total, file) => total + statSync(file).size, 0)
if (!existsSync(join(output, 'index.html'))) {
  console.error('Build failed: dist/index.html was not produced.')
  process.exit(1)
}
console.log(`Built ${files.length} files (${(bytes / 1024).toFixed(1)} KiB) into ${output}`)
