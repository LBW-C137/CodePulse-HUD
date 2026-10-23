/**
 * Render the canonical SVG brand asset to the PNG consumed by Electron Builder.
 *
 * Usage: node scripts/generate-app-icon.mjs
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'apps/desktop/src/renderer/src/assets/codepulse-icon.svg')
const destination = resolve(root, 'apps/desktop/build/icon.png')
const browserCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)

const browser = browserCandidates.find((candidate) => existsSync(candidate))
if (!browser) {
  console.error('Chrome/Edge not found. Set CHROME_PATH and retry.')
  process.exit(1)
}

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'codepulse-hud-icon-'))
const temporaryPng = resolve(temporaryDirectory, 'icon.png')

try {
  const result = spawnSync(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--default-background-color=00000000',
      '--window-size=1024,1024',
      `--screenshot=${temporaryPng}`,
      pathToFileURL(source).href,
    ],
    { stdio: 'inherit' },
  )
  if (result.status !== 0 || !existsSync(temporaryPng)) {
    console.error('Failed to render the CodePulse HUD app icon.')
    process.exit(result.status ?? 1)
  }

  const png = readFileSync(temporaryPng)
  if (png.readUInt32BE(16) !== 1024 || png.readUInt32BE(20) !== 1024) {
    console.error('The generated icon is not 1024 × 1024 pixels.')
    process.exit(1)
  }

  mkdirSync(dirname(destination), { recursive: true })
  copyFileSync(temporaryPng, destination)
  console.log(`Generated ${destination}`)
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}
