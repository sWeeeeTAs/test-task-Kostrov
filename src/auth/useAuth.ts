import { useContext } from 'react'
import { AuthContext } from './context'
import type { AuthContextValue } from './context'

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)

  if (!value) {
    throw new Error('useAuth должен использоваться внутри AuthProvider')
  }

  return value
}
