import { CalendarDays, Pencil, Trash2 } from "lucide-react"
import { formatDate, isOverdue } from "@/lib/dates"
import type { Project, Task, TaskPriority, TaskStatus } from "@/lib/types"

const statusLabels: Record<TaskStatus, string> = { todo: "قيد الانتظار", in_progress: "قيد التنفيذ", done: "مكتملة" }
const priorityLabels: Record<TaskPriority, string> = { low: "منخفضة", medium: "متوسطة", high: "عالية" }

export function TaskList({ tasks, project, currentUid, isOwner, onToggle, onEdit, onDelete }: {
  tasks: Task[]
  project: Project
  currentUid: string
  isOwner: boolean
  onToggle: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}) {
  return <section className="task-list" aria-label="قائمة المهام">{tasks.map((task) => <TaskCard key={task.id} task={task} project={project} currentUid={currentUid} isOwner={isOwner} onToggle={() => onToggle(task)} onEdit={() => onEdit(task)} onDelete={() => onDelete(task)} />)}</section>
}

export function TaskCard({ task, project, currentUid, isOwner, onToggle, onEdit, onDelete, cardClassName = "", draggable = false, onDragStart, onDragEnd }: {
  task: Task
  project: Project
  currentUid: string
  isOwner: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  cardClassName?: string
  draggable?: boolean
  onDragStart?: (event: React.DragEvent<HTMLElement>) => void
  onDragEnd?: () => void
}) {
  const canEdit = isOwner || task.createdBy === currentUid || task.assigneeId === currentUid
  const canToggle = isOwner || task.assigneeId === currentUid
  const assignee = project.members.find((member) => member.uid === task.assigneeId)

  return (
    <article className={`task-card ${task.status === "done" ? "is-done" : ""} ${cardClassName}`} draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <input className="task-card-check" type="checkbox" checked={task.status === "done"} disabled={!canToggle} onChange={onToggle} aria-label={`وضع ${task.title} كمكتملة`} />
      <div className="task-card-body">
        <h3 className="task-card-title">{task.title}</h3>
        {task.description && <p className="task-card-description">{task.description}</p>}
        <div className="task-card-meta"><span className={`pill status-${task.status}`}>{statusLabels[task.status]}</span><span className={`pill priority-${task.priority}`}>أولوية {priorityLabels[task.priority]}</span><span className={`task-card-deadline ${isOverdue(task) ? "overdue" : ""}`}><CalendarDays aria-hidden="true" />{formatDate(task.dueDate)}</span>{assignee && <span className="task-assignee">{assignee.displayName}</span>}</div>
      </div>
      {(canEdit || isOwner || task.createdBy === currentUid) && <div className="task-actions">{canEdit && <button className="icon-button" onClick={onEdit} aria-label={`تعديل ${task.title}`} title="تعديل المهمة"><Pencil /></button>}{(isOwner || task.createdBy === currentUid) && <button className="icon-button danger-icon" onClick={onDelete} aria-label={`حذف ${task.title}`} title="حذف المهمة"><Trash2 /></button>}</div>}
    </article>
  )
}
