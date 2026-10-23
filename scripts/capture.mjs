import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const runtime = join(process.env.HOME, '.local/share/omgithub-playwright')
const url = process.env.CAPTURE_URL
const outputDirectory = process.env.CAPTURE_DIR

if (!url) throw new Error('CAPTURE_URL is required.')
if (!outputDirectory) throw new Error('CAPTURE_DIR is required.')
mkdirSync(outputDirectory, { recursive: true })

function loadPlaywright() {
  const candidates = [join(runtime, 'package.json'), import.meta.url]
  for (const base of candidates) {
    try {
      const require = createRequire(base)
      return require('playwright')
    } catch (error) {
      if (base === candidates[candidates.length - 1]) throw error
    }
  }
}
function timing(label, started) {
  console.log(`[timing] ${label}: ${(performance.now() - started).toFixed(0)}ms`)
}
function temporary(error) {
  const wrapped = error instanceof Error ? error : new Error(String(error))
  wrapped.exitCode = 75
  return wrapped
}

const playwright = loadPlaywright()
const configPath = join(runtime, process.platform === 'darwin' ? 'metal.json' : 'linux.json')
let launchOptions = { headless: true }
if (existsSync(configPath)) {
  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  launchOptions = { ...(config.browser?.launchOptions || {}), ...launchOptions }
}
if (process.platform === 'linux') {
  try {
    process.env.DISPLAY ||= ':' + readFileSync(join(runtime, 'display'), 'utf8').trim()
  } catch {}
}

const views = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
]
const files = []
let browser

try {
  let started = performance.now()
  browser = await playwright.chromium.launch({ ...launchOptions, timeout: 30000 }).catch(error => { throw temporary(error) })
  timing('launch browser', started)

  for (const view of views) {
    started = performance.now()
    const page = await browser.newPage({
      viewport: { width: view.width, height: view.height },
      deviceScaleFactor: 1
    }).catch(error => { throw temporary(error) })
    page.setDefaultTimeout(30000)
    page.on('pageerror', error => console.error(`[browser] ${view.name}: ${error.message}`))
    page.on('console', message => {
      if (message.type() === 'error') console.error(`[browser] ${view.name} console: ${message.text()}`)
    })

    let response
    try {
      response = await page.goto(url, { waitUntil: 'load', timeout: 45000 })
    } catch (error) {
      throw temporary(error)
    }
    if (!response || !response.ok()) {
      const status = response?.status()
      const error = new Error(`Preview returned HTTP ${status ?? 'unknown'} for ${url}`)
      error.exitCode = !status || [408, 429, 500, 502, 503, 504].includes(status) ? 75 : 1
      throw error
    }

    try {
      await page.waitForFunction(() => document.body?.dataset.appReady === 'true', null, { timeout: 20000 })
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(500)
    } catch (error) {
      const defect = new Error(`Rendered content did not become ready in the ${view.name} view: ${error.message}`)
      defect.exitCode = 1
      throw defect
    }

    const file = resolve(outputDirectory, `final-${view.name}.png`)
    try {
      await page.screenshot({ path: file, fullPage: false, animations: 'disabled', caret: 'hide', timeout: 30000 })
    } catch (error) {
      throw temporary(error)
    }
    files.push(file)
    timing(`capture ${view.name}`, started)
    await page.close().catch(() => {})
  }
} catch (error) {
  console.error(error)
  process.exitCode = error.exitCode || 1
} finally {
  if (browser) {
    const started = performance.now()
    await browser.close().catch(error => {
      console.error(error)
      process.exitCode ||= 75
    })
    timing('close browser', started)
  }
}

if (!process.exitCode) {
  for (const file of files) console.log(`[capture] saved ${file}`)
}
