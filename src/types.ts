export type Role = 'tasker' | 'executor'

export type TaskStatus = 'new' | 'in_progress' | 'on_review' | 'accepted' | 'rework'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Role
  created_at: string
}

export interface ProfileSummary {
  id: string
  email: string
  full_name: string | null
  role: Role
}

export interface ProjectObject {
  id: string
  name: string
  address: string | null
  created_by: string
  created_at: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  object_id: string
  assignee_id: string | null
  author_id: string
  status: TaskStatus
  created_at: string
  updated_at: string
}

export interface TaskWithRelations extends Task {
  assignee: ProfileSummary | null
  author: ProfileSummary | null
  object: Pick<ProjectObject, 'id' | 'name'> | null
}

export interface TaskHistoryEntry {
  id: number
  task_id: string
  changed_by: string
  from_status: TaskStatus | null
  to_status: TaskStatus
  comment: string | null
  created_at: string
  actor: ProfileSummary | null
}

export interface ObjectTaskSummary {
  total: number
  byStatus: Record<TaskStatus, number>
}
