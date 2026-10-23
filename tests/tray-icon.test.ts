import assert from 'node:assert/strict'
import { inflateSync } from 'node:zlib'
import { test } from 'node:test'
import { trayIconPngFor } from '../apps/desktop/src/main/tray-icon-png.js'

test('tray icon renders a translucent HUD pane with a permanent orange signal', () => {
  const image = decodeRgbaPng(trayIconPngFor('idle', 32))
  const center = pixelAt(image, 16, 16)
  const corner = pixelAt(image, 0, 0)
  const visibleColors = new Set<string>()
  let orangePixels = 0
  let translucentPixels = 0

  for (let i = 0; i < image.rgba.length; i += 4) {
    const red = image.rgba[i]!
    const green = image.rgba[i + 1]!
    const blue = image.rgba[i + 2]!
    const alpha = image.rgba[i + 3]!
    if (alpha < 16) continue
    visibleColors.add(`${red},${green},${blue},${alpha}`)
    if (red > 220 && green >= 70 && green < 170 && blue < 90) orangePixels += 1
    if (alpha < 250) translucentPixels += 1
  }

  assert.equal(corner[3], 0)
  assert.ok(center[0] > 220)
  assert.ok(center[1] >= 70 && center[1] < 170)
  assert.ok(center[2] < 90)
  assert.ok(orangePixels > 30)
  assert.ok(translucentPixels > 300)
  assert.ok(visibleColors.size > 8)
})

test('tray attention state adds only a compact top-right badge', () => {
  const routine = decodeRgbaPng(trayIconPngFor('running', 32))
  const attention = decodeRgbaPng(trayIconPngFor('attention', 32))
  const routineBadgeCenter = pixelAt(routine, 24, 7)
  const attentionBadgeCenter = pixelAt(attention, 24, 7)
  let changedPixels = 0

  for (let i = 0; i < routine.rgba.length; i += 4) {
    if (!routine.rgba.subarray(i, i + 4).equals(attention.rgba.subarray(i, i + 4))) {
      changedPixels += 1
      const pixel = i / 4
      const x = pixel % routine.width
      const y = Math.floor(pixel / routine.width)
      assert.ok(x >= 19 && y <= 12)
    }
  }

  assert.ok(routineBadgeCenter[0] > 220 && routineBadgeCenter[1] > 220)
  assert.ok(attentionBadgeCenter[0] > 220)
  assert.ok(attentionBadgeCenter[1] < 170)
  assert.ok(changedPixels > 20 && changedPixels < 100)
})

interface DecodedPng {
  width: number
  height: number
  rgba: Buffer
}

function decodeRgbaPng(buffer: Buffer): DecodedPng {
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG')
  let offset = 8
  let width = 0
  let height = 0
  const idat: Buffer[] = []

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii')
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    offset += 12 + length
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      assert.equal(data[8], 8)
      assert.equal(data[9], 6)
    }
    if (type === 'IDAT') idat.push(data)
    if (type === 'IEND') break
  }

  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * 4
  const rgba = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++) {
    const rawRow = y * (stride + 1)
    assert.equal(raw[rawRow], 0)
    raw.copy(rgba, y * stride, rawRow + 1, rawRow + 1 + stride)
  }
  return { width, height, rgba }
}

function pixelAt(image: DecodedPng, x: number, y: number): [number, number, number, number] {
  const offset = (y * image.width + x) * 4
  return [
    image.rgba[offset]!,
    image.rgba[offset + 1]!,
    image.rgba[offset + 2]!,
    image.rgba[offset + 3]!,
  ]
}
