#!/usr/bin/env node
/**
 * Generate the Dietinator app icon set, a teal "D" built from a rounded bar
 * and a calorie-ring arc (echoing the CalorieRing dashboard component).
 *
 * Zero dependencies: renders signed-distance shapes with supersampling and
 * writes PNGs via Node's zlib + a minimal chunk encoder.
 *
 * Geometry: the ring arc is cut at +-90 degrees; its end face coincides
 * exactly with the bar's right face (x = -0.13s), so the union is flush:
 * the outer curve is tangent to the bar's top edge, the inner counter meets
 * the face at a crisp right angle, like a real "D".
 *
 * Usage: node scripts/generate-icons.cjs
 */
const fs = require("fs")
const path = require("path")
const zlib = require("zlib")

// ---- brand colors --------------------------------------------------------
const TEAL_TOP = [45, 212, 191] // #2dd4bf
const TEAL_BOTTOM = [13, 148, 136] // #0d9488
const WHITE = [255, 255, 255, 255]
const BLACK = [0, 0, 0, 255]
const SOLID_TEAL = [13, 148, 136, 255]

// ---- minimal PNG encoder -------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, "ascii"), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("sRGB", Buffer.from([0])),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

// ---- signed-distance shapes (units: pixels) -------------------------------
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

function sdRoundedRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r
  const qy = Math.abs(py - cy) - hh + r
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  const inside = Math.min(Math.max(qx, qy), 0)
  return outside + inside - r
}

// Ring band arc: center (cx, cy), mid radius R, stroke thickness t, angles
// a0..a1 (radians, y-down: 0 = right, -PI/2 = up). Nothing outside the range.
function sdArc(px, py, cx, cy, R, t, a0, a1) {
  const ang = Math.atan2(py - cy, px - cx)
  if (ang < a0 || ang > a1) return 1e9
  return Math.abs(Math.hypot(px - cx, py - cy) - R) - t / 2
}

// The Dietinator mark: rounded vertical bar + right semicircle ring, sized
// relative to a unit square (returns SDF in pixels for an N-pixel canvas).
//
// Junction math: the ring's outer circle (center x=-0.13s, radius 0.435s) and
// the bar's top-right corner circle (center x=-0.13s, y=-(hh-r), radius r)
// are internally tangent when cx + hw - r = -0.13s, which is what makes the
// top/bottom seams disappear. The ring's end plane (x=-0.13s) sits exactly on
// the bar face, and the inner arc emerges from the face nearly vertically.
function markSDF(px, py, N, scale) {
  const s = N * scale
  const bar = sdRoundedRect(px, py, -0.195 * s, 0, 0.095 * s, 0.435 * s, 0.03 * s)
  const arc = sdArc(px, py, -0.13 * s, 0, 0.34 * s, 0.19 * s, -Math.PI / 2, Math.PI / 2)
  return Math.min(bar, arc)
}

// ---- renderer ---------------------------------------------------------------
// opts: { width, height, bg: [c1, c2] | null (vertical gradient),
//         mark: [r,g,b,a] | null, scale, markCY (fraction of height) }
function render(opts) {
  const { width, height, bg, mark } = opts
  const scale = opts.scale ?? 1
  const markCX = width / 2
  const markCY = (opts.markCY ?? 0.5) * height
  const supersample = Math.max(2, Math.ceil(320 / Math.min(width, height)))
  const rgba = Buffer.alloc(width * height * 4)
  const step = 1 / supersample
  const unit = Math.min(width, height)
  const denom = supersample * supersample
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0
      for (let sy = 0; sy < supersample; sy++) {
        for (let sx = 0; sx < supersample; sx++) {
          const px = x + (sx + 0.5) * step
          const py = y + (sy + 0.5) * step
          let cov = 0
          if (mark) cov = clamp(0.5 - markSDF(px - markCX, py - markCY, unit, scale) / 1.5, 0, 1)
          if (bg) {
            const t = py / height
            r += (bg[0][0] + (bg[1][0] - bg[0][0]) * t) * (1 - cov) + (mark ? mark[0] * cov : 0)
            g += (bg[0][1] + (bg[1][1] - bg[0][1]) * t) * (1 - cov) + (mark ? mark[1] * cov : 0)
            b += (bg[0][2] + (bg[1][2] - bg[0][2]) * t) * (1 - cov) + (mark ? mark[2] * cov : 0)
            a += 255
          } else if (cov > 0) {
            r += mark[0] * cov
            g += mark[1] * cov
            b += mark[2] * cov
            a += mark[3] * cov
          }
        }
      }
      const i = (y * width + x) * 4
      rgba[i] = Math.round(r / denom)
      rgba[i + 1] = Math.round(g / denom)
      rgba[i + 2] = Math.round(b / denom)
      rgba[i + 3] = Math.round(a / denom)
    }
  }
  return rgba
}

// ---- assets -------------------------------------------------------------------
const assets = path.join(__dirname, "..", "assets")
const gradient = [TEAL_TOP, TEAL_BOTTOM]

// [filename, width, height, bg, mark, scale]
const files = [
  ["icon.png", 1024, 1024, gradient, WHITE, 0.92],
  ["android-icon-background.png", 1024, 1024, gradient, null, 1.0],
  ["android-icon-foreground.png", 1024, 1024, null, WHITE, 0.78],
  ["android-icon-monochrome.png", 1024, 1024, null, BLACK, 0.78],
  ["splash-icon.png", 200, 584, null, SOLID_TEAL, 1.6],
  ["favicon.png", 48, 48, gradient, WHITE, 0.92],
]

for (const [name, w, h, bg, mark, scale] of files) {
  const rgba = render({ width: w, height: h, bg, mark, scale })
  fs.writeFileSync(path.join(assets, name), encodePNG(w, h, rgba))
  console.log(
    `${name} ${w}x${h} (${Math.round(fs.statSync(path.join(assets, name)).size / 1024)} KB)`,
  )
}

console.log("Icon set regenerated.")
