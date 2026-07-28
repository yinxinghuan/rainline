import { BOARD_H, BOARD_W, EngineSnapshot, GRID_H, GRID_W } from './types'

const cellW = BOARD_W / GRID_W
const cellH = BOARD_H / GRID_H

function hash(value: number) {
  const x = Math.sin(value * 127.1) * 43758.5453
  return x - Math.floor(x)
}

export function drawRainline(
  canvas: HTMLCanvasElement,
  snapshot: EngineSnapshot,
  time: number,
  reducedMotion: boolean,
  baseline: boolean,
) {
  const rect = canvas.getBoundingClientRect()
  const dprCap = rect.width <= 330 ? 1 : 1.4
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap)
  const width = Math.max(1, Math.round(rect.width * dpr))
  const height = Math.max(1, Math.round(rect.height * dpr))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(width / BOARD_W, 0, 0, height / BOARD_H, 0, 0)
  ctx.clearRect(0, 0, BOARD_W, BOARD_H)

  const wet = ctx.createLinearGradient(0, 0, BOARD_W, BOARD_H)
  wet.addColorStop(0, 'rgba(16,39,51,.92)')
  wet.addColorStop(0.48, 'rgba(7,16,23,.86)')
  wet.addColorStop(1, 'rgba(13,35,44,.94)')
  ctx.fillStyle = wet
  for (let y = 0; y < GRID_H; y += 1) {
    let runStart = -1
    for (let x = 0; x <= GRID_W; x += 1) {
      const unowned = x < GRID_W && snapshot.occupied[y * GRID_W + x] === 0
      if (unowned && runStart < 0) runStart = x
      if ((!unowned || x === GRID_W) && runStart >= 0) {
        ctx.fillRect(runStart * cellW - 0.4, y * cellH - 0.4, (x - runStart) * cellW + 0.8, cellH + 0.8)
        runStart = -1
      }
    }
  }

  ctx.fillStyle = 'rgba(94,242,224,.075)'
  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      if (snapshot.occupied[y * GRID_W + x]) ctx.fillRect(x * cellW, y * cellH, cellW + 0.2, cellH + 0.2)
    }
  }

  ctx.save()
  ctx.globalAlpha = baseline ? 0.8 : snapshot.phase === 'won' ? 0.18 : 0.56
  ctx.strokeStyle = '#a8bbc2'
  ctx.lineWidth = 0.75
  const dropCount = reducedMotion ? 36 : rect.width <= 330 ? 88 : 140
  for (let i = 0; i < dropCount; i += 1) {
    const speed = 80 + hash(i + 9) * 180
    const x = hash(i + 2.1) * (BOARD_W + 80) - 40
    const y = (hash(i + 7.4) * BOARD_H + time * speed) % (BOARD_H + 30) - 15
    const length = 3 + hash(i + 4.8) * 9
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - length * 0.22, y + length)
    ctx.stroke()
  }
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = snapshot.phase === 'won' ? 0.3 : 0.64
  for (let i = 0; i < (reducedMotion ? 5 : 11); i += 1) {
    const age = (time * (0.22 + hash(i) * 0.2) + hash(i + 12)) % 1
    const x = 18 + hash(i + 32) * (BOARD_W - 36)
    const y = 20 + hash(i + 45) * (BOARD_H - 40)
    ctx.strokeStyle = `rgba(168,187,194,${(1 - age) * 0.28})`
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.ellipse(x, y, age * 12, age * 4.2, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = 'rgba(94,242,224,.62)'
  ctx.lineWidth = 2.5
  ctx.shadowColor = '#5ef2e0'
  ctx.shadowBlur = 7
  ctx.beginPath()
  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      const idx = y * GRID_W + x
      if (!snapshot.occupied[idx]) continue
      const left = x === 0 || !snapshot.occupied[idx - 1]
      const right = x === GRID_W - 1 || !snapshot.occupied[idx + 1]
      const top = y === 0 || !snapshot.occupied[idx - GRID_W]
      const bottom = y === GRID_H - 1 || !snapshot.occupied[idx + GRID_W]
      if (left) { ctx.moveTo(x * cellW, y * cellH); ctx.lineTo(x * cellW, (y + 1) * cellH) }
      if (right) { ctx.moveTo((x + 1) * cellW, y * cellH); ctx.lineTo((x + 1) * cellW, (y + 1) * cellH) }
      if (top) { ctx.moveTo(x * cellW, y * cellH); ctx.lineTo((x + 1) * cellW, y * cellH) }
      if (bottom) { ctx.moveTo(x * cellW, (y + 1) * cellH); ctx.lineTo((x + 1) * cellW, (y + 1) * cellH) }
    }
  }
  ctx.stroke()
  ctx.restore()

  if (snapshot.trail.length > 1) {
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(22,126,134,.72)'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.moveTo(snapshot.trail[0].x, snapshot.trail[0].y)
    snapshot.trail.slice(1).forEach(point => ctx.lineTo(point.x, point.y))
    ctx.stroke()
    ctx.strokeStyle = '#5ef2e0'
    ctx.lineWidth = 2.2
    ctx.shadowColor = '#5ef2e0'
    ctx.shadowBlur = 10
    ctx.stroke()
    ctx.restore()
  }

  const stormPulse = 1 + Math.sin(time * 7) * 0.08
  ctx.save()
  ctx.translate(snapshot.enemy.x, snapshot.enemy.y)
  ctx.rotate(time * 0.8)
  ctx.fillStyle = '#071017'
  ctx.strokeStyle = '#ff5d66'
  ctx.lineWidth = 1.8
  ctx.shadowColor = '#ff5d66'
  ctx.shadowBlur = 8
  ctx.beginPath()
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2
    const radius = (i % 2 ? 9 : 14) * stormPulse
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()

  if (snapshot.probe.active) {
    ctx.save()
    ctx.strokeStyle = snapshot.probe.warning > 0 ? 'rgba(255,93,102,.45)' : '#ff5d66'
    ctx.setLineDash(snapshot.probe.warning > 0 ? [4, 5] : [])
    ctx.lineWidth = snapshot.probe.warning > 0 ? 1.5 : 3
    ctx.beginPath()
    ctx.moveTo(snapshot.enemy.x, snapshot.enemy.y)
    ctx.lineTo(snapshot.probe.x, snapshot.probe.y)
    ctx.stroke()
    ctx.restore()
  }

  ctx.save()
  ctx.translate(snapshot.player.x, snapshot.player.y)
  ctx.fillStyle = '#e7e2d8'
  ctx.shadowColor = '#5ef2e0'
  ctx.shadowBlur = 10
  ctx.beginPath()
  ctx.arc(0, 0, 4.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  if (snapshot.capturePulse > 0) {
    ctx.fillStyle = `rgba(255,200,87,${snapshot.capturePulse * 0.13})`
    ctx.fillRect(0, 0, BOARD_W, BOARD_H)
  }
  if (snapshot.hitPulse > 0) {
    ctx.strokeStyle = `rgba(255,93,102,${snapshot.hitPulse})`
    ctx.lineWidth = 5
    ctx.strokeRect(2.5, 2.5, BOARD_W - 5, BOARD_H - 5)
  }
}
