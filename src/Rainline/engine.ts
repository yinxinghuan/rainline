import {
  BOARD_H,
  BOARD_W,
  EngineSnapshot,
  GRID_H,
  GRID_W,
  Phase,
  Point,
  Probe,
  ROUND_SECONDS,
  START_LIVES,
  WIN_RATIO,
} from './types'

const CELL_W = BOARD_W / GRID_W
const CELL_H = BOARD_H / GRID_H
const BORDER = 2
const START_ROWS = 8
const PLAYER_SPEED = 310
const PLAYER_CATCHUP_SPEED = 520
const START_SNAP_RADIUS = 34
const RELEASE_GRACE_SECONDS = 0.58
const STORM_RADIUS = 11
const TRAIL_RADIUS = 4

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

function pointSegmentDistance(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return distance(point, a)
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq, 0, 1)
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point) {
  const cross = (p: Point, q: Point, r: Point) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  const abC = cross(a, b, c)
  const abD = cross(a, b, d)
  const cdA = cross(c, d, a)
  const cdB = cross(c, d, b)
  return abC * abD < 0 && cdA * cdB < 0
}

export class RainlineEngine {
  private occupied = new Uint8Array(GRID_W * GRID_H)
  private phase: Phase = 'ready'
  private lives = START_LIVES
  private seconds = ROUND_SECONDS
  private score = 0
  private combo = 0
  private comboDeadline = 0
  private longestTrail = 0
  private nearMisses = 0
  private message = ''
  private player: Point = { x: BOARD_W / 2, y: BOARD_H * 0.91 }
  private anchor: Point = { ...this.player }
  private target: Point = { ...this.player }
  private trail: Point[] = []
  private echoTrail: Point[] = []
  private echoKind: 'capture' | 'hit' | null = null
  private pointerActive = false
  private releaseGrace = 0
  private timerStarted = false
  private enemy: Point = { x: BOARD_W * 0.48, y: BOARD_H * 0.39 }
  private enemyVelocity: Point = { x: 46, y: 39 }
  private probe: Probe = { active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, warning: 0 }
  private probeCooldown = 4.8
  private capturePulse = 0
  private capturePower = 0
  private hitPulse = 0
  private touchPulse = 0
  private touchPoint: Point = { ...this.player }
  private elapsed = 0
  private hitRecovery = 0
  private pausedFrom: Phase = 'ready'

  constructor() {
    this.resetGrid()
  }

  private index(x: number, y: number) {
    return y * GRID_W + x
  }

  private cell(point: Point) {
    return {
      x: clamp(Math.floor(point.x / CELL_W), 0, GRID_W - 1),
      y: clamp(Math.floor(point.y / CELL_H), 0, GRID_H - 1),
    }
  }

  private isOwned(point: Point) {
    const cell = this.cell(point)
    return this.occupied[this.index(cell.x, cell.y)] === 1
  }

  private nearestOwnedPoint(point: Point) {
    const center = this.cell(point)
    const radiusX = Math.ceil(START_SNAP_RADIUS / CELL_W)
    const radiusY = Math.ceil(START_SNAP_RADIUS / CELL_H)
    let nearest: Point | null = null
    let nearestDistance = START_SNAP_RADIUS
    for (let y = Math.max(0, center.y - radiusY); y <= Math.min(GRID_H - 1, center.y + radiusY); y += 1) {
      for (let x = Math.max(0, center.x - radiusX); x <= Math.min(GRID_W - 1, center.x + radiusX); x += 1) {
        if (!this.occupied[this.index(x, y)]) continue
        const candidate = { x: (x + 0.5) * CELL_W, y: (y + 0.5) * CELL_H }
        const candidateDistance = distance(point, candidate)
        if (candidateDistance <= nearestDistance) {
          nearest = candidate
          nearestDistance = candidateDistance
        }
      }
    }
    return nearest
  }

