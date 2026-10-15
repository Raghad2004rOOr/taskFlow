"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { signOut, type User } from "firebase/auth"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Layers3,
  ListChecks,
  ListTodo,
  LogOut,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react"
import { auth } from "@/lib/firebase"
import { NotificationCenter } from "@/components/notification-center"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  addProjectMember,
  createNotification,
  createProject,
  createTask,
  deleteProjectWhenEmpty,
  loadWorkspace,
  removeProjectMember,
  removeTask,
  updateProject,
  updateTask,
} from "@/lib/firestore"
import type { Project, Task, TaskPriority, TaskStatus } from "@/lib/types"
import { ProjectDialog } from "@/components/project-dialog"
import { TaskDialog } from "@/components/task-dialog"

const statusLabels: Record<TaskStatus, string> = { todo: "قيد الانتظار", in_progress: "قيد التنفيذ", done: "مكتملة" }
const priorityLabels: Record<TaskPriority, string> = { low: "منخفضة", medium: "متوسطة", high: "عالية" }
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

function localDateKey() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function isOverdue(task: Task) {
  return Boolean(task.dueDate && task.dueDate < localDateKey() && task.status !== "done")
}

function formatDate(date: string | null) {
  if (!date) return "بدون موعد"
  const [year, month, day] = date.split("-").map(Number)
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { day: "numeric", month: "short" }).format(new Date(year, month - 1, day))
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return `${parts[0]?.[0] ?? "T"}${parts[1]?.[0] ?? ""}`.toUpperCase()
}

