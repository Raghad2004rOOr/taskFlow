import { AlertTriangle, CalendarRange, CheckCircle2, Clock3, FolderKanban, ListChecks } from "lucide-react"
import { formatDate } from "@/lib/dates"
import type { Task } from "@/lib/types"

type DashboardTask = Task & { projectId: string; projectName: string }

export function DashboardStats({ projectCount, tasks, overdueTasks, onOpenProject }: {
  projectCount: number
  tasks: DashboardTask[]
  overdueTasks: DashboardTask[]
  onOpenProject: (projectId: string) => void
}) {
  const total = tasks.length
  const completed = tasks.filter((task) => task.status === "done").length
  const inProgress = tasks.filter((task) => task.status === "in_progress").length
  const waiting = tasks.filter((task) => task.status === "todo").length
  const progress = total ? Math.round((completed / total) * 100) : 0

  return (
    <>
      <section className="stats-grid" aria-label="ملخص المهام">
        <StatCard icon={<FolderKanban />} label="المشاريع" value={String(projectCount)} detail="المشاريع التي تشارك فيها" />
        <StatCard icon={<ListChecks />} label="إجمالي المهام" value={String(total)} detail="في جميع المشاريع" />
        <StatCard icon={<Clock3 />} label="قيد التنفيذ" value={String(inProgress)} detail="مهام يعمل عليها الفريق" tone="amber" />
        <StatCard icon={<AlertTriangle />} label="متأخرة" value={String(overdueTasks.length)} detail="تحتاج إلى متابعة" tone="rose" />
      </section>
      <section className="content-grid home-content-grid">
        <section className="panel completion-panel" aria-labelledby="completion-heading">
          <div className="panel-heading"><div><h2 id="completion-heading">مخطط إنجاز المهام</h2><p>توزيع المهام حسب حالتها في جميع مشاريعك.</p></div><span className="completion-rate">{progress}%<small>مكتمل</small></span></div>
          <div className="task-status-chart" role="group" aria-label="مخطط إنجاز المهام حسب الحالة">
            <ChartStatusRow label="مكتملة" count={completed} total={total} status="done" />
            <ChartStatusRow label="قيد التنفيذ" count={inProgress} total={total} status="doing" />
            <ChartStatusRow label="قيد الانتظار" count={waiting} total={total} status="todo" />
          </div>
          <div className="chart-footer"><span>إجمالي المهام</span><strong>{total}</strong></div>
        </section>
        <section className="panel">
          <div className="panel-heading"><div><h2>تحتاج إلى انتباهك</h2><p>المهام التي تجاوزت موعدها.</p></div><span className="stat-icon rose"><CalendarRange aria-hidden="true" /></span></div>
          {overdueTasks.length ? <div className="task-preview-list">{overdueTasks.slice(0, 5).map((task) => <TaskPreview key={`${task.projectId}-${task.id}`} task={task} onClick={() => onOpenProject(task.projectId)} />)}</div> : <div className="empty-state"><span><CheckCircle2 /></span><strong>أنت على المسار الصحيح</strong><p>لا توجد مهام متأخرة في مشاريعك.</p></div>}
        </section>
      </section>
    </>
  )
}

function StatCard({ icon, label, value, detail, tone = "" }: { icon: React.ReactNode; label: string; value: string; detail: string; tone?: string }) {
  return <article className="stat-card"><div className="stat-top"><span className="stat-label">{label}</span><span className={`stat-icon ${tone}`}>{icon}</span></div><strong className="stat-value">{value}</strong><span className="stat-foot">{detail}</span></article>
}

function ChartStatusRow({ label, count, total, status }: { label: string; count: number; total: number; status: "done" | "doing" | "todo" }) {
  const progress = total ? Math.round((count / total) * 100) : 0
  return (
    <div className="chart-status-row">
      <div className="chart-status-label"><i className={`chart-legend-dot ${status}`} aria-hidden="true" /><span>{label}</span></div>
      <div className="chart-track" role="progressbar" aria-label={`${label}: ${count} من ${total}`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span className={`chart-bar ${status}`} style={{ width: `${progress}%` }} /></div>
      <strong className="chart-count">{count}<small>{progress}%</small></strong>
    </div>
  )
}

function TaskPreview({ task, onClick }: { task: DashboardTask; onClick: () => void }) {
  return <button className="task-preview" onClick={onClick}><span className="task-preview-check"><AlertTriangle aria-hidden="true" /></span><span className="task-preview-copy"><strong>{task.title}</strong><span>{task.projectName}</span></span><span className="task-deadline overdue">{formatDate(task.dueDate)}</span></button>
}

