type IconName = 'pause' | 'play' | 'sound' | 'mute' | 'retry' | 'share'

export default function Icon({ name }: { name: IconName }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {name === 'pause' && <><path {...common} d="M8 5v14M16 5v14" /></>}
      {name === 'play' && <path {...common} d="m8 5 11 7-11 7Z" />}
      {name === 'sound' && <><path {...common} d="M5 10v4h3l4 4V6L8 10H5Z" /><path {...common} d="M16 9c1.4 1.6 1.4 4.4 0 6M18.5 6.5c3 3 3 8 0 11" /></>}
      {name === 'mute' && <><path {...common} d="M5 10v4h3l4 4V6L8 10H5Z" /><path {...common} d="m16 9 5 6m0-6-5 6" /></>}
      {name === 'retry' && <><path {...common} d="M19 8a8 8 0 1 0 1 7" /><path {...common} d="M19 4v4h-4" /></>}
      {name === 'share' && <><path {...common} d="M12 15V3m0 0L8 7m4-4 4 4" /><path {...common} d="M5 12v7h14v-7" /></>}
    </svg>
  )
}
