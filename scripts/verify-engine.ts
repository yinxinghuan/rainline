import { RainlineEngine } from '../src/Rainline/engine'

function advance(engine: RainlineEngine, seconds: number) {
  const steps = Math.ceil(seconds * 60)
  for (let index = 0; index < steps; index += 1) engine.tick(1 / 60)
}

const engine = new RainlineEngine()
const initial = engine.snapshot()
if (initial.ratio < 0.07 || initial.ratio > 0.1) {
  throw new Error(`Unexpected initial ratio: ${initial.ratio}`)
}

if (!engine.pointerDown({ x: 300, y: 482 })) {
  throw new Error('Could not start from the safe shoreline')
}
engine.pointerMove({ x: 300, y: 345 })
advance(engine, 0.72)
engine.pointerMove({ x: 354, y: 345 })
advance(engine, 0.34)
engine.pointerUp()
advance(engine, 0.2)

const captured = engine.snapshot()
if (captured.ratio <= initial.ratio) {
  throw new Error(`Capture did not increase owned ratio: ${initial.ratio} → ${captured.ratio}`)
}
if (captured.score <= 0 || captured.trail.length !== 0) {
  throw new Error(`Capture did not settle correctly: score=${captured.score}, trail=${captured.trail.length}`)
}

engine.forceHitForQa()
const hit = engine.snapshot()
if (hit.lives !== 2 || hit.phase !== 'hit') {
  throw new Error(`Hit contract failed: lives=${hit.lives}, phase=${hit.phase}`)
}

engine.forceWinForQa()
const won = engine.snapshot()
if (won.phase !== 'won' || won.ratio < 0.72) {
  throw new Error(`Win contract failed: ratio=${won.ratio}, phase=${won.phase}`)
}

console.log(JSON.stringify({
  initialRatio: initial.ratio,
  capturedRatio: captured.ratio,
  capturedScore: captured.score,
  livesAfterHit: hit.lives,
  winRatio: won.ratio,
}))
