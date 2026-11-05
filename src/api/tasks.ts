import { supabase } from '../lib/supabase'
import type { Task, TaskHistoryEntry, TaskStatus, TaskWithRelations } from '../types'

const TASK_FIELDS =
  'id, title, description, object_id, assignee_id, author_id, status, created_at, updated_at'

const TASK_WITH_RELATIONS = [
  TASK_FIELDS,
  'assignee:profiles!tasks_assignee_id_fkey(id, email, full_name, role)',
  'author:profiles!tasks_author_id_fkey(id, email, full_name, role)',
  'object:objects(id, name)',
].join(', ')

const HISTORY_FIELDS = [
  'id, task_id, changed_by, from_status, to_status, comment, created_at',
  'actor:profiles!task_history_changed_by_fkey(id, email, full_name, role)',
].join(', ')

export interface TaskInput {
  title: string
  description: string | null
  assigneeId: string | null
}

export async function fetchTasksByObject(objectId: string): Promise<TaskWithRelations[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_WITH_RELATIONS)
    .eq('object_id', objectId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as unknown as TaskWithRelations[]
}

export async function fetchMyTasks(userId: string): Promise<TaskWithRelations[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_WITH_RELATIONS)
    .eq('assignee_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as unknown as TaskWithRelations[]
}

export async function fetchTask(taskId: string): Promise<TaskWithRelations | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_WITH_RELATIONS)
    .eq('id', taskId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (data as TaskWithRelations | null) ?? null
}

export async function createTask(
  objectId: string,
  input: TaskInput,
  authorId: string,
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: input.title,
      description: input.description,
      assignee_id: input.assigneeId,
      object_id: objectId,
      author_id: authorId,
    })
    .select(TASK_FIELDS)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as Task
}

export async function updateTask(taskId: string, input: TaskInput): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({
      title: input.title,
      description: input.description,
      assignee_id: input.assigneeId,
    })
    .eq('id', taskId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)

  if (error) {
    if (error.code === '42501' || /row-level security/i.test(error.message)) {
      throw new Error('Удалить задачу можно только в статусе «Новая».')
    }

    throw new Error(error.message)
  }
}

export async function changeTaskStatus(
  taskId: string,
  status: TaskStatus,
  comment: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('change_task_status', {
    p_task_id: taskId,
    p_new_status: status,
    p_comment: comment,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function fetchTaskHistory(taskId: string): Promise<TaskHistoryEntry[]> {
  const { data, error } = await supabase
    .from('task_history')
    .select(HISTORY_FIELDS)
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as unknown as TaskHistoryEntry[]
}
