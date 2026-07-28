import { BOARD_H, BOARD_W, EngineSnapshot, GRID_H, GRID_W, Point } from './types'

const cellW = BOARD_W / GRID_W
const cellH = BOARD_H / GRID_H

function hash(value: number) {
  const x = Math.sin(value * 127.1) * 43758.5453
  return x - Math.floor(x)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function occupiedAt(snapshot: EngineSnapshot, point: Point) {
  const x = clamp(Math.floor(point.x / cellW), 0, GRID_W - 1)
  const y = clamp(Math.floor(point.y / cellH), 0, GRID_H - 1)
  return snapshot.occupied[y * GRID_W + x] === 1
}

function tracePolyline(ctx: CanvasRenderingContext2D, points: Point[]) {
  if (points.length < 2) return
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index].x, points[index].y)
  }
}

function pointSegmentDistance(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (!lengthSq) return Math.hypot(point.x - a.x, point.y - a.y)
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq, 0, 1)
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t))
}

function distanceToTrail(point: Point, points: Point[]) {
  let nearest = Number.POSITIVE_INFINITY
  for (let index = 1; index < points.length; index += 1) {
    nearest = Math.min(nearest, pointSegmentDistance(point, points[index - 1], points[index]))
  }
  return nearest
}

function pointAlongTrail(points: Point[], progress: number) {
  if (points.length < 2) return points[0]
  const lengths: number[] = []
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    const length = Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y)
    lengths.push(length)
    total += length
  }
  let target = clamp(progress, 0, 1) * total
  for (let index = 0; index < lengths.length; index += 1) {
    if (target <= lengths[index]) {
      const t = lengths[index] ? target / lengths[index] : 0
      return {
        x: points[index].x + (points[index + 1].x - points[index].x) * t,
        y: points[index].y + (points[index + 1].y - points[index].y) * t,
      }
    }
    target -= lengths[index]
  }
  return points[points.length - 1]
}

function clipUnowned(ctx: CanvasRenderingContext2D, snapshot: EngineSnapshot) {
  ctx.beginPath()
  for (let y = 0; y < GRID_H; y += 1) {
    let runStart = -1
    for (let x = 0; x <= GRID_W; x += 1) {
      const unowned = x < GRID_W && snapshot.occupied[y * GRID_W + x] === 0
      if (unowned && runStart < 0) runStart = x
      if ((!unowned || x === GRID_W) && runStart >= 0) {
        ctx.rect(runStart * cellW - 0.4, y * cellH - 0.4, (x - runStart) * cellW + 0.8, cellH + 0.8)
        runStart = -1
      }
    }
  }
  ctx.clip()
}

function drawWetSurface(
  ctx: CanvasRenderingContext2D,
  snapshot: EngineSnapshot,
  time: number,
  reducedMotion: boolean,
  baseline: boolean,
) {
  ctx.save()
  clipUnowned(ctx, snapshot)

  const wet = ctx.createLinearGradient(0, 0, BOARD_W, BOARD_H)
  wet.addColorStop(0, '#153543')
  wet.addColorStop(0.42, '#071017')
  wet.addColorStop(1, '#112f3b')
  ctx.fillStyle = wet
  ctx.fillRect(0, 0, BOARD_W, BOARD_H)

  ctx.globalCompositeOperation = 'screen'
  const drift = reducedMotion ? 0 : Math.sin(time * 0.18) * 9
  for (let index = 0; index < 7; index += 1) {
    const y = 18 + index * 78 + drift * (index % 2 ? -1 : 1)
    const reflection = ctx.createLinearGradient(0, y, BOARD_W, y + 42)
    reflection.addColorStop(0, 'rgba(125,207,220,0)')
    reflection.addColorStop(0.48, `rgba(125,207,220,${0.035 + hash(index) * 0.04})`)
    reflection.addColorStop(0.55, `rgba(231,226,216,${0.025 + hash(index + 4) * 0.035})`)
    reflection.addColorStop(1, 'rgba(125,207,220,0)')
    ctx.fillStyle = reflection
    ctx.save()
    ctx.translate(BOARD_W / 2, y)
    ctx.rotate(-0.18 + hash(index + 11) * 0.08)
    ctx.fillRect(-BOARD_W, -16, BOARD_W * 2, 38)
    ctx.restore()
  }

  ctx.globalCompositeOperation = 'source-over'
  const precipitation = baseline
    ? 1
    : snapshot.phase === 'won'
      ? 0
      : snapshot.phase.startsWith('failed')
        ? 1
        : 0.78
  const dropCount = Math.round((reducedMotion ? 34 : 118) * precipitation)
  for (let index = 0; index < dropCount; index += 1) {
    const period = 0.74 + hash(index + 8) * 0.88
    const age = (time / period + hash(index + 1.3)) % 1
    const impact = {
      x: 12 + hash(index + 2.1) * (BOARD_W - 24),
      y: 18 + hash(index + 7.4) * (BOARD_H - 36),
    }
    if (occupiedAt(snapshot, impact)) continue
    if (age < 0.76) {
      const fall = age / 0.76
      const length = 5 + hash(index + 4.8) * 8
      const y = impact.y - (1 - fall) * (42 + hash(index + 9) * 86)
      ctx.strokeStyle = `rgba(180,214,221,${0.2 + fall * 0.34})`
      ctx.lineWidth = 0.65
      ctx.beginPath()
      ctx.moveTo(impact.x + length * 0.2, y - length)
      ctx.lineTo(impact.x, y)
      ctx.stroke()
      continue
    }
    const impactAge = (age - 0.76) / 0.24
    ctx.strokeStyle = `rgba(185,226,232,${(1 - impactAge) * 0.42})`
    ctx.lineWidth = 0.7
    ctx.beginPath()
    ctx.ellipse(impact.x, impact.y, 1.4 + impactAge * 12, 0.6 + impactAge * 4, 0, 0, Math.PI * 2)
    ctx.stroke()
    if (impactAge < 0.34) {
      for (let splash = 0; splash < 3; splash += 1) {
        const angle = -Math.PI * (0.22 + splash * 0.28)
        const reach = 2 + (0.34 - impactAge) * 18
        ctx.beginPath()
        ctx.moveTo(impact.x, impact.y)
        ctx.lineTo(impact.x + Math.cos(angle) * reach, impact.y + Math.sin(angle) * reach)
        ctx.stroke()
      }
    }
  }
  ctx.restore()
}

