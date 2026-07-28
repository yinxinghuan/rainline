export const BOARD_W = 360
export const BOARD_H = 522
export const GRID_W = 72
export const GRID_H = 104
export const ROUND_SECONDS = 75
export const START_LIVES = 3
export const WIN_RATIO = 0.72

export type Point = { x: number; y: number }
export type Phase = 'ready' | 'playing' | 'hit' | 'won' | 'failed-lives' | 'failed-time' | 'paused'

export type Probe = {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  age: number
  warning: number
}

export type EngineSnapshot = {
  phase: Phase
  lives: number
  seconds: number
  ratio: number
  score: number
  combo: number
  trailLength: number
  longestTrail: number
  nearMisses: number
  message: string
  occupied: Uint8Array
  trail: Point[]
  player: Point
  enemy: Point
  probe: Probe
  capturePulse: number
  hitPulse: number
}

export type PlayerIdentity = {
  name: string
  avatarUrl: string
  source: 'query' | 'player' | 'default'
  status: 'loading' | 'ready' | 'error'
}
