import { useCallback, useEffect, useRef, useState } from 'react'
import { callAigramAPI, isInAigram, telegramId } from '@shared/runtime'
import type { PlayerIdentity } from './types'

type ProfileResponse = {
  retcode: number
  data?: {
    name?: string
    user_name?: string
    head_url?: string
  }
}

const params = new URLSearchParams(window.location.search)
const queryAvatar = params.get('avatar_url')?.trim() || ''
const queryName = params.get('user_name')?.trim() || ''
const defaultAvatar = new URL('./alteru-default-avatar.jpg', document.baseURI).href

export function useIdentity() {
  const requestId = useRef(0)
  const [identity, setIdentity] = useState<PlayerIdentity>(() => ({
    name: queryName || 'AlterU',
    avatarUrl: queryAvatar || defaultAvatar,
    source: queryAvatar || queryName ? 'query' : 'default',
    status: queryAvatar || queryName || !isInAigram ? 'ready' : 'loading',
  }))

  const load = useCallback(async () => {
    if (queryAvatar || queryName || !isInAigram || !telegramId) {
      setIdentity({
        name: queryName || 'AlterU',
        avatarUrl: queryAvatar || defaultAvatar,
        source: queryAvatar || queryName ? 'query' : 'default',
        status: 'ready',
      })
      return
    }
    const id = ++requestId.current
    setIdentity(current => ({ ...current, status: 'loading' }))
    try {
      const response = await callAigramAPI<ProfileResponse>(
        `/note/telegram/user/get/info/by/telegram_id?telegram_id=${encodeURIComponent(telegramId)}`,
        'GET',
      )
      if (id !== requestId.current) return
      const name = response?.data?.name?.trim() || response?.data?.user_name?.trim()
      if (!name) throw new Error('missing profile name')
      setIdentity({
        name,
        avatarUrl: response?.data?.head_url?.trim() || defaultAvatar,
        source: response?.data?.head_url?.trim() ? 'player' : 'default',
        status: 'ready',
      })
    } catch {
      if (id !== requestId.current) return
      setIdentity({
        name: '',
        avatarUrl: defaultAvatar,
        source: 'default',
        status: 'error',
      })
    }
  }, [])

  useEffect(() => {
    void load()
    return () => {
      requestId.current += 1
    }
  }, [load])

  return { identity, retry: load, isInAigram }
}
