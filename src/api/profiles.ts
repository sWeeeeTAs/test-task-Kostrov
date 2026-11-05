import { supabase } from '../lib/supabase'
import type { Profile, ProfileSummary } from '../types'

const PROFILE_FIELDS = 'id, email, full_name, role'
const PROFILE_FIELDS_WITH_DATE = 'id, email, full_name, role, created_at'

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_FIELDS_WITH_DATE)
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (data as Profile | null) ?? null
}

/** Постановщику RLS разрешает читать все профили, поэтому список исполнителей доступен. */
export async function fetchExecutors(): Promise<ProfileSummary[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_FIELDS)
    .eq('role', 'executor')
    .order('full_name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as ProfileSummary[]
}
