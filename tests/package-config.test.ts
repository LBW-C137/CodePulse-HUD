import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

test('desktop installer has an independent Windows HUD identity', () => {
  const config = readFileSync('apps/desktop/electron-builder.yml', 'utf8')
  const desktopPackage = JSON.parse(readFileSync('apps/desktop/package.json', 'utf8')) as {
    name?: string
    version?: string
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const rootPackage = JSON.parse(readFileSync('package.json', 'utf8')) as {
    name?: string
    version?: string
    repository?: { url?: string }
  }
  const main = readFileSync('apps/desktop/src/main/index.ts', 'utf8')
  const updater = readFileSync('apps/desktop/src/main/update-checker.ts', 'utf8')
  const preload = readFileSync('apps/desktop/src/preload/index.ts', 'utf8')

  assert.equal(rootPackage.name, 'codepulse-hud')
  assert.equal(desktopPackage.name, '@codepulse-hud/desktop')
  assert.equal(desktopPackage.version, rootPackage.version)
  assert.match(String(rootPackage.repository?.url), /LBW-C137\/CodePulse-HUD/)
  assert.match(config, /^appId: io\.github\.lbwc137\.codepulsehud$/m)
  assert.match(config, /^productName: CodePulse HUD$/m)
  assert.match(config, /^compression: maximum$/m)
  assert.match(config, /^nativeRebuilder: legacy$/m)
  assert.match(config, /^electronLanguages:\n\s+- en-US\n\s+- zh-CN$/m)
  assert.match(config, /^afterPack: scripts\/after-pack\.cjs$/m)
  assert.match(
    config,
    /^\s+artifactName: CodePulse-HUD_\$\{version\}_\$\{arch\}-setup\.\$\{ext\}$/m,
  )
  assert.match(config, /^\s+- '\*\*\/\*\.node'$/m)
  assert.doesNotMatch(config, /^mac:$/m)
  assert.doesNotMatch(config, /^linux:$/m)
  assert.doesNotMatch(config, /better-sqlite3|drizzle-orm|@codepulse\/storage/)
  assert.deepEqual(Object.keys(desktopPackage.dependencies ?? {}).sort(), ['serialport'])
  assert.ok(desktopPackage.devDependencies?.['bonjour-service'])
  assert.ok(desktopPackage.devDependencies?.fastify)
  assert.equal(desktopPackage.devDependencies?.['drizzle-orm'], undefined)
  assert.equal(desktopPackage.devDependencies?.['@codepulse/storage'], undefined)
  assert.match(main, /app\.setName\('CodePulse HUD'\)/)
  assert.match(updater, /LBW-C137\/CodePulse-HUD\/releases\/latest/)
  assert.doesNotMatch(updater, /noeigenstate\/CodePulse/)
  assert.doesNotMatch(preload, /getStats|onOpenStats|codepulse:get-stats/)
  assert.equal(existsSync('apps/desktop/src/renderer/src/components/StatsDashboard.tsx'), false)
})

test('native dependency scripts target the Electron Windows runtime', () => {
  const desktopPackage = JSON.parse(readFileSync('apps/desktop/package.json', 'utf8')) as {
    scripts?: Record<string, string>
  }
  const rootPackage = JSON.parse(readFileSync('package.json', 'utf8')) as {
    scripts?: Record<string, string>
  }

  assert.equal(desktopPackage.scripts?.postinstall, undefined)
  assert.equal(desktopPackage.scripts?.['rebuild:electron'], 'electron-builder install-app-deps')
  assert.equal(desktopPackage.scripts?.predev, 'pnpm rebuild:electron')
  assert.equal(desktopPackage.scripts?.prestart, 'pnpm rebuild:electron')
  assert.match(String(desktopPackage.scripts?.dist ?? ''), /electron-builder --win/)
  assert.match(String(desktopPackage.scripts?.['dist:win'] ?? ''), /electron-builder --win/)
  assert.equal(desktopPackage.scripts?.['dist:linux'], undefined)
  assert.equal(desktopPackage.scripts?.['dist:mac'], undefined)
  assert.equal(rootPackage.scripts?.pretest, undefined)
  assert.equal(rootPackage.scripts?.['dist:win'], 'pnpm --filter @codepulse-hud/desktop dist:win')
  assert.equal(rootPackage.scripts?.['dist:linux'], undefined)
  assert.equal(rootPackage.scripts?.['dist:mac'], undefined)
})

test('release workflow verifies the project and publishes only a Windows installer', () => {
  const workflow = readFileSync('.github/workflows/release.yml', 'utf8')

  assert.match(workflow, /node: \[20, 22\]/)
  assert.match(workflow, /runs-on: windows-latest/)
  assert.match(workflow, /pnpm dist:win/)
  assert.match(workflow, /CodePulse-HUD_/)
  assert.doesNotMatch(workflow, /runs-on: macos-latest/)
  assert.doesNotMatch(workflow, /Build Linux AppImage|pnpm dist:linux|\.AppImage/)
  assert.doesNotMatch(workflow, /Build macOS installer|pnpm dist:mac|\.dmg/)
})
