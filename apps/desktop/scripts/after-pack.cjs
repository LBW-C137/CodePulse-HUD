/**
 * Strip optional Electron binaries this Windows HUD does not need.
 *
 * IMPORTANT: Do NOT remove ffmpeg — Electron/Chromium links against it at
 * process start on Windows (missing ffmpeg.dll = hard launch failure).
 *
 * @param {import('electron-builder').AfterPackContext} context
 */
exports.default = async function afterPack(context) {
  const fs = require('node:fs')
  const path = require('node:path')

  const appOutDir = context.appOutDir
  const candidates = ['vk_swiftshader.dll', 'vk_swiftshader_icd.json', 'vulkan-1.dll']

  let removedBytes = 0
  for (const rel of candidates) {
    const full = path.isAbsolute(rel) ? rel : path.join(appOutDir, rel)
    try {
      const stat = fs.statSync(full)
      if (!stat.isFile()) continue
      fs.unlinkSync(full)
      removedBytes += stat.size
      console.log(`[after-pack] removed ${full} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`)
    } catch {
      // File may not exist on this arch / Electron version — ignore.
    }
  }

  if (removedBytes > 0) {
    console.log(`[after-pack] stripped ${(removedBytes / 1024 / 1024).toFixed(2)} MB total`)
  }
}
