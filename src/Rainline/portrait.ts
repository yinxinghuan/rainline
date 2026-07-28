import { BOARD_H, BOARD_W, EngineSnapshot, GRID_H, GRID_W } from './types'

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function sourceCrop(image: HTMLImageElement) {
  const boardRatio = BOARD_W / BOARD_H
  const imageRatio = image.naturalWidth / image.naturalHeight
  if (imageRatio > boardRatio) {
    const width = image.naturalHeight * boardRatio
    return {
      x: (image.naturalWidth - width) / 2,
      y: 0,
      width,
      height: image.naturalHeight,
    }
  }
  const height = image.naturalWidth / boardRatio
  return {
    x: 0,
    y: (image.naturalHeight - height) / 2,
    width: image.naturalWidth,
    height,
  }
}

export function drawPortraitField(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement | null,
  snapshot: EngineSnapshot,
  time: number,
  reducedMotion: boolean,
) {
  const rect = canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, rect.width <= 330 ? 1 : 1.35)
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
  if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return

  const columns = rect.width <= 330 ? 38 : 48
  const rows = Math.round(columns * (BOARD_H / BOARD_W))
  const dotW = BOARD_W / columns
  const dotH = BOARD_H / rows
  const crop = sourceCrop(image)
  const sourceW = crop.width / columns
  const sourceH = crop.height / rows
  const result = snapshot.phase === 'won' || snapshot.phase.startsWith('failed')
  const gap = result ? 0.7 : 1.55
  const localRadius = result ? 84 : 62
  const localPoint = snapshot.pointerActive ? snapshot.touchPoint : snapshot.player
  const echoPoint = snapshot.echoTrail[snapshot.echoTrail.length - 1]

  ctx.save()
  ctx.globalAlpha = result ? 0.94 : 0.78
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const boardX = (column + 0.5) * dotW
      const boardY = (row + 0.5) * dotH
      const gridX = clamp(Math.floor((boardX / BOARD_W) * GRID_W), 0, GRID_W - 1)
      const gridY = clamp(Math.floor((boardY / BOARD_H) * GRID_H), 0, GRID_H - 1)
      if (!snapshot.occupied[gridY * GRID_W + gridX]) continue

      let offsetX = 0
      let offsetY = 0
      if (!reducedMotion) {
        const dx = boardX - localPoint.x
        const dy = boardY - localPoint.y
        const distance = Math.hypot(dx, dy) || 1
        if (distance < localRadius) {
          const influence = (1 - distance / localRadius) ** 2
          const wave = Math.sin(time * 14 - distance * 0.18)
          offsetX += (dx / distance) * influence * (5.5 + wave * 2.8)
          offsetY += (dy / distance) * influence * (5.5 + wave * 2.8)
          offsetX += (-dy / distance) * influence * 2.8
          offsetY += (dx / distance) * influence * 2.8
        }
        if (echoPoint && snapshot.capturePulse > 0) {
          const echoDx = boardX - echoPoint.x
          const echoDy = boardY - echoPoint.y
          const echoDistance = Math.hypot(echoDx, echoDy) || 1
          const ringDistance = (1 - snapshot.capturePulse) * 130
          const ring = Math.max(0, 1 - Math.abs(echoDistance - ringDistance) / 24)
          offsetX += (echoDx / echoDistance) * ring * snapshot.capturePower * 12
          offsetY += (echoDy / echoDistance) * ring * snapshot.capturePower * 12
        }
      }

      const sourceX = crop.x + column * sourceW
      const sourceY = crop.y + row * sourceH
      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sourceW,
        sourceH,
        column * dotW + gap / 2 + offsetX,
        row * dotH + gap / 2 + offsetY,
        dotW - gap,
        dotH - gap,
      )
    }
  }
  ctx.restore()
}
