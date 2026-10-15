"use client"

import { FormEvent, useState } from "react"
import { X } from "lucide-react"
import type { Member, Task, TaskPriority, TaskStatus } from "@/lib/types"

interface TaskFormValue { title: string; description: string; status: TaskStatus; priority: TaskPriority; assigneeId: string | null; dueDate: string | null }

export function TaskDialog({
  task,
  members,
  canChangeStatus,
  canManageAssignment,
  onClose,
  onSave,
}: {
  task: Task | null
  members: Member[]
  canChangeStatus: boolean
  canManageAssignment: boolean
  onClose: () => void
  onSave: (value: TaskFormValue) => Promise<void>
}) {
  const [title, setTitle] = useState(task?.title ?? "")
  const [description, setDescription] = useState(task?.description ?? "")
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo")
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium")
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? "")
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSaving(true)
    try {
      await onSave({ title: title.trim(), description: description.trim(), status, priority, assigneeId: assigneeId || null, dueDate: dueDate || null })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذّر حفظ المهمة. حاول مرة أخرى.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onKeyDown={(event) => { if (event.key === "Escape") onClose() }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="task-dialog-title">
        <div className="modal-heading">
          <div>
            <h2 id="task-dialog-title">{task ? "تعديل المهمة" : "مهمة جديدة"}</h2>
            <p>حدّد المطلوب، الأولوية، والموعد النهائي.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="إغلاق"><X /></button>
        </div>
        <form className="form-stack" onSubmit={submit}>
          <div className="field">
            <label htmlFor="task-title">عنوان المهمة</label>
            <input id="task-title" required minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="ما الذي يجب إنجازه؟" autoFocus />
          </div>
          <div className="field">
            <label htmlFor="task-description">الوصف <span className="muted-inline">(اختياري)</span></label>
            <textarea id="task-description" maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="تفاصيل تساعد على إنجاز المهمة" />
          </div>
          <div className="form-grid-two">
            <div className="field">
              <label htmlFor="task-status">الحالة</label>
              <select id="task-status" value={status} disabled={!canChangeStatus} onChange={(event) => setStatus(event.target.value as TaskStatus)}>
                <option value="todo">قيد الانتظار</option>
                <option value="in_progress">قيد التنفيذ</option>
                <option value="done">مكتملة</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="task-priority">الأولوية</label>
              <select id="task-priority" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
                <option value="low">منخفضة</option>
                <option value="medium">متوسطة</option>
                <option value="high">عالية</option>
              </select>
            </div>
          </div>
          <div className="form-grid-two">
            <div className="field">
              <label htmlFor="task-assignee">المسؤول</label>
              <select id="task-assignee" value={assigneeId} disabled={!canManageAssignment} onChange={(event) => setAssigneeId(event.target.value)}>
                <option value="">غير معيّنة</option>
                {members.map((member) => <option key={member.uid} value={member.uid}>{member.displayName}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="task-due-date">الموعد النهائي</label>
              <input id="task-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <div className="modal-actions">
            <button className="quiet-button" type="button" onClick={onClose}>إلغاء</button>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? "جارٍ الحفظ…" : task ? "حفظ التعديلات" : "إضافة المهمة"}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
