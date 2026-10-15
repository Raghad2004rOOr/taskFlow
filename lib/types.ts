export type TaskStatus = "todo" | "in_progress" | "done"
export type TaskPriority = "low" | "medium" | "high"

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assigneeId: string | null
  createdBy: string
  dueDate: string | null
  createdAt: number
  updatedAt: number
}

export interface Member {
  uid: string
  displayName: string
  email?: string
}

export interface Project {
  id: string
  name: string
  description: string
  ownerId: string
  memberIds: string[]
  members: Member[]
  tasks: Task[]
  createdAt: number
  updatedAt: number
}

export interface UserProfile {
  uid: string
  displayName: string
  email: string
}

export type NotificationType = "task_assigned" | "project_invitation"

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  projectId: string
  taskId: string | null
  actorId: string
  read: boolean
  createdAt: number
}
