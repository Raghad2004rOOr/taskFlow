"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { signOut, type User } from "firebase/auth"
import { ArrowLeft, ArrowUpRight, FolderKanban, History, Layers3, ListTodo, LogOut, Pencil, Plus, Trash2 } from "lucide-react"
import { auth } from "@/lib/firebase"
import { NotificationCenter } from "@/components/notification-center"
import { ThemeToggle } from "@/components/theme-toggle"
import { DashboardStats } from "@/components/dashboard-stats"
import { FilterBar, type TaskSort } from "@/components/filter-bar"
import { KanbanBoard } from "@/components/kanban-board"
import { MembersPanel } from "@/components/members-panel"
import { TaskList } from "@/components/task-list"
import {
  addProjectMember,
  createNotification,
  createNotifications,
  createProject,
  createTask,
  deleteProjectWhenEmpty,
  loadProjectActivity,
  loadWorkspace,
  removeProjectMember,
  removeTask,
  updateProject,
  updateTask,
} from "@/lib/firestore"
import type { Project, Task, TaskPriority, TaskStatus } from "@/lib/types"
import { isOverdue } from "@/lib/dates"
import { ProjectDialog } from "@/components/project-dialog"
import { TaskDialog } from "@/components/task-dialog"

const statusLabels: Record<TaskStatus, string> = { todo: "قيد الانتظار", in_progress: "قيد التنفيذ", done: "مكتملة" }

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return `${parts[0]?.[0] ?? "T"}${parts[1]?.[0] ?? ""}`.toUpperCase()
}

