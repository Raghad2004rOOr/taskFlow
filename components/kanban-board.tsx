"use client"

import { useState } from "react"
import type { Project, Task, TaskStatus } from "@/lib/types"
import { TaskCard } from "@/components/task-list"

const kanbanColumns: Array<{ status: TaskStatus; label: string }> = [
  { status: "todo", label: "قيد الانتظار" },
  { status: "in_progress", label: "قيد التنفيذ" },
  { status: "done", label: "مكتملة" },
]

export function KanbanBoard({ tasks, project, currentUid, isOwner, onMoveTask, onToggleTask, onEditTask, onDeleteTask }: {
  tasks: Task[]
  project: Project
  currentUid: string
  isOwner: boolean
  onMoveTask: (task: Task, status: TaskStatus) => void
  onToggleTask: (task: Task) => void
  onEditTask: (task: Task) => void
  onDeleteTask: (task: Task) => void
}) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)

  function startDragging(event: React.DragEvent<HTMLElement>, task: Task) {
    if (!isOwner && task.assigneeId !== currentUid) {
      event.preventDefault()
      return
    }
    setDraggedTaskId(task.id)
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", task.id)
  }

  function dropTask(event: React.DragEvent<HTMLElement>, status: TaskStatus) {
    event.preventDefault()
    const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId
    const task = tasks.find((item) => item.id === taskId)
    if (task) onMoveTask(task, status)
    setDraggedTaskId(null)
  }

  return (
    <section className="grid w-full grid-cols-[repeat(3,minmax(230px,1fr))] items-start gap-3 overflow-x-auto pb-2" aria-label="لوحة كانبان للمهام">
      {kanbanColumns.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.status)
        return (
          <section
            className="min-h-[220px] min-w-0 rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-3 transition-colors data-[drop-target=true]:border-[var(--brand)]"
            data-drop-target={Boolean(draggedTaskId)}
            key={column.status}
            aria-labelledby={`kanban-heading-${column.status}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => dropTask(event, column.status)}
          >
            <header className="mb-2.5 flex items-center justify-between gap-2">
              <h2 className="m-0 text-xs font-semibold" id={`kanban-heading-${column.status}`}>{column.label}</h2>
              <span className="grid size-[23px] place-items-center rounded-lg bg-[var(--surface)] px-1.5 text-[10px] font-bold text-[var(--muted)]">{columnTasks.length}</span>
            </header>
            <div className="flex flex-col gap-2">
              {columnTasks.map((task) => (
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 data-[dragging=true]:opacity-55" data-dragging={draggedTaskId === task.id} key={task.id}>
                  <TaskCard
                    task={task}
                    project={project}
                    currentUid={currentUid}
                    isOwner={isOwner}
                    onToggle={() => onToggleTask(task)}
                    onEdit={() => onEditTask(task)}
                    onDelete={() => onDeleteTask(task)}
                    cardClassName="!cursor-grab !border-0 !bg-transparent !px-0.5 !pb-2 !pt-1 active:!cursor-grabbing"
                    draggable={isOwner || task.assigneeId === currentUid}
                    onDragStart={(event) => startDragging(event, task)}
                    onDragEnd={() => setDraggedTaskId(null)}
                  />
                  <label className="block">
                    <span className="sr-only">تغيير حالة {task.title}</span>
                    <select className="min-h-8 w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-2 text-[10px] text-[var(--muted)] disabled:opacity-65" value={task.status} disabled={!isOwner && task.assigneeId !== currentUid} onChange={(event) => onMoveTask(task, event.target.value as TaskStatus)}>
                      {kanbanColumns.map((option) => <option key={option.status} value={option.status}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
              ))}
              {!columnTasks.length && <p className="m-0 px-2 py-[18px] text-center text-[10px] text-[var(--muted)]">اسحب مهمة إلى هنا</p>}
            </div>
          </section>
        )
      })}
    </section>
  )
}