export function TaskFlowApp({ user }: { user: User }) {
  const { data: projects, error: workspaceError, isLoading, mutate } = useSWR<Project[]>(
    `workspace:${user.uid}`,
    () => loadWorkspace(user.uid),
    { revalidateOnFocus: true },
  )
  const [view, setView] = useState<"overview" | "project">("overview")
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [projectEditorId, setProjectEditorId] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null | undefined>(undefined)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all")
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all")
  const [assigneeFilter, setAssigneeFilter] = useState("all")
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null)
  const [memberEmail, setMemberEmail] = useState("")
  const [addingMember, setAddingMember] = useState(false)

  useEffect(() => {
    if (projects?.length && !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id)
    }
  }, [projects, selectedProjectId])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const allTasks = useMemo(() => projects?.flatMap((project) => project.tasks.map((task) => ({ ...task, projectId: project.id, projectName: project.name }))) ?? [], [projects])
  const activeProject = projects?.find((project) => project.id === selectedProjectId)
  const isOwner = activeProject?.ownerId === user.uid
  const totalTasks = allTasks.length
  const completedTasks = allTasks.filter((task) => task.status === "done").length
  const inProgressTasks = allTasks.filter((task) => task.status === "in_progress").length
  const overdueTasks = allTasks.filter(isOverdue)
  const overallProgress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0
  const filteredTasks = activeProject?.tasks.filter((task) => {
    const matchesSearch = `${task.title} ${task.description}`.toLocaleLowerCase("ar").includes(search.trim().toLocaleLowerCase("ar"))
    const matchesStatus = statusFilter === "all" || task.status === statusFilter
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter
    const matchesAssignee = assigneeFilter === "all" || (assigneeFilter === "unassigned" ? !task.assigneeId : task.assigneeId === assigneeFilter)
    return matchesSearch && matchesStatus && matchesPriority && matchesAssignee
  }) ?? []

  function notify(message: string, error = false) {
    setToast({ message, error })
  }

  async function sendNotification(recipientUid: string, notification: Parameters<typeof createNotification>[1]) {
    try {
      await createNotification(recipientUid, notification)
    } catch {
      notify("تم حفظ التغيير، لكن تعذّر إرسال الإشعار.", true)
    }
  }

  function openProject(projectId: string) {
    setSelectedProjectId(projectId)
    setView("project")
    setSearch("")
    setStatusFilter("all")
    setPriorityFilter("all")
    setAssigneeFilter("all")
  }

  async function saveProject(value: { name: string; description: string }) {
    if (projectEditor) {
      await updateProject(projectEditor.id, value)
      setProjectEditorId(null)
      notify("تم تحديث المشروع.")
    } else {
      await createProject({ ...value, uid: user.uid })
      notify("تم إنشاء المشروع.")
    }
    setProjectDialogOpen(false)
    await mutate()
  }

  async function saveTask(value: { title: string; description: string; status: TaskStatus; priority: TaskPriority; assigneeId: string | null; dueDate: string | null }) {
    if (!activeProject) return
    let taskId: string
    if (editingTask) {
      taskId = editingTask.id
      await updateTask(activeProject.id, taskId, value)
      notify("تم تحديث المهمة.")
    } else {
      taskId = await createTask(activeProject.id, user.uid, value)
      notify("تمت إضافة المهمة.")
    }
    if (value.assigneeId && value.assigneeId !== user.uid && value.assigneeId !== editingTask?.assigneeId) {
      await sendNotification(value.assigneeId, {
        type: "task_assigned",
        title: "أُسندت إليك مهمة",
        message: `${value.title.trim()} · ${activeProject.name}`,
        projectId: activeProject.id,
        taskId,
        actorId: user.uid,
      })
    }
    setEditingTask(undefined)
    await mutate()
  }

  async function toggleTask(task: Task) {
    if (!activeProject) return
    try {
      await updateTask(activeProject.id, task.id, {
        title: task.title,
        description: task.description,
        status: task.status === "done" ? "todo" : "done",
        priority: task.priority,
        assigneeId: task.assigneeId,
        dueDate: task.dueDate,
      })
      await mutate()
    } catch {
      notify("تعذّر تحديث الحالة. قد لا تملك صلاحية تعديل هذه المهمة.", true)
    }
  }

  async function deleteCurrentTask(task: Task) {
    if (!activeProject || !window.confirm(`هل تريد حذف المهمة «${task.title}»؟`)) return
    try {
      await removeTask(activeProject.id, task.id)
      notify("تم حذف المهمة.")
      await mutate()
    } catch {
      notify("تعذّر حذف المهمة. تحقّق من صلاحيات المشروع.", true)
    }
  }

  async function deleteCurrentProject() {
    if (!activeProject || !window.confirm(`حذف المشروع «${activeProject.name}»؟ لا يمكن حذف مشروع يحتوي على مهام.`)) return
    try {
      await deleteProjectWhenEmpty(activeProject.id)
      setView("overview")
      setSelectedProjectId("")
      notify("تم حذف المشروع.")
      await mutate()
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "تعذّر حذف المشروع.", true)
    }
  }

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeProject || !memberEmail.trim()) return
    setAddingMember(true)
    try {
      const addedMember = await addProjectMember(activeProject.id, memberEmail)
      setMemberEmail("")
      notify("تمت إضافة العضو إلى المشروع.")
      await sendNotification(addedMember.uid, {
        type: "project_invitation",
        title: "أُضيفت إلى مشروع",
        message: activeProject.name,
        projectId: activeProject.id,
        taskId: null,
        actorId: user.uid,
      })
      await mutate()
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "تعذّر إضافة العضو.", true)
    } finally {
      setAddingMember(false)
    }
  }

  async function handleRemoveMember(uid: string, name: string) {
    if (!activeProject || !window.confirm(`إزالة ${name} من المشروع؟ ستُلغى أيضًا المهام المسندة إليه.`)) return
    try {
      await removeProjectMember(activeProject.id, uid, user.uid)
      notify("تمت إزالة العضو وإلغاء إسناد مهامه.")
      await mutate()
    } catch {
      notify("تعذّرت إزالة العضو. حاول مرة أخرى.", true)
    }
  }

  async function handleSignOut() {
    if (!auth) return
    try {
      await signOut(auth)
    } catch {
      notify("تعذّر تسجيل الخروج. حاول مرة أخرى.", true)
    }
  }

  const projectEditor = (projects ?? []).find((project) => project.id === projectEditorId) ?? null
  const visibleProjects = projects ?? []

  return (
    <div className="app-shell" dir="rtl">
      <aside className="sidebar">
        <a href="/" className="auth-brand" aria-label="TaskFlow — الرئيسية"><span className="brand-mark"><Layers3 aria-hidden="true" /></span><span>TaskFlow</span></a>
        <p className="workspace-label">مساحة العمل</p>
        <nav className="nav-list" aria-label="التنقل الرئيسي">
          <button className={`nav-item ${view === "overview" ? "active" : ""}`} onClick={() => setView("overview")}><ListTodo aria-hidden="true" /><span>نظرة عامة</span></button>
          <button className={`nav-item ${view === "project" ? "active" : ""}`} onClick={() => setView("overview")}><FolderKanban aria-hidden="true" /><span>المشاريع</span><span className="nav-count">{visibleProjects.length}</span></button>
        </nav>
        <p className="workspace-label" style={{ marginTop: 27 }}>مشاريعك</p>
        <nav className="nav-list" aria-label="المشاريع">
          {visibleProjects.slice(0, 6).map((project) => (
            <button key={project.id} className={`nav-item ${view === "project" && project.id === selectedProjectId ? "active" : ""}`} onClick={() => openProject(project.id)}>
              <FolderKanban aria-hidden="true" /><span className="truncate-label">{project.name}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-help"><strong>مساحة أوضح للعمل</strong><p>تابع المهام والمواعيد وتعاون فريقك من مكان واحد.</p></div>
        <div className="user-card">
          <span className="avatar" aria-hidden="true">{initials(user.displayName || user.email || "T")}</span>
          <div className="user-copy"><strong>{user.displayName || "مستخدم TaskFlow"}</strong><span>{user.email}</span></div>
          <button className="icon-button" type="button" onClick={handleSignOut} aria-label="تسجيل الخروج" title="تسجيل الخروج"><LogOut /></button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <a href="/" className="mobile-brand" aria-label="TaskFlow — الرئيسية"><span className="brand-mark"><Layers3 aria-hidden="true" /></span><span>TaskFlow</span></a>
          <div className="topbar-welcome"><span>مساحة فريقك، في مكان واحد</span><strong>مرحبًا، {user.displayName?.split(" ")[0] || "بك"}</strong></div>
          <div className="topbar-actions">
            <span className="topbar-date">{new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span>
            <ThemeToggle />
            <NotificationCenter userId={user.uid} onOpenProject={openProject} />
            <button className="icon-button mobile-signout" type="button" onClick={handleSignOut} aria-label="تسجيل الخروج"><LogOut /></button>
          </div>
        </header>

        {view === "overview" ? (
          <>
            <section className="page-heading">
              <div><h1>نظرة عامة</h1><p>إليك ملخص ما يحدث في مشاريع فريقك اليوم.</p></div>
              <button className="primary-button" type="button" onClick={() => { setProjectEditorId(null); setProjectDialogOpen(true) }}><Plus aria-hidden="true" /> مشروع جديد</button>
            </section>
            {workspaceError ? (
              <div className="panel error-panel" role="alert"><strong>تعذّر تحميل مساحة العمل</strong><p>تحقّق من اتصال Firebase وقواعد Firestore ثم حاول مجددًا.</p><button className="secondary-button" onClick={() => mutate()}>إعادة المحاولة</button></div>
            ) : (
              <>
                <section className="stats-grid" aria-label="ملخص المهام">
                  <StatCard icon={<FolderKanban />} label="المشاريع" value={String(visibleProjects.length)} detail="المشاريع التي تشارك فيها" />
                  <StatCard icon={<ListChecks />} label="إجمالي المهام" value={String(totalTasks)} detail="في جميع المشاريع" />
                  <StatCard icon={<Clock3 />} label="قيد التنفيذ" value={String(inProgressTasks)} detail="مهام يعمل عليها الفريق" tone="amber" />
                  <StatCard icon={<AlertTriangle />} label="متأخرة" value={String(overdueTasks.length)} detail="تحتاج إلى متابعة" tone="rose" />
                </section>
                <section className="content-grid">
                  <div className="panel">
                    <div className="panel-heading"><div><h2>مشاريعك</h2><p>تابع العمل الجاري في كل مساحة.</p></div><button className="text-link" onClick={() => setProjectDialogOpen(true)}>مشروع جديد</button></div>
                    {isLoading ? <div className="project-list"><span className="skeleton-block" /><span className="skeleton-block" /></div> : visibleProjects.length ? (
                      <div className="project-list">
                        {visibleProjects.map((project) => <ProjectRow key={project.id} project={project} onClick={() => openProject(project.id)} />)}
                      </div>
                    ) : <EmptyState icon={<FolderKanban />} title="مساحتك جاهزة" description="أنشئ مشروعك الأول، ثم أضف المهام وادعُ أعضاء فريقك." action={<button className="primary-button" onClick={() => setProjectDialogOpen(true)}><Plus /> إنشاء مشروع</button>} />}
                  </div>
                  <div className="panel">
                    <div className="panel-heading"><div><h2>تحتاج إلى انتباهك</h2><p>المهام التي تجاوزت موعدها.</p></div><span className="stat-icon rose"><CalendarRange aria-hidden="true" /></span></div>
                    {overdueTasks.length ? <div className="task-preview-list">{overdueTasks.slice(0, 5).map((task) => <TaskPreview key={`${task.projectId}-${task.id}`} task={task} onClick={() => openProject(task.projectId)} />)}</div> : <EmptyState icon={<CheckCircle2 />} title="أنت على المسار الصحيح" description="لا توجد مهام متأخرة في مشاريعك." />}
                    <div className="progress-wrap"><div className="progress-title"><span>إنجاز جميع المهام</span><span>{overallProgress}%</span></div><div className="progress-track" role="progressbar" aria-label="نسبة إنجاز المهام" aria-valuenow={overallProgress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${overallProgress}%` }} /></div><div className="status-summary"><span><i className="status-dot todo-dot" />قيد الانتظار <strong>{allTasks.filter((task) => task.status === "todo").length}</strong></span><span><i className="status-dot doing-dot" />قيد التنفيذ <strong>{inProgressTasks}</strong></span><span><i className="status-dot done-dot" />مكتملة <strong>{completedTasks}</strong></span></div></div>
                  </div>
                </section>
              </>
            )}
          </>
        ) : activeProject ? (
          <>
            <section className="page-heading">
              <div><button className="back-link" onClick={() => setView("overview")}><ArrowLeft aria-hidden="true" /> كل المشاريع</button><h1>المهام</h1><p>نظّم الأولويات وتابع تقدّم المشروع.</p></div>
              <button className="primary-button" type="button" onClick={() => setEditingTask(null)}><Plus aria-hidden="true" /> مهمة جديدة</button>
            </section>
            <section className="selected-project-banner">
              <span className="project-symbol"><FolderKanban aria-hidden="true" /></span>
              <div className="selected-project-info"><h2>{activeProject.name}</h2><p>{activeProject.description || "لا يوجد وصف للمشروع"} · {activeProject.tasks.length} مهام</p></div>
              <div className="project-members" aria-label={`${activeProject.members.length} أعضاء`}>
                {activeProject.members.slice(0, 4).map((member) => <span className="member-avatar" key={member.uid} title={member.displayName}>{initials(member.displayName)}</span>)}
              </div>
              {isOwner && <div className="project-settings"><button className="icon-button" aria-label="تعديل المشروع" title="تعديل المشروع" onClick={() => { setProjectEditorId(activeProject.id); setProjectDialogOpen(true) }}><Pencil /></button><button className="icon-button danger-icon" aria-label="حذف المشروع" title="حذف المشروع" onClick={deleteCurrentProject}><Trash2 /></button></div>}
            </section>
            <section className="filters-bar" aria-label="تصفية المهام">
              <label className="search-control"><Search aria-hidden="true" /><span className="sr-only">البحث في المهام</span><input type="search" placeholder="ابحث عن مهمة…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
              <label><span className="sr-only">تصفية حسب الحالة</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TaskStatus | "all")}>{statusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
              <label><span className="sr-only">تصفية حسب الأولوية</span><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as TaskPriority | "all")}>{priorityOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
              <label><span className="sr-only">تصفية حسب المسؤول</span><select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}><option value="all">كل المسؤولين</option><option value="unassigned">غير معيّنة</option>{activeProject.members.map((member) => <option key={member.uid} value={member.uid}>{member.displayName}</option>)}</select></label>
            </section>
            {workspaceError ? <div className="notice" role="alert">تعذّر تحديث المهام. تحقّق من اتصال Firebase.</div> : isLoading ? <div className="task-list"><span className="skeleton-block" /><span className="skeleton-block" /></div> : filteredTasks.length ? (
              <section className="task-list" aria-label="قائمة المهام">
                {filteredTasks.map((task) => <TaskCard key={task.id} task={task} project={activeProject} currentUid={user.uid} isOwner={Boolean(isOwner)} onToggle={() => toggleTask(task)} onEdit={() => setEditingTask(task)} onDelete={() => deleteCurrentTask(task)} />)}
              </section>
            ) : <div className="panel"><EmptyState icon={<ListTodo />} title={activeProject.tasks.length ? "لا توجد نتائج مطابقة" : "ابدأ بأول مهمة"} description={activeProject.tasks.length ? "جرّب تغيير البحث أو عوامل التصفية." : "أضف أول مهمة لهذا المشروع لتبدأ متابعة التقدّم."} action={!activeProject.tasks.length ? <button className="primary-button" onClick={() => setEditingTask(null)}><Plus /> إضافة مهمة</button> : undefined} /></div>}
            <section className="member-box">
              <div className="panel-heading"><div><h3>أعضاء المشروع</h3><p>الأعضاء الحاليون لديهم وصول إلى مهام المشروع.</p></div><span className="stat-icon"><UserPlus aria-hidden="true" /></span></div>
              <div className="member-management">
                {activeProject.members.map((member) => (
                  <div className="member-line" key={member.uid}><span className="avatar">{initials(member.displayName)}</span><span>{member.displayName}<small>{member.email || "عضو في المشروع"}{member.uid === activeProject.ownerId ? " · مالك المشروع" : ""}</small></span>{isOwner && member.uid !== activeProject.ownerId && <button className="icon-button danger-icon" aria-label={`إزالة ${member.displayName}`} title="إزالة العضو" onClick={() => handleRemoveMember(member.uid, member.displayName)}><X /></button>}</div>
                ))}
              </div>
              {isOwner && <form className="member-form" onSubmit={handleAddMember}><label className="sr-only" htmlFor="member-email">البريد الإلكتروني للعضو</label><input id="member-email" type="email" maxLength={254} required value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="البريد الإلكتروني للعضو" /><button type="submit" aria-label="إضافة عضو" disabled={addingMember}><UserPlus /></button></form>}
            </section>
          </>
        ) : (
          <section className="page-heading"><div><h1>المشاريع</h1><p>أنشئ مشروعًا أو اختر واحدًا من لوحة التحكم.</p></div><button className="primary-button" onClick={() => { setProjectEditorId(null); setProjectDialogOpen(true) }}><Plus /> مشروع جديد</button></section>
        )}
      </main>

      {toast && <div className={`toast-message ${toast.error ? "error" : ""}`} role={toast.error ? "alert" : "status"}>{toast.message}</div>}
      {projectDialogOpen && <ProjectDialog project={projectEditor} onClose={() => { setProjectDialogOpen(false); setProjectEditorId(null) }} onSave={saveProject} />}
      {editingTask !== undefined && activeProject && <TaskDialog task={editingTask} members={activeProject.members} canChangeStatus={Boolean(!editingTask || isOwner || editingTask.assigneeId === user.uid)} canManageAssignment={Boolean(isOwner)} onClose={() => setEditingTask(undefined)} onSave={saveTask} />}
    </div>
  )
}

function StatCard({ icon, label, value, detail, tone = "" }: { icon: React.ReactNode; label: string; value: string; detail: string; tone?: string }) {
  return <article className="stat-card"><div className="stat-top"><span className="stat-label">{label}</span><span className={`stat-icon ${tone}`}>{icon}</span></div><strong className="stat-value">{value}</strong><span className="stat-foot">{detail}</span></article>
}

function ProjectRow({ project, onClick }: { project: Project; onClick: () => void }) {
  const complete = project.tasks.filter((task) => task.status === "done").length
  const progress = project.tasks.length ? Math.round((complete / project.tasks.length) * 100) : 0
  return <button className="project-row" onClick={onClick}><span className="project-symbol"><FolderKanban aria-hidden="true" /></span><span className="project-main"><strong>{project.name}</strong><span className="project-meta"><span>{project.tasks.length} مهام</span><span>·</span><span>{project.members.length} أعضاء</span></span></span><span className="project-progress" role="progressbar" aria-label={`إنجاز ${project.name}`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></span><span className="project-progress-label">{progress}%</span><ArrowUpRight className="row-arrow" aria-hidden="true" /></button>
}

function TaskPreview({ task, onClick }: { task: Task & { projectId: string; projectName: string }; onClick: () => void }) {
  return <button className="task-preview" onClick={onClick}><span className="task-preview-check"><AlertTriangle aria-hidden="true" /></span><span className="task-preview-copy"><strong>{task.title}</strong><span>{task.projectName}</span></span><span className="task-deadline overdue">{formatDate(task.dueDate)}</span></button>
}

function TaskCard({ task, project, currentUid, isOwner, onToggle, onEdit, onDelete }: { task: Task; project: Project; currentUid: string; isOwner: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  const canEdit = isOwner || task.createdBy === currentUid || task.assigneeId === currentUid
  const canToggle = isOwner || task.assigneeId === currentUid
  const assignee = project.members.find((member) => member.uid === task.assigneeId)
  return (
    <article className={`task-card ${task.status === "done" ? "is-done" : ""}`}>
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

function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span>{icon}</span><strong>{title}</strong><p>{description}</p>{action}</div>
}

