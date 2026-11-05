import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { fetchProfile } from '../api/profiles'
import { authErrorMessage, toErrorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'
import { AuthContext } from './context'
import type { AuthContextValue } from './context'

interface ProfileState {
  /** Для какого пользователя загружен профиль, чтобы не показывать данные предыдущего. */
  userId: string | null
  profile: Profile | null
  error: string | null
}

const EMPTY_PROFILE_STATE: ProfileState = { userId: null, profile: null, error: null }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [profileState, setProfileState] = useState<ProfileState>(EMPTY_PROFILE_STATE)
  const [profileReloadKey, setProfileReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) {
        return
      }

      setSession(data.session)
      setSessionLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setSessionLoading(false)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!userId) {
      return
    }

    let active = true

    fetchProfile(userId)
      .then((nextProfile) => {
        if (!active) {
          return
        }

        setProfileState({
          userId,
          profile: nextProfile,
          error: nextProfile ? null : 'Профиль не найден. Обратитесь к администратору системы.',
        })
      })
      .catch((error: unknown) => {
        if (!active) {
          return
        }

        setProfileState({ userId, profile: null, error: toErrorMessage(error) })
      })

    return () => {
      active = false
    }
  }, [userId, profileReloadKey])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      throw new Error(authErrorMessage(error.message))
    }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const reloadProfile = useCallback(async () => {
    setProfileReloadKey((key) => key + 1)
  }, [])

  // Данные профиля показываем только для актуального пользователя.
  const currentProfile = profileState.userId === userId ? profileState.profile : null
  const profileError = profileState.userId === userId ? profileState.error : null

  // Пока сессия есть, а профиль ещё не загружен и ошибки нет — считаем, что идёт загрузка.
  const loading =
    sessionLoading || (Boolean(userId) && currentProfile === null && profileError === null)

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile: currentProfile,
      loading,
      profileError,
      signIn,
      signOut,
      reloadProfile,
    }),
    [session, currentProfile, loading, profileError, signIn, signOut, reloadProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
