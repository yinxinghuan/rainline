export type Locale = 'zh' | 'en'

const zh = {
  title: '雨界',
  subtitle: 'RAINLINE',
  hint: '从亮边拖出去，再接回来',
  danger: '别让风暴切断雨线',
  paused: '雨势暂停',
  resume: '继续',
  retry: '再来一局',
  share: '分享结果',
  copied: '链接已复制',
  won: '雨停了',
  failedLives: '路径被风暴切断',
  failedTime: '暴雨吞没了时间',
  occupied: '已显影',
  score: '分数',
  longest: '最长路径',
  identityError: '身份暂时不可用',
  retryIdentity: '重试身份',
  muted: '开启声音',
  unmuted: '静音',
  pause: '暂停',
  lives: '生命',
  seconds: '剩余秒数',
  baseline: '效果诊断',
}

const en: typeof zh = {
  title: 'RAINLINE',
  subtitle: 'STORM CARTOGRAPHY',
  hint: 'Draw from the bright shore, then reconnect',
  danger: 'Keep the storm off your live line',
  paused: 'Rain paused',
  resume: 'Resume',
  retry: 'Run again',
  share: 'Share result',
  copied: 'Link copied',
  won: 'The rain cleared',
  failedLives: 'The storm severed your line',
  failedTime: 'The rain took the last second',
  occupied: 'Revealed',
  score: 'Score',
  longest: 'Longest line',
  identityError: 'Identity is temporarily unavailable',
  retryIdentity: 'Retry identity',
  muted: 'Turn sound on',
  unmuted: 'Mute',
  pause: 'Pause',
  lives: 'Lives',
  seconds: 'Seconds remaining',
  baseline: 'Effect diagnostics',
}

export function detectLocale(): Locale {
  const override = localStorage.getItem('game_locale')
  if (override === 'zh' || override === 'en') return override
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function makeT(locale: Locale) {
  const dict = locale === 'zh' ? zh : en
  return (key: keyof typeof zh) => dict[key]
}
