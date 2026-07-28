import { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { BOARD_H, BOARD_W, EngineSnapshot, GRID_H, GRID_W } from './types'
import { RainlineEngine } from './engine'
import { drawRainline } from './render'
import { drawPortraitField } from './portrait'
import { RainlineAudio } from './audio'
import { detectLocale, makeT } from './i18n'
import { useIdentity } from './useIdentity'
import Icon from './Icon'
import alteruSrc from './img/alteru.svg'
import './Rainline.less'

declare global {
  interface Window {
    __RAINLINE_QA__?: {
      snapshot: () => EngineSnapshot
      forceWin: () => void
      forceHit: () => void
      forceCapture: () => void
      reset: () => void
      identity: () => string
    }
  }
}

const baseline = new URLSearchParams(window.location.search).get('baseline') === '1'
const qaMode = new URLSearchParams(window.location.search).get('qa')

function occupiedRuns(occupied: Uint8Array) {
  const runs: Array<{ x: number; y: number; width: number }> = []
  for (let y = 0; y < GRID_H; y += 1) {
    let start = -1
    for (let x = 0; x <= GRID_W; x += 1) {
      const on = x < GRID_W && occupied[y * GRID_W + x] === 1
      if (on && start < 0) start = x
      if ((!on || x === GRID_W) && start >= 0) {
        runs.push({ x: start, y, width: x - start })
        start = -1
      }
    }
  }
  return runs
}

export default function Rainline() {
  const engine = useRef(new RainlineEngine())
  const ghostEngine = useRef(new RainlineEngine())
  const ghostClock = useRef(0)
  const ghostStage = useRef(0)
  const audio = useRef(new RainlineAudio())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const portraitCanvasRef = useRef<HTMLCanvasElement>(null)
  const portraitImageRef = useRef<HTMLImageElement | null>(null)
  const lastPortraitDraw = useRef(0)
  const boardRef = useRef<HTMLDivElement>(null)
  const pageVisible = useRef(!document.hidden)
  const boardVisible = useRef(true)
  const keyboardActive = useRef(false)
  const interactedRef = useRef(false)
  const [snapshot, setSnapshot] = useState(() => engine.current.snapshot())
  const [visualSnapshot, setVisualSnapshot] = useState(() => ghostEngine.current.snapshot())
  const [muted, setMuted] = useState(true)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [copied, setCopied] = useState(false)
  const [bestScore, setBestScore] = useState(() => Number(localStorage.getItem('rainline_best') || 0))
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const { identity, retry: retryIdentity } = useIdentity()
  const locale = useMemo(detectLocale, [])
  const t = useMemo(() => makeT(locale), [locale])
  const runs = useMemo(() => occupiedRuns(visualSnapshot.occupied), [visualSnapshot.occupied])
  const previous = useRef(snapshot)
  const qaApplied = useRef(false)

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      portraitImageRef.current = image
    }
    image.onerror = () => {
      portraitImageRef.current = null
    }
    image.src = identity.avatarUrl
    return () => {
      image.onload = null
      image.onerror = null
      if (portraitImageRef.current === image) portraitImageRef.current = null
    }
  }, [identity.avatarUrl])

  useEffect(() => {
    const node = boardRef.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => {
      boardVisible.current = entry.isIntersecting && entry.intersectionRatio >= 0.15
    }, { threshold: [0, 0.15, 1] })
    observer.observe(node)
    const onVisibility = () => {
      pageVisible.current = !document.hidden
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    if (qaApplied.current) return
    qaApplied.current = true
    if (qaMode === 'win') engine.current.forceWinForQa()
    if (qaMode === 'hit') engine.current.forceHitForQa()
    if (qaMode === 'capture') engine.current.forceCaptureForQa()
  }, [])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let lastUi = 0
    const frame = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      if (!pageVisible.current || !boardVisible.current) {
        raf = requestAnimationFrame(frame)
        return
      }
      engine.current.tick(dt)
      const current = engine.current.snapshot()
      let visual = current
      if (!interactedRef.current && !baseline && !qaMode) {
        ghostClock.current += Math.min(dt, 0.034)
        if (ghostStage.current === 0) {
          ghostEngine.current.reset()
          ghostEngine.current.pointerDown({ x: 300, y: 482 })
          ghostEngine.current.pointerMove({ x: 300, y: 345 })
          ghostStage.current = 1
        }
        if (ghostStage.current === 1 && ghostClock.current >= 0.72) {
          ghostEngine.current.pointerMove({ x: 354, y: 345 })
          ghostStage.current = 2
        }
        if (ghostStage.current === 2 && ghostClock.current >= 1.06) {
          ghostEngine.current.pointerUp()
          ghostStage.current = 3
        }
        if (ghostClock.current >= 2.5) {
          ghostClock.current = 0
          ghostStage.current = 0
        }
        ghostEngine.current.tick(dt)
        visual = ghostEngine.current.snapshot()
      }
      const portraitInterval = reducedMotion
        ? 100
        : visual.phase === 'won' || visual.phase.startsWith('failed')
          ? 66
          : 33
      if (portraitCanvasRef.current && now - lastPortraitDraw.current >= portraitInterval) {
        drawPortraitField(portraitCanvasRef.current, portraitImageRef.current, visual, now / 1000, reducedMotion)
        lastPortraitDraw.current = now
      }
      if (canvasRef.current) drawRainline(canvasRef.current, visual, now / 1000, reducedMotion, baseline)
      if (now - lastUi > 70) {
        setSnapshot(current)
        setVisualSnapshot(visual)
        lastUi = now
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [reducedMotion])

  useEffect(() => {
    const prior = previous.current
    if (snapshot.capturePulse > prior.capturePulse) {
      const bigCapture = snapshot.capturePower >= 0.62
      audio.current.capture(bigCapture)
      if (hasInteracted && navigator.vibrate) navigator.vibrate(bigCapture ? [18, 24, 34] : 14)
    }
    if (snapshot.hitPulse > prior.hitPulse) {
      audio.current.hit()
      if (hasInteracted && navigator.vibrate) navigator.vibrate([35, 28, 58])
    }
    if (snapshot.phase === 'won' && prior.phase !== 'won') {
      audio.current.win()
      if (hasInteracted && navigator.vibrate) navigator.vibrate([18, 30, 24, 34, 70])
    }
    if (snapshot.phase.startsWith('failed') && !prior.phase.startsWith('failed')) audio.current.lose()
    if ((snapshot.phase === 'won' || snapshot.phase.startsWith('failed')) && snapshot.score > bestScore) {
      setBestScore(snapshot.score)
      localStorage.setItem('rainline_best', String(snapshot.score))
    }
    previous.current = snapshot
  }, [snapshot, bestScore, hasInteracted])

  useEffect(() => {
    window.__RAINLINE_QA__ = {
      snapshot: () => engine.current.snapshot(),
      forceWin: () => engine.current.forceWinForQa(),
      forceHit: () => engine.current.forceHitForQa(),
      forceCapture: () => engine.current.forceCaptureForQa(),
      reset: () => engine.current.reset(),
      identity: () => identity.source,
    }
    return () => {
      delete window.__RAINLINE_QA__
    }
  }, [identity.source])

  const pointFromEvent = (event: ReactPointerEvent) => {
    const rect = boardRef.current!.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * BOARD_W,
      y: ((event.clientY - rect.top) / rect.height) * BOARD_H,
    }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || snapshot.phase === 'paused') return
    const accepted = engine.current.pointerDown(pointFromEvent(event))
    if (!accepted) return
    event.currentTarget.setPointerCapture(event.pointerId)
    interactedRef.current = true
    setHasInteracted(true)
    audio.current.ripple()
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    engine.current.pointerMove(pointFromEvent(event))
  }

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    engine.current.pointerUp()
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const direction: Record<string, { x: number; y: number }> = {
      ArrowUp: { x: 0, y: -36 },
      ArrowDown: { x: 0, y: 36 },
      ArrowLeft: { x: -36, y: 0 },
      ArrowRight: { x: 36, y: 0 },
    }
    const delta = direction[event.key]
    if (delta) {
      event.preventDefault()
      if (!keyboardActive.current) {
        keyboardActive.current = engine.current.pointerDown(snapshot.player)
        if (keyboardActive.current) {
          interactedRef.current = true
          setHasInteracted(true)
        }
      }
      if (keyboardActive.current) {
        engine.current.pointerMove({
          x: snapshot.player.x + delta.x,
          y: snapshot.player.y + delta.y,
        })
      }
      return
    }
    if ((event.key === ' ' || event.key === 'Enter') && keyboardActive.current) {
      event.preventDefault()
      engine.current.pointerUp()
      keyboardActive.current = false
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      togglePause()
    }
  }

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    audio.current.setMuted(next)
  }

  const togglePause = () => engine.current.togglePause()

  const restart = () => {
    engine.current.reset()
    setCopied(false)
    interactedRef.current = false
    ghostClock.current = 0
    ghostStage.current = 0
    setHasInteracted(false)
    boardRef.current?.focus()
  }

  const share = async () => {
    const text = locale === 'zh'
      ? `我在暴雨里清出了 ${Math.round(snapshot.ratio * 100)}% 的 Rainline。你能留下更完整的肖像吗？`
      : `I cleared ${Math.round(snapshot.ratio * 100)}% of Rainline. Can you reveal a fuller portrait?`
    try {
      if (navigator.share) await navigator.share({ title: 'Rainline', text, url: location.href })
      else {
        await navigator.clipboard.writeText(`${text} ${location.href}`)
        setCopied(true)
      }
    } catch {
      // User cancellation and unavailable clipboard are intentionally non-fatal.
    }
  }

  const result = snapshot.phase === 'won' || snapshot.phase.startsWith('failed')
  const portraitLabel = identity.name || t('identityError')
  const clipId = 'rainline-owned'
  const maskId = 'rainline-points'
  const title = snapshot.phase === 'won'
    ? t('won')
    : snapshot.phase === 'failed-time'
      ? t('failedTime')
      : t('failedLives')

  return (
    <main className={[
      'rl',
      snapshot.phase === 'hit' ? 'rl--hit' : '',
      snapshot.trail.length > 1 ? 'rl--drawing' : '',
      snapshot.capturePulse > 0 ? 'rl--capture' : '',
    ].filter(Boolean).join(' ')}>
      <header className="rl__header">
        <div className="rl__lockup">
          <span className="rl__eyebrow">{t('subtitle')}</span>
          <h1>{t('title')}</h1>
        </div>
        <div className="rl__identity" title={portraitLabel}>
          <span className="rl__identity-source">{identity.status === 'loading' ? 'SYNC' : identity.source.toUpperCase()}</span>
          <span className="rl__identity-name">{portraitLabel}</span>
        </div>
      </header>

      <section className="rl__hud" aria-label="Game status">
        <div className="rl__lives" aria-label={`${t('lives')}: ${snapshot.lives}`}>
          {[0, 1, 2].map(index => <span key={index} className={index < snapshot.lives ? 'is-live' : 'is-lost'} />)}
        </div>
        <div className={`rl__time ${snapshot.seconds <= 10 ? 'is-danger' : ''}`} aria-label={`${t('seconds')}: ${Math.ceil(snapshot.seconds)}`}>
          <strong>{Math.ceil(snapshot.seconds).toString().padStart(2, '0')}</strong>
          <span>SEC</span>
        </div>
        <div className="rl__ratio" aria-label={`${t('occupied')}: ${Math.round(snapshot.ratio * 100)}%`}>
          <strong>{Math.round(snapshot.ratio * 100)}%</strong>
          <span>{t('occupied')}</span>
        </div>
      </section>

      <div
        ref={boardRef}
        className="rl__board"
        role="application"
        tabIndex={0}
        aria-label={`${t('hint')}. Arrow keys move the line; Space closes or withdraws. ${t('occupied')} ${Math.round(snapshot.ratio * 100)}%.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
      >
        <svg className="rl__portrait" viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} preserveAspectRatio="xMidYMid slice" aria-label={portraitLabel}>
          <defs>
            <clipPath id={clipId}>
              {runs.map((run, index) => (
                <rect key={index} x={run.x * (BOARD_W / GRID_W)} y={run.y * (BOARD_H / GRID_H)} width={run.width * (BOARD_W / GRID_W) + 0.7} height={BOARD_H / GRID_H + 0.7} />
              ))}
            </clipPath>
            <pattern id="rl-dot-grid" width="6" height="6" patternUnits="userSpaceOnUse">
              <circle cx="3" cy="3" r={result ? 3 : 2.35} fill="white" />
            </pattern>
            <mask id={maskId}>
              <rect width={BOARD_W} height={BOARD_H} fill={`url(#rl-dot-grid)`} clipPath={`url(#${clipId})`} />
            </mask>
          </defs>
          <image
            href={identity.avatarUrl}
            width={BOARD_W}
            height={BOARD_H}
            preserveAspectRatio="xMidYMid slice"
            mask={`url(#${maskId})`}
            className="rl__portrait-image"
          />
        </svg>
        <canvas ref={portraitCanvasRef} className="rl__portrait-particles" aria-hidden="true" />
        <canvas ref={canvasRef} className="rl__canvas" />

        {!hasInteracted && !qaMode && !result && snapshot.phase !== 'paused' && (
          <div className="rl__guide" aria-hidden="true">
            <span className="rl__guide-finger" />
            <p>{t('hint')}</p>
          </div>
        )}

        {snapshot.message && (snapshot.phase === 'playing' || snapshot.phase === 'hit') && (
          <output className={`rl__feedback ${snapshot.phase === 'hit' ? 'is-danger' : ''}`} aria-live="polite">
            {snapshot.message}
          </output>
        )}

        {baseline && <div className="rl__diagnostic">{t('baseline')} · CPU GEOMETRY · DOM IDENTITY</div>}

        {snapshot.phase === 'paused' && (
          <div className="rl__overlay rl__overlay--pause">
            <span className="rl__section-label">HOLD STATE</span>
            <h2>{t('paused')}</h2>
            <button type="button" className="rl__primary" onClick={togglePause}>
              <Icon name="play" /> {t('resume')}
            </button>
          </div>
        )}

        {result && (
          <div className="rl__overlay rl__overlay--result">
            <span className="rl__section-label">{snapshot.phase === 'won' ? 'CLEAR WEATHER' : 'STORM RECORD'}</span>
            <h2>{title}</h2>
            <p className="rl__result-name">{portraitLabel}</p>
            <strong className="rl__result-score">{snapshot.score.toLocaleString()}</strong>
            <div className="rl__result-stats">
              <span><b>{Math.round(snapshot.ratio * 100)}%</b>{t('occupied')}</span>
              <span><b>{Math.round(snapshot.longestTrail)}</b>{t('longest')}</span>
              <span><b>{bestScore.toLocaleString()}</b>BEST</span>
            </div>
            <div className="rl__result-actions">
              <button type="button" className="rl__primary" onClick={restart}><Icon name="retry" /> {t('retry')}</button>
              {(snapshot.phase === 'won' || snapshot.ratio >= 0.4) && (
                <button type="button" className="rl__secondary" onClick={() => void share()}><Icon name="share" /> {copied ? t('copied') : t('share')}</button>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="rl__footer">
        <div className="rl__score">
          <span>{t('score')}</span>
          <strong>{snapshot.score.toLocaleString()}</strong>
          {snapshot.combo > 1 && <em>×{snapshot.combo.toFixed(1)}</em>}
        </div>
        <div className="rl__controls">
          <button type="button" onClick={toggleMute} aria-label={muted ? t('muted') : t('unmuted')}>
            <Icon name={muted ? 'mute' : 'sound'} />
          </button>
          <button type="button" onClick={togglePause} aria-label={t('pause')} disabled={result}>
            <Icon name="pause" />
          </button>
        </div>
      </footer>

      {identity.status === 'error' && !result && (
        <div className="rl__identity-error" role="status">
          <span>{t('identityError')}</span>
          <button type="button" onClick={() => void retryIdentity()}>{t('retryIdentity')}</button>
        </div>
      )}

      <img className="rl__watermark" src={alteruSrc} alt="" aria-hidden="true" draggable={false} />
      <p className="rl__sr" aria-live="polite">
        {snapshot.phase === 'hit' ? t('danger') : snapshot.message}
      </p>
    </main>
  )
}
