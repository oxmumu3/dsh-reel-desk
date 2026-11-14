// Zero-dependency image magic-byte validator & dimension parser (PNG / JPEG / WebP / GIF).

import crypto from 'node:crypto'

export const MAX_UPLOAD_ASSET_BYTES = 10 * 1024 * 1024 // 10 MB

export function inspectImageBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 8) {
    return null
  }

  // 1. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    let width = 1600
    let height = 1000
    if (buf.length >= 24 && buf.toString('ascii', 12, 16) === 'IHDR') {
      const w = buf.readUInt32BE(16)
      const h = buf.readUInt32BE(20)
      if (w > 0 && h > 0) {
        width = w
        height = h
      }
    }
    return { format: 'png', ext: '.png', mime: 'image/png', width, height }
  }

  // 2. GIF: GIF87a / GIF89a
  if (
    buf.length >= 10 &&
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    const width = buf.readUInt16LE(6) || 1600
    const height = buf.readUInt16LE(8) || 1000
    return { format: 'gif', ext: '.gif', mime: 'image/gif', width, height }
  }

  // 3. JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    let width = 1600
    let height = 1000
    let offset = 2
    while (offset + 8 < buf.length) {
      if (buf[offset] !== 0xff) {
        offset++
        continue
      }
      let marker = buf[offset + 1]
      while (marker === 0xff && offset + 2 < buf.length) {
        offset++
        marker = buf[offset + 1]
      }
      if (marker === 0xd9 || marker === 0xda) break
      if (offset + 4 >= buf.length) break
      const segLen = buf.readUInt16BE(offset + 2)
      if (segLen < 2) break
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      if (isSof && offset + 9 <= buf.length) {
        const h = buf.readUInt16BE(offset + 5)
        const w = buf.readUInt16BE(offset + 7)
        if (w > 0 && h > 0) {
          width = w
          height = h
        }
        break
      }
      offset += 2 + segLen
    }
    return { format: 'jpg', ext: '.jpg', mime: 'image/jpeg', width, height }
  }

  // 4. WebP: RIFF....WEBP
  if (
    buf.length >= 16 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    let width = 1600
    let height = 1000
    const chunk = buf.toString('ascii', 12, 16)
    if (chunk === 'VP8X' && buf.length >= 30) {
      width = 1 + buf.readUIntLE(24, 3)
      height = 1 + buf.readUIntLE(27, 3)
    } else if (chunk === 'VP8 ' && buf.length >= 30) {
      width = buf.readUInt16LE(26) & 0x3fff
      height = buf.readUInt16LE(28) & 0x3fff
    } else if (chunk === 'VP8L' && buf.length >= 25) {
      const bits = buf.readUInt32LE(21)
      width = (bits & 0x3fff) + 1
      height = ((bits >> 14) & 0x3fff) + 1
    }
    return {
      format: 'webp',
      ext: '.webp',
      mime: 'image/webp',
      width: width || 1600,
      height: height || 1000,
    }
  }

  return null
}

export function buildContentHashedAssetName(buf, ext) {
  const hash12 = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12)
  const cleanExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`
  return `shot-${hash12}${cleanExt}`
}
