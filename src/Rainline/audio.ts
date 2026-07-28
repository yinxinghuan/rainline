export class RainlineAudio {
  private context: AudioContext | null = null
  muted = true

  setMuted(muted: boolean) {
    this.muted = muted
    if (!muted) void this.ensure()
  }

  private async ensure() {
    if (!this.context) this.context = new AudioContext()
    if (this.context.state === 'suspended') await this.context.resume()
    return this.context
  }

  async tone(from: number, to: number, duration: number, volume: number, type: OscillatorType = 'sine') {
    if (this.muted) return
    try {
      const context = await this.ensure()
      const now = context.currentTime
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = type
      oscillator.frequency.setValueAtTime(from, now)
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + duration + 0.02)
    } catch {
      this.muted = true
    }
  }

  ripple() {
    void this.tone(420, 620, 0.09, 0.08)
  }

  capture(big: boolean) {
    void this.tone(big ? 420 : 360, big ? 840 : 630, big ? 0.28 : 0.18, 0.11, 'triangle')
  }

  hit() {
    void this.tone(180, 62, 0.26, 0.14, 'sawtooth')
  }

  win() {
    void this.tone(392, 784, 0.6, 0.13, 'sine')
  }

  lose() {
    void this.tone(220, 130, 0.48, 0.11, 'triangle')
  }
}
