import type { Task } from "@/lib/types"

function localDateKey() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function isOverdue(task: Pick<Task, "dueDate" | "status">) {
  return Boolean(task.dueDate && task.dueDate < localDateKey() && task.status !== "done")
}

export function formatDate(date: string | null) {
  if (!date) return "بدون موعد"
  const [year, month, day] = date.split("-").map(Number)
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { day: "numeric", month: "short" }).format(new Date(year, month - 1, day))
}
