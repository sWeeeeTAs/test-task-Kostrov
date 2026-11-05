import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Во фронтенд попадает только anon-ключ: доступ к данным ограничивают RLS-политики.
 * service_role использовать на клиенте нельзя.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = createClient(
  supabaseUrl ?? 'http://127.0.0.1:54321',
  supabaseAnonKey ?? 'missing-anon-key',
)
