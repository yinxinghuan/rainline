declare module '@shared/runtime' {
  export const telegramId: string | null
  export const isInAigram: boolean
  export function callAigramAPI<T>(
    url: string,
    method?: 'GET' | 'POST',
    data?: unknown,
  ): Promise<T>
}