export function TaskFlowApp({ user, projectId }: { user: User; projectId?: string }) {
  const router = useRouter()
  const { data: projects, error: workspaceError, isLoading, mutate } = useSWR<Project[]>(
    `workspace:${user.uid}`,
    () => loadWorkspace(user.uid),
    { revalidateOnFocus: true },
  )
  const [view, setView] = useState<"home" | "projects" | "project">(projectId ? "project" : "home")
  const [selectedProjectId, setSelectedProjectId] = useState(projectId ?? "")
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [projectEditorId, setProjectEditorId] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null | undefined>(undefined)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all")
  const [overdueFilter, setOverdueFilter] = useState<"all" | "overdue">("all")
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all")
  const [assigneeFilter, setAssigneeFilter] = useState("all")
  const [sortBy, setSortBy] = useState<TaskSort>("due_asc")
  const [taskView, setTaskView] = useState<"list" | "board">("list")
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null)
  const [memberEmail, setMemberEmail] = useState("")
  const [addingMember, setAddingMember] = useState(false)

  useEffect(() => {
    if (projectId) {
      setSelectedProjectId(projectId)
      setView("project")
    } else {
      setSelectedProjectId("")
      setView("home")
    }
  }, [projectId])

  useEffect(() => {
    if (!projectId && projects?.length && !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id)
    }
  }, [projectId, projects, selectedProjectId])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const allTasks = useMemo(() => projects?.flatMap((project) => project.tasks.map((task) => ({ ...task, projectId: project.id, projectName: project.name }))) ?? [], [projects])
  const activeProject = projects?.find((project) => project.id === selectedProjectId)
  const isOwner = activeProject?.ownerId === user.uid
  const overdueTasks = allTasks.filter(isOverdue)
  const filteredTasks = activeProject?.tasks.filter((task) => {
    const matchesSearch = `${task.title} ${task.description}`.toLocaleLowerCase("ar").includes(search.trim().toLocaleLowerCase("ar"))
    const matchesStatus = statusFilter === "all" || task.status === statusFilter
    const matchesOverdue = overdueFilter === "all" || isOverdue(task)
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter
    const matchesAssignee = assigneeFilter === "all" || (assigneeFilter === "unassigned" ? !task.assigneeId : task.assigneeId === assigneeFilter)
    return matchesSearch && matchesStatus && matchesOverdue && matchesPriority && matchesAssignee
  }) ?? []
  const sortedTasks = useMemo(() => {
    const priorityRank: Record<TaskPriority, number> = { low: 1, medium: 2, high: 3 }
    return [...filteredTasks].sort((first, second) => {
      if (sortBy.startsWith("due")) {
        if (!first.dueDate && !second.dueDate) return 0
        if (!first.dueDate) return 1
        if (!second.dueDate) return -1
        const order = first.dueDate.localeCompare(second.dueDate)
        return sortBy === "due_asc" ? order : -order
      }
      const order = priorityRank[second.priority] - priorityRank[first.priority]
      return sortBy === "priority_desc" ? order : -order
    })
  }, [filteredTasks, sortBy])

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

  async function sendNotifications(notifications: Parameters<typeof createNotifications>[0]) {
    try {
      await createNotifications(notifications)
    } catch {
      notify("تم حفظ المهمة، لكن تعذّر إرسال إشعار لمالك المشروع.", true)
    }
  }

  function openProject(projectId: string) {
    setSelectedProjectId(projectId)
    setView("project")
    router.push(`/projects/${projectId}`)
    setSearch("")
    setStatusFilter("all")
    setOverdueFilter("all")
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
    const isNewTask = !editingTask
    if (editingTask) {
      taskId = editingTask.id
      await updateTask(activeProject.id, taskId, value, user.uid, editingTask.status)
      notify("تم تحديث المهمة.")
    } else {
      taskId = await createTask(activeProject.id, user.uid, value)
      notify("تمت إضافة المهمة.")
    }

    const notifications: Parameters<typeof createNotifications>[0] = []
    if (isNewTask) {
      const notification = {
        type: "task_created" as const,
        title: "أُضيفت مهمة جديدة",
        message: `${value.title.trim()} · ${activeProject.name}`,
        projectId: activeProject.id,
        taskId,
        actorId: user.uid,
      }
      const ownerUid = activeProject.ownerId

      if (ownerUid && ownerUid !== user.uid && ownerUid !== value.assigneeId) {
        notifications.push({ recipientUid: ownerUid, notification })
      }
    }
    if (value.assigneeId && value.assigneeId !== user.uid && value.assigneeId !== editingTask?.assigneeId) {
      notifications.push({
        recipientUid: value.assigneeId,
        notification: {
          type: "task_assigned",
          title: "أُسندت إليك مهمة",
          message: `${value.title.trim()} · ${activeProject.name}`,
          projectId: activeProject.id,
          taskId,
          actorId: user.uid,
        },
      })
    }
    if (notifications.length) await sendNotifications(notifications)

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
      }, user.uid, task.status)
      await mutate()
    } catch {
      notify("تعذّر تحديث الحالة. قد لا تملك صلاحية تعديل هذه المهمة.", true)
    }
  }

  async function moveTask(task: Task, status: TaskStatus) {
    if (!activeProject || task.status === status) return
    try {
      await updateTask(activeProject.id, task.id, {
        title: task.title,
        description: task.description,
        status,
        priority: task.priority,
        assigneeId: task.assigneeId,
        dueDate: task.dueDate,
      }, user.uid, task.status)
      notify(`تم نقل المهمة إلى ${statusLabels[status]}.`)
      await mutate()
    } catch {
      notify("تعذّر تغيير حالة المهمة. تحقّق من صلاحياتك.", true)
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
      setView("projects")
      setSelectedProjectId("")
      router.push("/dashboard")
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
          <button className={`nav-item ${view === "home" ? "active" : ""}`} onClick={() => { setView("home"); router.push("/dashboard") }}><ListTodo aria-hidden="true" /><span>نظرة عامة</span></button>
          <button className={`nav-item ${view === "projects" || view === "project" ? "active" : ""}`} onClick={() => { setView("projects"); router.push("/dashboard") }}><FolderKanban aria-hidden="true" /><span>المشاريع</span><span className="nav-count">{visibleProjects.length}</span></button>
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

        {view === "home" ? (
          <>
            <section className="page-heading">
              <div><h1>نظرة عامة</h1><p>ملخص إنجاز فريقك والمهام التي تحتاج إلى متابعة.</p></div>
              <button className="primary-button" type="button" onClick={() => setView("projects")}><FolderKanban aria-hidden="true" /> عرض المشاريع</button>
            </section>
            {workspaceError ? (
              <div className="panel error-panel" role="alert"><strong>تعذّر تحميل مساحة العمل</strong><p>تحقّق من اتصال Firebase وقواعد Firestore ثم حاول مجددًا.</p><button className="secondary-button" onClick={() => mutate()}>إعادة المحاولة</button></div>
            ) : (
              <>
                <DashboardStats projectCount={visibleProjects.length} tasks={allTasks} overdueTasks={overdueTasks} onOpenProject={openProject} />
              </>
            )}
          </>
        ) : view === "projects" ? (
          <>
            <section className="page-heading">
              <div><h1>المشاريع</h1><p>كل المشاريع التي تعمل عليها أنت وفريقك.</p></div>
              <button className="primary-button" type="button" onClick={() => { setProjectEditorId(null); setProjectDialogOpen(true) }}><Plus aria-hidden="true" /> مشروع جديد</button>
            </section>
            {workspaceError ? <div className="panel error-panel" role="alert"><strong>تعذّر تحميل المشاريع</strong><p>تحقّق من اتصال Firebase ثم حاول مجددًا.</p><button className="secondary-button" onClick={() => mutate()}>إعادة المحاولة</button></div> : (
              <section className="panel projects-page-panel">
                <div className="panel-heading"><div><h2>قائمة المشاريع</h2><p>{visibleProjects.length} مشاريع في مساحة عملك</p></div><span className="stat-icon"><FolderKanban aria-hidden="true" /></span></div>
                {isLoading ? <div className="project-list"><span className="skeleton-block" /><span className="skeleton-block" /></div> : visibleProjects.length ? <div className="project-list">{visibleProjects.map((project) => <ProjectRow key={project.id} project={project} onClick={() => openProject(project.id)} />)}</div> : <EmptyState icon={<FolderKanban />} title="مساحتك جاهزة" description="أنشئ مشروعك الأول، ثم أضف المهام وادعُ أعضاء فريقك." action={<button className="primary-button" onClick={() => setProjectDialogOpen(true)}><Plus /> إنشاء مشروع</button>} />}
              </section>
            )}
          </>
        ) : activeProject ? (
          <>
            <section className="page-heading">
              <div><button className="back-link" onClick={() => { setView("projects"); router.push("/dashboard") }}><ArrowLeft aria-hidden="true" /> كل المشاريع</button><h1>المهام</h1><p>نظّم الأولويات وتابع تقدّم المشروع.</p></div>
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
            <FilterBar project={activeProject} search={search} onSearchChange={setSearch} statusFilter={statusFilter} onStatusChange={setStatusFilter} overdueFilter={overdueFilter} onOverdueChange={setOverdueFilter} priorityFilter={priorityFilter} onPriorityChange={setPriorityFilter} assigneeFilter={assigneeFilter} onAssigneeChange={setAssigneeFilter} sortBy={sortBy} onSortChange={setSortBy} taskView={taskView} onTaskViewChange={setTaskView} />
            {workspaceError ? <div className="notice" role="alert">تعذّر تحديث المهام. تحقّق من اتصال Firebase.</div> : isLoading ? <div className="task-list"><span className="skeleton-block" /><span className="skeleton-block" /></div> : sortedTasks.length ? (
              taskView === "board" ? (
                <KanbanBoard tasks={sortedTasks} project={activeProject} currentUid={user.uid} isOwner={Boolean(isOwner)} onMoveTask={moveTask} onToggleTask={toggleTask} onEditTask={setEditingTask} onDeleteTask={deleteCurrentTask} />
              ) : (
                <TaskList tasks={sortedTasks} project={activeProject} currentUid={user.uid} isOwner={Boolean(isOwner)} onToggle={toggleTask} onEdit={setEditingTask} onDelete={deleteCurrentTask} />
              )
            ) : <div className="panel"><EmptyState icon={<ListTodo />} title={activeProject.tasks.length ? "لا توجد نتائج مطابقة" : "ابدأ بأول مهمة"} description={activeProject.tasks.length ? "جرّب تغيير البحث أو عوامل التصفية." : "أضف أول مهمة لهذا المشروع لتبدأ متابعة التقدّم."} action={!activeProject.tasks.length ? <button className="primary-button" onClick={() => setEditingTask(null)}><Plus /> إضافة مهمة</button> : undefined} /></div>}
            <MembersPanel project={activeProject} isOwner={Boolean(isOwner)} memberEmail={memberEmail} onMemberEmailChange={setMemberEmail} addingMember={addingMember} onAddMember={handleAddMember} onRemoveMember={(member) => handleRemoveMember(member.uid, member.displayName)} />
            <ProjectActivityFeed projectId={activeProject.id} currentUid={user.uid} />
          </>
        ) : view === "project" ? (
          workspaceError ? <div className="panel error-panel" role="alert">تعذّر التحقق من صلاحية الوصول إلى المشروع.</div> : isLoading ? <div className="panel"><span className="skeleton-block" /></div> : <div className="panel" role="status" dir="rtl">المشروع غير موجود أو لا تملك صلاحية الوصول.</div>
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

function ProjectRow({ project, onClick }: { project: Project; onClick: () => void }) {
  const complete = project.tasks.filter((task) => task.status === "done").length
  const progress = project.tasks.length ? Math.round((complete / project.tasks.length) * 100) : 0
  return <button className="project-row" onClick={onClick}><span className="project-symbol"><FolderKanban aria-hidden="true" /></span><span className="project-main"><strong>{project.name}</strong><span className="project-meta"><span>{project.tasks.length} مهام</span><span>·</span><span>{project.members.length} أعضاء</span></span></span><span className="project-progress" role="progressbar" aria-label={`إنجاز ${project.name}`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></span><span className="project-progress-label">{progress}%</span><ArrowUpRight className="row-arrow" aria-hidden="true" /></button>
}

function ProjectActivityFeed({ projectId, currentUid }: { projectId: string; currentUid: string }) {
  const { data: activities, error, isLoading } = useSWR(
    `project-activity:${projectId}`,
    () => loadProjectActivity(projectId),
    { revalidateOnFocus: true, refreshInterval: 15000 },
  )

  return (
    <section className="panel mt-4" aria-labelledby="activity-heading">
      <div className="panel-heading">
        <div><h2 id="activity-heading">سجل النشاط</h2><p>آخر التغييرات على مهام المشروع.</p></div>
        <span className="stat-icon"><History aria-hidden="true" /></span>
      </div>
      {error ? <p className="m-0 pt-4 text-[11px] leading-relaxed text-[var(--muted)]" role="alert">تعذّر تحميل سجل النشاط.</p> : isLoading ? <p className="m-0 pt-4 text-[11px] leading-relaxed text-[var(--muted)]">جارٍ تحميل النشاط…</p> : activities?.length ? (
        <ol className="m-0 flex list-none flex-col p-0">
          {activities.map((activity) => {
            const actionText = activity.action === "created"
              ? "أنشأ المهمة"
              : `غيّر الحالة من ${statusLabels[activity.fromStatus ?? "todo"]} إلى ${statusLabels[activity.toStatus]}`
            return (
              <li className="flex items-start gap-2.5 border-b border-[var(--line)] py-2.5 last:border-0" key={activity.id}>
                <span className={`mt-1 size-[9px] shrink-0 rounded-full bg-[var(--brand)] shadow-[0_0_0_4px_var(--brand-soft)] ${activity.action === "status_changed" ? "bg-[var(--green)] shadow-[0_0_0_4px_var(--green-soft)]" : ""}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[11px] leading-[1.8] text-[var(--muted)] [overflow-wrap:anywhere]"><strong className="text-[var(--ink)]">{activity.actorId === currentUid ? "أنت" : "عضو بالفريق"}</strong> {actionText} <b className="text-[var(--ink)]">{activity.taskTitle}</b></p>
                  <time className="mt-1 block text-[9px] text-[var(--muted)]" dateTime={new Date(activity.createdAt).toISOString()}>{new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(activity.createdAt))}</time>
                </div>
              </li>
            )
          })}
        </ol>
      ) : <p className="m-0 pt-4 text-[11px] leading-relaxed text-[var(--muted)]">سيظهر هنا إنشاء المهام وتغيّر حالاتها.</p>}
    </section>
  )
}

function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span>{icon}</span><strong>{title}</strong><p>{description}</p>{action}</div>
}

