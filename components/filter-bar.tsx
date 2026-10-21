import { Columns3, List, Search } from "lucide-react"
import type { Project, TaskPriority, TaskStatus } from "@/lib/types"

export type TaskSort = "due_asc" | "due_desc" | "priority_desc" | "priority_asc"

const statusOptions: Array<{ value: TaskStatus | "all"; label: string }> = [
  { value: "all", label: "كل الحالات" },
  { value: "todo", label: "قيد الانتظار" },
  { value: "in_progress", label: "قيد التنفيذ" },
  { value: "done", label: "مكتملة" },
]

const priorityOptions: Array<{ value: TaskPriority | "all"; label: string }> = [
  { value: "all", label: "كل الأولويات" },
  { value: "high", label: "أولوية عالية" },
  { value: "medium", label: "أولوية متوسطة" },
  { value: "low", label: "أولوية منخفضة" },
]

export function FilterBar({ project, search, onSearchChange, statusFilter, onStatusChange, overdueFilter, onOverdueChange, priorityFilter, onPriorityChange, assigneeFilter, onAssigneeChange, sortBy, onSortChange, taskView, onTaskViewChange }: {
  project: Project
  search: string
  onSearchChange: (value: string) => void
  statusFilter: TaskStatus | "all"
  onStatusChange: (value: TaskStatus | "all") => void
  overdueFilter: "all" | "overdue"
  onOverdueChange: (value: "all" | "overdue") => void
  priorityFilter: TaskPriority | "all"
  onPriorityChange: (value: TaskPriority | "all") => void
  assigneeFilter: string
  onAssigneeChange: (value: string) => void
  sortBy: TaskSort
  onSortChange: (value: TaskSort) => void
  taskView: "list" | "board"
  onTaskViewChange: (value: "list" | "board") => void
}) {
  return (
    <section className="filters-bar" aria-label="تصفية المهام">
      <label className="search-control"><Search aria-hidden="true" /><span className="sr-only">البحث في المهام</span><input type="search" placeholder="ابحث عن مهمة…" value={search} onChange={(event) => onSearchChange(event.target.value)} /></label>
      <label><span className="sr-only">تصفية حسب الحالة</span><select value={statusFilter} onChange={(event) => onStatusChange(event.target.value as TaskStatus | "all")}>{statusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
      <label><span className="sr-only">تصفية حسب موعد الاستحقاق</span><select value={overdueFilter} onChange={(event) => onOverdueChange(event.target.value as "all" | "overdue")}><option value="all">كل المواعيد</option><option value="overdue">المهام المتأخرة</option></select></label>
      <label><span className="sr-only">تصفية حسب الأولوية</span><select value={priorityFilter} onChange={(event) => onPriorityChange(event.target.value as TaskPriority | "all")}>{priorityOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
      <label><span className="sr-only">تصفية حسب المسؤول</span><select value={assigneeFilter} onChange={(event) => onAssigneeChange(event.target.value)}><option value="all">كل المسؤولين</option><option value="unassigned">غير معيّنة</option>{project.members.map((member) => <option key={member.uid} value={member.uid}>{member.displayName}</option>)}</select></label>
      <label><span className="sr-only">ترتيب المهام</span><select value={sortBy} onChange={(event) => onSortChange(event.target.value as TaskSort)}><option value="due_asc">الموعد: الأقرب أولًا</option><option value="due_desc">الموعد: الأبعد أولًا</option><option value="priority_desc">الأولوية: الأعلى أولًا</option><option value="priority_asc">الأولوية: الأقل أولًا</option></select></label>
      <div className="inline-flex min-h-10 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-0.5" role="group" aria-label="طريقة عرض المهام">
        <button type="button" className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 text-[10px] ${taskView === "list" ? "bg-[var(--brand-soft)] font-bold text-[var(--brand)]" : "text-[var(--muted)]"}`} onClick={() => onTaskViewChange("list")} aria-pressed={taskView === "list"}><List className="size-3.5" aria-hidden="true" /><span>قائمة</span></button>
        <button type="button" className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 text-[10px] ${taskView === "board" ? "bg-[var(--brand-soft)] font-bold text-[var(--brand)]" : "text-[var(--muted)]"}`} onClick={() => onTaskViewChange("board")} aria-pressed={taskView === "board"}><Columns3 className="size-3.5" aria-hidden="true" /><span>كانبان</span></button>
      </div>
    </section>
  )
}