  private resetGrid() {
    this.occupied.fill(0)
    for (let y = 0; y < GRID_H; y += 1) {
      for (let x = 0; x < GRID_W; x += 1) {
        if (
          x < BORDER ||
          x >= GRID_W - BORDER ||
          y < BORDER ||
          y >= GRID_H - BORDER - START_ROWS
        ) {
          this.occupied[this.index(x, y)] = 1
        }
      }
    }
  }

  reset() {
    this.phase = 'ready'
    this.lives = START_LIVES
    this.seconds = ROUND_SECONDS
    this.score = 0
    this.combo = 0
    this.comboDeadline = 0
    this.longestTrail = 0
    this.nearMisses = 0
    this.message = ''
    this.player = { x: BOARD_W / 2, y: BOARD_H * 0.91 }
    this.anchor = { ...this.player }
    this.target = { ...this.player }
    this.trail = []
    this.echoTrail = []
    this.echoKind = null
    this.pointerActive = false
    this.releaseGrace = 0
    this.timerStarted = false
    this.enemy = { x: BOARD_W * 0.48, y: BOARD_H * 0.39 }
    this.enemyVelocity = { x: 46, y: 39 }
    this.probe = { active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, warning: 0 }
    this.probeCooldown = 4.8
    this.capturePulse = 0
    this.capturePower = 0
    this.hitPulse = 0
    this.touchPulse = 0
    this.touchPoint = { ...this.player }
    this.elapsed = 0
    this.hitRecovery = 0
    this.resetGrid()
  }

  pointerDown(point: Point) {
    if (this.phase !== 'ready' && this.phase !== 'playing') return false
    if (this.hitRecovery > 0) return false
    const start = this.isOwned(point) ? point : this.nearestOwnedPoint(point)
    if (!start) return false
    this.player = { ...start }
    this.anchor = { ...start }
    this.target = { ...start }
    this.touchPoint = { ...point }
    this.touchPulse = 1
    this.pointerActive = true
    this.releaseGrace = 0
    if (this.phase === 'ready') this.phase = 'playing'
    return true
  }

  pointerMove(point: Point) {
    if (!this.pointerActive) return
    this.target = {
      x: clamp(point.x, CELL_W, BOARD_W - CELL_W),
      y: clamp(point.y, CELL_H, BOARD_H - CELL_H),
    }
    this.touchPoint = { ...this.target }
  }

  pointerUp() {
    if (!this.pointerActive) return
    if (this.trail.length > 0) {
      this.releaseGrace = RELEASE_GRACE_SECONDS
      return
    }
    this.pointerActive = false
  }

  togglePause() {
    if (this.phase === 'paused') {
      this.phase = this.pausedFrom
      return
    }
    if (this.phase === 'ready' || this.phase === 'playing' || this.phase === 'hit') {
      this.pausedFrom = this.phase
      this.phase = 'paused'
      this.pointerActive = false
    }
  }

  private movePlayer(dt: number) {
    if (!this.pointerActive) return
    const dx = this.target.x - this.player.x
    const dy = this.target.y - this.player.y
    const remaining = Math.hypot(dx, dy)
    if (remaining < 0.2) return
    const speed = clamp(PLAYER_SPEED + remaining * 1.65, PLAYER_SPEED, PLAYER_CATCHUP_SPEED)
    const step = Math.min(remaining, speed * dt)
    const next = {
      x: this.player.x + (dx / remaining) * step,
      y: this.player.y + (dy / remaining) * step,
    }
    const nextOwned = this.isOwned(next)

    if (this.trail.length === 0) {
      if (nextOwned) {
        this.player = next
        this.anchor = { ...next }
        return
      }
      this.timerStarted = true
      this.trail = [{ ...this.anchor }, next]
      this.player = next
      this.message = 'LIVE'
      return
    }

    const last = this.trail[this.trail.length - 1]
    if (nextOwned && this.trailLength() > 14) {
      this.trail.push(next)
      this.player = next
      this.capture()
      return
    }

    if (!nextOwned) {
      const prior = this.trail[this.trail.length - 2]
      if (prior && distance(last, next) > 1.5) {
        for (let i = 0; i < this.trail.length - 5; i += 1) {
          if (segmentsIntersect(last, next, this.trail[i], this.trail[i + 1])) {
            this.cancelTrail('路径相交')
            this.combo = 0
            return
          }
        }
      }
      if (distance(last, next) >= 3) this.trail.push(next)
      else this.trail[this.trail.length - 1] = next
      this.player = next
    }
  }