function drawOwnedBoundary(ctx: CanvasRenderingContext2D, snapshot: EngineSnapshot) {
  ctx.fillStyle = 'rgba(94,242,224,.055)'
  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      if (snapshot.occupied[y * GRID_W + x]) ctx.fillRect(x * cellW, y * cellH, cellW + 0.2, cellH + 0.2)
    }
  }

  ctx.save()
  ctx.strokeStyle = 'rgba(94,242,224,.62)'
  ctx.lineWidth = 2.1
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
}

function drawTrailBody(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  time: number,
  risk: number,
  reducedMotion: boolean,
) {
  if (points.length < 2) return
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  tracePolyline(ctx, points)
  ctx.strokeStyle = `rgba(${Math.round(22 + risk * 80)},${Math.round(126 - risk * 26)},${Math.round(134 - risk * 32)},.78)`
  ctx.lineWidth = 10
  ctx.shadowColor = risk > 0.45 ? '#ff5d66' : '#5ef2e0'
  ctx.shadowBlur = 14 + risk * 9
  ctx.stroke()
  ctx.strokeStyle = risk > 0.45 ? '#ffd0cf' : '#e7fffa'
  ctx.lineWidth = 2.2
  ctx.shadowBlur = 7
  ctx.stroke()

  const beadCount = Math.min(11, Math.max(3, Math.floor(points.length / 3)))
  for (let index = 0; index < beadCount; index += 1) {
    const point = pointAlongTrail(points, reducedMotion ? index / beadCount : (index / beadCount + time * 0.42) % 1)
    ctx.fillStyle = index % 3 === 0 ? '#fff6cf' : '#5ef2e0'
    ctx.beginPath()
    ctx.arc(point.x, point.y, index % 3 === 0 ? 1.75 : 1.05, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawEcho(ctx: CanvasRenderingContext2D, snapshot: EngineSnapshot) {
  if (snapshot.echoTrail.length < 2) return
  const pulse = snapshot.echoKind === 'hit' ? snapshot.hitPulse : snapshot.capturePulse
  ctx.save()
  ctx.globalAlpha = pulse
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  tracePolyline(ctx, snapshot.echoTrail)
  ctx.strokeStyle = snapshot.echoKind === 'hit' ? '#ff5d66' : '#ffc857'
  ctx.lineWidth = 2 + snapshot.capturePower * 3
  ctx.shadowColor = snapshot.echoKind === 'hit' ? '#ff5d66' : '#ffc857'
  ctx.shadowBlur = 12 + snapshot.capturePower * 20
  ctx.stroke()
  ctx.restore()
}

function drawFlare(ctx: CanvasRenderingContext2D, snapshot: EngineSnapshot, time: number) {
  if (snapshot.capturePulse <= 0 || snapshot.echoTrail.length < 2) return
  const point = snapshot.echoTrail[snapshot.echoTrail.length - 1]
  const pulse = snapshot.capturePulse
  const length = (12 + snapshot.capturePower * 28) * (0.72 + Math.sin(time * 16) * 0.08)
  ctx.save()
  ctx.translate(point.x, point.y)
  ctx.rotate(-0.18)
  ctx.globalCompositeOperation = 'lighter'
  for (let blade = 0; blade < 6; blade += 1) {
    ctx.rotate(Math.PI / 3)
    const gradient = ctx.createLinearGradient(0, 0, length, 0)
    gradient.addColorStop(0, `rgba(255,246,207,${pulse * 0.86})`)
    gradient.addColorStop(1, 'rgba(255,200,87,0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.moveTo(0, -1.2)
    ctx.lineTo(length, 0)
    ctx.lineTo(0, 1.2)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

function drawPentagon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath()
  for (let index = 0; index < 5; index += 1) {
    const angle = -Math.PI / 2 + index * Math.PI * 0.4
    const px = x + Math.cos(angle) * radius
    const py = y + Math.sin(angle) * radius
    if (!index) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
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

  drawWetSurface(ctx, snapshot, time, reducedMotion, baseline)
  drawOwnedBoundary(ctx, snapshot)
  drawEcho(ctx, snapshot)

  const trailDanger = snapshot.trail.length > 1
    ? clamp(1 - (distanceToTrail(snapshot.enemy, snapshot.trail) - 14) / 78, 0, 1)
    : 0
  drawTrailBody(ctx, snapshot.trail, time, trailDanger, reducedMotion)

  if (snapshot.pointerActive) {
    ctx.save()
    ctx.strokeStyle = `rgba(231,226,216,${0.12 + clamp(Math.hypot(snapshot.target.x - snapshot.player.x, snapshot.target.y - snapshot.player.y) / 160, 0, 1) * 0.24})`
    ctx.lineWidth = 0.8
    ctx.setLineDash([2, 5])
    ctx.beginPath()
    ctx.moveTo(snapshot.player.x, snapshot.player.y)
    ctx.lineTo(snapshot.target.x, snapshot.target.y)
    ctx.stroke()
    ctx.restore()
  }

  if (snapshot.touchPulse > 0) {
    ctx.save()
    ctx.strokeStyle = `rgba(231,255,250,${snapshot.touchPulse * 0.72})`
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.ellipse(
      snapshot.touchPoint.x,
      snapshot.touchPoint.y,
      4 + (1 - snapshot.touchPulse) * 17,
      2 + (1 - snapshot.touchPulse) * 7,
      0,
      0,
      Math.PI * 2,
    )
    ctx.stroke()
    ctx.restore()
  }

  const stormPulse = 1 + Math.sin(time * 7) * 0.08
  ctx.save()
  ctx.translate(snapshot.enemy.x, snapshot.enemy.y)
  const dangerGradient = ctx.createRadialGradient(0, 0, 9, 0, 0, 38 + trailDanger * 18)
  dangerGradient.addColorStop(0, `rgba(255,93,102,${0.12 + trailDanger * 0.18})`)
  dangerGradient.addColorStop(1, 'rgba(255,93,102,0)')
  ctx.fillStyle = dangerGradient
  ctx.beginPath()
  ctx.arc(0, 0, 56, 0, Math.PI * 2)
  ctx.fill()
  ctx.rotate(time * 0.8)
  ctx.fillStyle = '#071017'
  ctx.strokeStyle = trailDanger > 0.45 ? '#ffd0cf' : '#ff5d66'
  ctx.lineWidth = 1.8 + trailDanger
  ctx.shadowColor = '#ff5d66'
  ctx.shadowBlur = 9 + trailDanger * 13
  ctx.beginPath()
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2
    const radius = (index % 2 ? 9 : 14) * stormPulse
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (!index) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()

  if (snapshot.probe.active) {
    ctx.save()
    ctx.strokeStyle = snapshot.probe.warning > 0 ? 'rgba(255,93,102,.5)' : '#ff5d66'
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
  ctx.rotate(time * 1.5)
  ctx.fillStyle = '#fffbe7'
  ctx.shadowColor = trailDanger > 0.45 ? '#ff5d66' : '#5ef2e0'
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.moveTo(0, -5.4)
  ctx.lineTo(4.2, 0)
  ctx.lineTo(0, 5.4)
  ctx.lineTo(-4.2, 0)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  if (!reducedMotion) drawFlare(ctx, snapshot, time)

  if (snapshot.phase === 'won') {
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    for (let index = 0; index < (reducedMotion ? 6 : 13); index += 1) {
      const x = hash(index + 50) * BOARD_W
      const y = hash(index + 70) * BOARD_H
      const driftY = reducedMotion ? 0 : Math.sin(time * 0.16 + index) * 5
      const radius = 4 + hash(index + 90) * 13
      ctx.fillStyle = `rgba(231,226,216,${0.018 + hash(index + 14) * 0.055})`
      drawPentagon(ctx, x, y + driftY, radius)
      ctx.fill()
    }
    ctx.restore()
  }

  if (snapshot.hitPulse > 0) {
    ctx.save()
    ctx.strokeStyle = `rgba(255,93,102,${snapshot.hitPulse})`
    ctx.lineWidth = 4
    ctx.setLineDash([11, 7])
    ctx.lineDashOffset = time * 26
    ctx.strokeRect(3, 3, BOARD_W - 6, BOARD_H - 6)
    ctx.restore()
  }
}
