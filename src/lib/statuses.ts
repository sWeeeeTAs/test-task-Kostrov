import type { Profile, Task, TaskStatus } from '../types'

export const STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  on_review: 'На проверке',
  rework: 'На доработке',
  accepted: 'Принята',
}

export const STATUS_ORDER: TaskStatus[] = [
  'new',
  'in_progress',
  'on_review',
  'rework',
  'accepted',
]

export type CommentMode = 'hidden' | 'optional' | 'required'

export interface TaskAction {
  to: TaskStatus
  label: string
  tone: 'primary' | 'danger' | 'neutral'
  comment: CommentMode
  commentLabel: string
  commentPlaceholder: string
  dialogTitle: string
  dialogDescription: string
}

const TAKE_TO_WORK: TaskAction = {
  to: 'in_progress',
  label: 'Взять в работу',
  tone: 'primary',
  comment: 'hidden',
  commentLabel: '',
  commentPlaceholder: '',
  dialogTitle: 'Взять задачу в работу',
  dialogDescription: 'Задача перейдёт в статус «В работе».',
}

const SEND_TO_REVIEW: TaskAction = {
  to: 'on_review',
  label: 'Отправить на проверку',
  tone: 'primary',
  comment: 'optional',
  commentLabel: 'Комментарий (необязательно)',
  commentPlaceholder: 'Что сделано по задаче',
  dialogTitle: 'Отправить на проверку',
  dialogDescription: 'Постановщик увидит задачу в статусе «На проверке».',
}

const ACCEPT_TASK: TaskAction = {
  to: 'accepted',
  label: 'Принять',
  tone: 'primary',
  comment: 'optional',
  commentLabel: 'Комментарий (необязательно)',
  commentPlaceholder: 'Комментарий к приёмке',
  dialogTitle: 'Принять задачу',
  dialogDescription: 'Задача перейдёт в статус «Принята».',
}

const RETURN_TO_REWORK: TaskAction = {
  to: 'rework',
  label: 'Вернуть на доработку',
  tone: 'danger',
  comment: 'required',
  commentLabel: 'Что нужно доработать (обязательно)',
  commentPlaceholder: 'Опишите, что нужно исправить',
  dialogTitle: 'Вернуть на доработку',
  dialogDescription: 'Исполнитель увидит комментарий в карточке задачи.',
}

/**
 * Действия, доступные текущему пользователю в текущем статусе.
 * Полностью повторяет таблицу переходов из ТЗ; сервер проверяет то же самое.
 */
export function getTaskActions(task: Task, profile: Profile | null): TaskAction[] {
  if (!profile) {
    return []
  }

  const isAssignee = task.assignee_id === profile.id

  if (profile.role === 'executor' && isAssignee) {
    if (task.status === 'new' || task.status === 'rework') {
      return [TAKE_TO_WORK]
    }

    if (task.status === 'in_progress') {
      return [SEND_TO_REVIEW]
    }

    return []
  }

  if (profile.role === 'tasker' && task.status === 'on_review') {
    return [ACCEPT_TASK, RETURN_TO_REWORK]
  }

  return []
}

export function isTasker(profile: Profile | null): boolean {
  return profile?.role === 'tasker'
}

/** Исполнителя можно менять только до фактического начала работы. */
export function canChangeAssignee(task: Task): boolean {
  return task.status === 'new' || task.status === 'rework'
}

export function canDeleteTask(task: Task, profile: Profile | null): boolean {
  return isTasker(profile) && task.status === 'new'
}

export function taskActionClass(action: TaskAction): string {
  if (action.tone === 'primary') {
    return 'btn btn-primary'
  }

  if (action.tone === 'danger') {
    return 'btn btn-danger'
  }

  return 'btn btn-secondary'
}