  private trailLength() {
    let length = 0
    for (let i = 1; i < this.trail.length; i += 1) {
      length += distance(this.trail[i - 1], this.trail[i])
    }
    return length
  }

  private rasterizeTrail() {
    for (let i = 1; i < this.trail.length; i += 1) {
      const a = this.trail[i - 1]
      const b = this.trail[i]
      const steps = Math.ceil(distance(a, b) / Math.min(CELL_W, CELL_H))
      for (let s = 0; s <= steps; s += 1) {
        const t = steps ? s / steps : 0
        const point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
        const cell = this.cell(point)
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            const x = clamp(cell.x + ox, 0, GRID_W - 1)
            const y = clamp(cell.y + oy, 0, GRID_H - 1)
            this.occupied[this.index(x, y)] = 1
          }
        }
      }
    }
  }

  private capture() {
    const before = this.ownedInteriorCount()
    const length = this.trailLength()
    const near = this.minDistanceToTrail(this.enemy) < BOARD_W * 0.1
    this.rasterizeTrail()

    const reachable = new Uint8Array(this.occupied.length)
    const enemyCell = this.cell(this.enemy)
    const queueX = new Int16Array(this.occupied.length)
    const queueY = new Int16Array(this.occupied.length)
    let read = 0
    let write = 0
    if (!this.occupied[this.index(enemyCell.x, enemyCell.y)]) {
      queueX[write] = enemyCell.x
      queueY[write] = enemyCell.y
      write += 1
      reachable[this.index(enemyCell.x, enemyCell.y)] = 1
    }
    while (read < write) {
      const x = queueX[read]
      const y = queueY[read]
      read += 1
      const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue
        const idx = this.index(nx, ny)
        if (this.occupied[idx] || reachable[idx]) continue
        reachable[idx] = 1
        queueX[write] = nx
        queueY[write] = ny
        write += 1
      }
    }
    for (let y = BORDER; y < GRID_H - BORDER; y += 1) {
      for (let x = BORDER; x < GRID_W - BORDER; x += 1) {
        const idx = this.index(x, y)
        if (!this.occupied[idx] && !reachable[idx]) this.occupied[idx] = 1
      }
    }

    const added = Math.max(0, this.ownedInteriorCount() - before)
    const interior = (GRID_W - BORDER * 2) * (GRID_H - BORDER * 2)
    const areaRatio = added / interior
    const risk = length / Math.hypot(BOARD_W, BOARD_H)
    const riskMultiplier = risk > 0.35 ? 1.6 : risk >= 0.15 ? 1.25 : 1
    this.combo = this.elapsed <= this.comboDeadline ? Math.min(3, this.combo + 0.5) : 1
    this.comboDeadline = this.elapsed + 7
    const nearMultiplier = near ? 1.25 : 1
    const gained = Math.floor(areaRatio * 10000 * riskMultiplier * this.combo * nearMultiplier)
    this.score += gained
    this.longestTrail = Math.max(this.longestTrail, length)
    if (near) this.nearMisses += 1
    this.message = `${near ? '险过 · ' : ''}+${gained}`
    this.echoTrail = this.trail.map(point => ({ ...point }))
    this.echoKind = 'capture'
    this.capturePower = clamp(areaRatio * 8 + risk * 0.9 + (near ? 0.2 : 0), 0.22, 1)
    this.capturePulse = 1
    this.trail = []
    this.anchor = { ...this.player }
    if (this.ratio() >= WIN_RATIO) this.finish('won')
  }

  private cancelTrail(message: string) {
    this.player = { ...this.anchor }
    this.target = { ...this.anchor }
    this.trail = []
    this.message = message
  }

  private minDistanceToTrail(point: Point) {
    let min = Number.POSITIVE_INFINITY
    for (let i = 1; i < this.trail.length; i += 1) {
      min = Math.min(min, pointSegmentDistance(point, this.trail[i - 1], this.trail[i]))
    }
    return min
  }

  private moveEnemy(dt: number) {
    const speedFactor = this.ratio() >= 0.55 ? 1.44 : this.ratio() >= 0.35 ? 1.22 : 1
    let nextX = this.enemy.x + this.enemyVelocity.x * speedFactor * dt
    let nextY = this.enemy.y + this.enemyVelocity.y * speedFactor * dt
    if (this.isOwned({ x: nextX, y: this.enemy.y })) {
      this.enemyVelocity.x *= -1
      nextX = this.enemy.x + this.enemyVelocity.x * speedFactor * dt
    }
    if (this.isOwned({ x: this.enemy.x, y: nextY })) {
      this.enemyVelocity.y *= -1
      nextY = this.enemy.y + this.enemyVelocity.y * speedFactor * dt
    }
    this.enemy = {
      x: clamp(nextX, CELL_W * 2, BOARD_W - CELL_W * 2),
      y: clamp(nextY, CELL_H * 2, BOARD_H - CELL_H * 2),
    }
    if (this.trail.length > 1 && this.minDistanceToTrail(this.enemy) < STORM_RADIUS + TRAIL_RADIUS) {
      this.hit()
    }
  }

  private moveProbe(dt: number) {
    if (this.ratio() < 0.55) return
    if (!this.probe.active) {
      this.probeCooldown -= dt
      if (this.probeCooldown <= 0) {
        const aim = this.trail.length ? this.player : { x: BOARD_W / 2, y: BOARD_H / 2 }
        const dx = aim.x - this.enemy.x
        const dy = aim.y - this.enemy.y
        const magnitude = Math.hypot(dx, dy) || 1
        this.probe = {
          active: true,
          x: this.enemy.x,
          y: this.enemy.y,
          vx: (dx / magnitude) * 215,
          vy: (dy / magnitude) * 215,
          age: 0,
          warning: 0.26,
        }
        this.probeCooldown = 5.4
      }
      return
    }
    this.probe.age += dt
    this.probe.warning = Math.max(0, this.probe.warning - dt)
    if (this.probe.warning <= 0) {
      this.probe.x += this.probe.vx * dt
      this.probe.y += this.probe.vy * dt
      if (this.trail.length > 1 && this.minDistanceToTrail(this.probe) < 8) this.hit()
    }
    if (
      this.probe.age > 1.4 ||
      this.probe.x < 0 ||
      this.probe.y < 0 ||
      this.probe.x > BOARD_W ||
      this.probe.y > BOARD_H
    ) {
      this.probe.active = false
    }
  }

  private hit() {
    if (this.phase !== 'playing' || this.hitRecovery > 0) return
    this.lives -= 1
    this.combo = 0
    this.echoTrail = this.trail.map(point => ({ ...point }))
    this.echoKind = 'hit'
    this.hitPulse = 1
    this.message = '路径断裂'
    this.pointerActive = false
    this.cancelTrail('路径断裂')
    if (this.lives <= 0) {
      this.finish('failed-lives')
      return
    }
    this.phase = 'hit'
    this.hitRecovery = 1.2
  }

  private finish(phase: 'won' | 'failed-lives' | 'failed-time') {
    this.phase = phase
    this.pointerActive = false
    this.trail = []
    if (phase === 'won') {
      this.score += Math.floor(this.seconds) * 40 + this.lives * 500
    }
  }

  private ownedInteriorCount() {
    let count = 0
    for (let y = BORDER; y < GRID_H - BORDER; y += 1) {
      for (let x = BORDER; x < GRID_W - BORDER; x += 1) {
        count += this.occupied[this.index(x, y)]
      }
    }
    return count
  }

  private ratio() {
    return this.ownedInteriorCount() / ((GRID_W - BORDER * 2) * (GRID_H - BORDER * 2))
  }

  tick(dt: number) {
    if (this.phase === 'paused' || this.phase === 'won' || this.phase.startsWith('failed')) return
    const safeDt = Math.min(dt, 0.034)
    this.elapsed += safeDt
    this.capturePulse = Math.max(0, this.capturePulse - safeDt * 2.4)
    this.hitPulse = Math.max(0, this.hitPulse - safeDt * 3.4)
    this.touchPulse = Math.max(0, this.touchPulse - safeDt * 4.2)
    if (this.capturePulse <= 0 && this.hitPulse <= 0) {
      this.echoTrail = []
      this.echoKind = null
    }

    if (this.phase === 'hit') {
      this.hitRecovery -= safeDt
      if (this.hitRecovery <= 0) this.phase = 'playing'
      return
    }

    this.movePlayer(safeDt)
    if (this.releaseGrace > 0) {
      this.releaseGrace -= safeDt
      if (this.releaseGrace <= 0) {
        this.pointerActive = false
        if (this.trail.length > 0) {
          this.cancelTrail('撤回')
          this.combo = 0
        }
      }
    }
    this.moveEnemy(safeDt)
    this.moveProbe(safeDt)
    if (this.timerStarted) {
      this.seconds = Math.max(0, this.seconds - safeDt)
      if (this.seconds <= 0) this.finish('failed-time')
    }
  }

  snapshot(): EngineSnapshot {
    return {
      phase: this.phase,
      lives: this.lives,
      seconds: this.seconds,
      ratio: this.ratio(),
      score: this.score,
      combo: this.combo,
      trailLength: this.trailLength(),
      longestTrail: this.longestTrail,
      nearMisses: this.nearMisses,
      message: this.message,
      occupied: this.occupied.slice(),
      trail: this.trail.map(point => ({ ...point })),
      echoTrail: this.echoTrail.map(point => ({ ...point })),
      echoKind: this.echoKind,
      player: { ...this.player },
      target: { ...this.target },
      pointerActive: this.pointerActive,
      touchPoint: { ...this.touchPoint },
      enemy: { ...this.enemy },
      probe: { ...this.probe },
      capturePulse: this.capturePulse,
      capturePower: this.capturePower,
      hitPulse: this.hitPulse,
      touchPulse: this.touchPulse,
    }
  }

  forceWinForQa() {
    for (let y = GRID_H - 78; y < GRID_H - BORDER; y += 1) {
      for (let x = BORDER; x < GRID_W - BORDER; x += 1) {
        this.occupied[this.index(x, y)] = 1
      }
    }
    this.finish('won')
  }

  forceHitForQa() {
    this.phase = 'playing'
    this.trail = [{ x: BOARD_W / 2, y: BOARD_H * 0.91 }, { x: BOARD_W / 2, y: BOARD_H * 0.45 }]
    this.anchor = { ...this.trail[0] }
    this.hit()
  }

  forceCaptureForQa() {
    this.phase = 'playing'
    this.enemy = { x: BOARD_W * 0.25, y: BOARD_H * 0.28 }
    this.anchor = { x: BOARD_W * 0.5, y: BOARD_H * 0.91 }
    this.player = { x: BOARD_W - CELL_W * 1.5, y: BOARD_H * 0.7 }
    this.trail = [
      { ...this.anchor },
      { x: BOARD_W * 0.5, y: BOARD_H * 0.7 },
      { ...this.player },
    ]
    this.capture()
  }
}
