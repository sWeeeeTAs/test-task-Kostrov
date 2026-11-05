import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '../types'

export interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  profileError: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  reloadProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
