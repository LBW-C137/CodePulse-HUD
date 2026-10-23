import { deflateSync } from 'node:zlib'
import type { AgentType, OverallState } from '@codepulse/shared'

export type TrayVisualTone = 'neutral' | 'attention'

const BRAND_ORANGE = [249, 115, 22] as const

const crcTable = buildCrcTable()

export function trayIconPngFor(state: OverallState, size = 32): Buffer {
  const [accentR, accentG, accentB] = trayVisualColorFor(state)
  const raw = Buffer.alloc(size * (size * 4 + 1))
  const cx = (size - 1) / 2
  const cy = (size - 1) / 2
  const half = size * 0.42
  const radius = size * 0.19
  const borderWidth = Math.max(1, size * 0.045)
  const showsAttentionBadge = trayVisualToneFor(state) === 'attention'
  let p = 0

  for (let y = 0; y < size; y++) {
    raw[p++] = 0
    for (let x = 0; x < size; x++) {
      const sampleX = x + 0.5
      const sampleY = y + 0.5
      const panelDistance = roundedRectDistance(sampleX, sampleY, cx, cy, half, half, radius)
      const panelCoverage = coverageFor(panelDistance)
      const innerDistance = roundedRectDistance(
        sampleX,
        sampleY,
        cx,
        cy,
        half - borderWidth,
        half - borderWidth,
        radius - borderWidth,
      )
      const borderCoverage = Math.max(0, panelCoverage - coverageFor(innerDistance))
      let rgba: [number, number, number, number] = [0, 0, 0, 0]

      if (panelCoverage > 0) {
        const verticalSheen = Math.max(0, 1 - sampleY / size)
        const base = Math.round(247 + verticalSheen * 8)
        rgba = [base, Math.min(255, base + 1), 255, Math.round(218 * panelCoverage)]
      }

      if (borderCoverage > 0) {
        rgba = blend(rgba, [accentR, accentG, accentB, Math.round(105 * borderCoverage)])
      }

      if (onPulsePath(sampleX, sampleY, size)) {
        rgba = blend(rgba, [255, 255, 255, 145])
        rgba = blend(rgba, [accentR, accentG, accentB, 255])
      }

      if (onHudCorner(sampleX, sampleY, size)) {
        rgba = blend(rgba, [accentR, accentG, accentB, 255])
      }

      if (showsAttentionBadge) {
        const badgeDistance = Math.hypot(sampleX - size * 0.77, sampleY - size * 0.23)
        if (badgeDistance <= size * 0.145) rgba = blend(rgba, [255, 255, 255, 245])
        if (badgeDistance <= size * 0.095) {
          rgba = blend(rgba, [accentR, accentG, accentB, 255])
        }
      }

      raw[p++] = rgba[0]
      raw[p++] = rgba[1]
      raw[p++] = rgba[2]
      raw[p++] = rgba[3]
    }
  }

  return buildPng(size, size, raw)
}

/** The tone controls the small attention badge; orange itself is permanent brand color. */
export function trayVisualToneFor(state: OverallState): TrayVisualTone {
  return state === 'idle' || state === 'running' ? 'neutral' : 'attention'
}

export function trayVisualColorFor(_state: OverallState): readonly [number, number, number] {
  return BRAND_ORANGE
}

/** Human-readable CLI name used by the tray's compact status rows. */
export function trayAgentNameFor(agentType: AgentType): string {
  if (agentType === 'codex') return 'Codex'
  if (agentType === 'grok') return 'Grok'
  if (agentType === 'kimi') return 'Kimi Code'
  return 'Claude Code'
}

function onPulsePath(x: number, y: number, size: number): boolean {
  const points = [
    [0.22, 0.56],
    [0.34, 0.56],
    [0.4, 0.43],
    [0.48, 0.7],
    [0.56, 0.28],
    [0.64, 0.56],
    [0.78, 0.56],
  ].map(([px, py]) => [px * size, py * size] as const)

  return points.some((point, index) => {
    const next = points[index + 1]
    return next
      ? distanceToSegment(x, y, point[0], point[1], next[0], next[1]) <= size * 0.044
      : false
  })
}

function onHudCorner(x: number, y: number, size: number): boolean {
  const stroke = size * 0.036
  const start = size * 0.19
  const end = size * 0.31
  const oppositeStart = size - start
  const oppositeEnd = size - end
  const topLeft =
    distanceToSegment(x, y, start, end, start, start) <= stroke ||
    distanceToSegment(x, y, start, start, end, start) <= stroke
  const bottomRight =
    distanceToSegment(x, y, oppositeStart, oppositeEnd, oppositeStart, oppositeStart) <= stroke ||
    distanceToSegment(x, y, oppositeStart, oppositeStart, oppositeEnd, oppositeStart) <= stroke
  return topLeft || bottomRight
}

function roundedRectDistance(
  x: number,
  y: number,
  cx: number,
  cy: number,
  halfWidth: number,
  halfHeight: number,
  radius: number,
): number {
  const safeRadius = Math.max(0, radius)
  const dx = Math.abs(x - cx) - (halfWidth - safeRadius)
  const dy = Math.abs(y - cy) - (halfHeight - safeRadius)
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - safeRadius
}

function coverageFor(distance: number): number {
  return Math.max(0, Math.min(1, 0.5 - distance))
}

function distanceToSegment(
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSquared = dx * dx + dy * dy
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared))
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}

function blend(
  bottom: [number, number, number, number],
  top: [number, number, number, number],
): [number, number, number, number] {
  const topAlpha = top[3] / 255
  const bottomAlpha = bottom[3] / 255
  const outAlpha = topAlpha + bottomAlpha * (1 - topAlpha)
  if (outAlpha <= 0) return [0, 0, 0, 0]
  return [
    Math.round((top[0] * topAlpha + bottom[0] * bottomAlpha * (1 - topAlpha)) / outAlpha),
    Math.round((top[1] * topAlpha + bottom[1] * bottomAlpha * (1 - topAlpha)) / outAlpha),
    Math.round((top[2] * topAlpha + bottom[2] * bottomAlpha * (1 - topAlpha)) / outAlpha),
    Math.round(outAlpha * 255),
  ]
}

function buildPng(width: number, height: number, raw: Buffer): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0)
  return Buffer.concat([length, typeBuf, data, crcBuf])
}

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
