import { supabase } from '../lib/supabase'
import type { ObjectTaskSummary, ProjectObject, TaskStatus } from '../types'

const OBJECT_FIELDS = 'id, name, address, created_by, created_at'

export interface ObjectInput {
  name: string
  address: string | null
}

export function emptyTaskSummary(): ObjectTaskSummary {
  return {
    total: 0,
    byStatus: {
      new: 0,
      in_progress: 0,
      on_review: 0,
      rework: 0,
      accepted: 0,
    },
  }
}

export async function fetchObjects(): Promise<ProjectObject[]> {
  const { data, error } = await supabase
    .from('objects')
    .select(OBJECT_FIELDS)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as ProjectObject[]
}

export async function fetchObject(objectId: string): Promise<ProjectObject | null> {
  const { data, error } = await supabase
    .from('objects')
    .select(OBJECT_FIELDS)
    .eq('id', objectId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (data as ProjectObject | null) ?? null
}

export async function createObject(input: ObjectInput, authorId: string): Promise<ProjectObject> {
  const { data, error } = await supabase
    .from('objects')
    .insert({ name: input.name, address: input.address, created_by: authorId })
    .select(OBJECT_FIELDS)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as ProjectObject
}

export async function updateObject(objectId: string, input: ObjectInput): Promise<void> {
  const { error } = await supabase
    .from('objects')
    .update({ name: input.name, address: input.address })
    .eq('id', objectId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function deleteObject(objectId: string): Promise<void> {
  const { error } = await supabase.from('objects').delete().eq('id', objectId)

  if (error) {
    if (error.code === '23503') {
      throw new Error('Нельзя удалить объект, пока в нём есть задачи. Сначала удалите задачи.')
    }

    throw new Error(error.message)
  }
}

/** Сводка по задачам для счётчиков в списке объектов (RLS отфильтрует чужие задачи). */
export async function fetchTaskSummaries(): Promise<Record<string, ObjectTaskSummary>> {
  const { data, error } = await supabase.from('tasks').select('object_id, status')

  if (error) {
    throw new Error(error.message)
  }

  const summaries: Record<string, ObjectTaskSummary> = {}

  for (const row of (data ?? []) as Array<{ object_id: string; status: TaskStatus }>) {
    const summary = summaries[row.object_id] ?? emptyTaskSummary()
    summary.total += 1

    if (row.status in summary.byStatus) {
      summary.byStatus[row.status] += 1
    }

    summaries[row.object_id] = summary
  }

  return summaries
}
