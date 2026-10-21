import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { AppNotification, Member, Project, ProjectActivity, Task, TaskPriority, TaskStatus, UserProfile } from "@/lib/types"

function database() {
  if (!db) throw new Error("Firebase غير مهيأ. أضف إعدادات Firebase إلى متغيرات البيئة.")
  return db
}

function timestampValue(value: unknown): number {
  if (typeof value === "number") return value
  if (value && typeof (value as Timestamp).toMillis === "function") return (value as Timestamp).toMillis()
  return 0
}

function asTask(id: string, data: DocumentData): Task {
  return {
    id,
    title: String(data.title ?? ""),
    description: String(data.description ?? ""),
    status: data.status as TaskStatus,
    priority: data.priority as TaskPriority,
    assigneeId: typeof data.assigneeId === "string" ? data.assigneeId : null,
    createdBy: String(data.createdBy ?? ""),
    dueDate: typeof data.dueDate === "string" ? data.dueDate : null,
    createdAt: timestampValue(data.createdAt),
    updatedAt: timestampValue(data.updatedAt),
  }
}

export async function createUserProfile(profile: UserProfile) {
  const store = database()
  const batch = writeBatch(store)
  const emailKey = profile.email.trim().toLowerCase()
  batch.set(doc(store, "users", profile.uid), { ...profile, createdAt: serverTimestamp() })
  batch.set(doc(store, "userDirectory", profile.uid), { uid: profile.uid, displayName: profile.displayName })
  batch.set(doc(store, "memberIndex", emailKey), profile)
  await batch.commit()
}

export async function ensureUserProfile(profile: UserProfile) {
  if (!profile.email.trim()) throw new Error("تعذّر الحصول على البريد الإلكتروني من حساب Google.")
  const store = database()
  const profileReference = doc(store, "users", profile.uid)
  const profileDocument = await getDoc(profileReference)
  if (!profileDocument.exists()) await createUserProfile(profile)
}

export async function loadWorkspace(uid: string): Promise<Project[]> {
  const store = database()
  const projectResults = await getDocs(
    query(collection(store, "projects"), where("memberIds", "array-contains", uid)),
  )
  const projectDocuments = projectResults.docs.map((projectDocument) => ({
    document: projectDocument,
    data: projectDocument.data(),
  }))
  const memberUids = [...new Set(projectDocuments.flatMap(({ data }) =>
    Array.isArray(data.memberIds) ? data.memberIds.filter((memberUid): memberUid is string => typeof memberUid === "string") : [],
  ))]

  const [taskResultsByProject, memberResults] = await Promise.all([
    Promise.all(projectDocuments.map(({ document }) =>
      getDocs(collection(store, "projects", document.id, "tasks")),
    )),
    Promise.all(memberUids.map((memberUid) => getDoc(doc(store, "userDirectory", memberUid)))),
  ])
  const membersByUid = new Map(
    memberResults
      .filter((memberDocument) => memberDocument.exists())
      .map((memberDocument) => [memberDocument.id, memberDocument.data() as Member]),
  )

  return projectDocuments.map(({ document, data }, index) => {
    const memberIds = Array.isArray(data.memberIds) ? data.memberIds as string[] : []
    return {
      id: document.id,
      name: String(data.name ?? ""),
      description: String(data.description ?? ""),
      ownerId: String(data.ownerId ?? ""),
      memberIds,
      members: memberIds.flatMap((memberUid) => {
        const member = membersByUid.get(memberUid)
        return member ? [member] : []
      }),
      tasks: taskResultsByProject[index].docs.map((taskDocument) => asTask(taskDocument.id, taskDocument.data())),
      createdAt: timestampValue(data.createdAt),
      updatedAt: timestampValue(data.updatedAt),
    }
  })
}

export async function createProject(input: { name: string; description: string; uid: string }) {
  const store = database()
  const project = doc(collection(store, "projects"))
  await setDoc(project, {
    name: input.name.trim(),
    description: input.description.trim(),
    ownerId: input.uid,
    memberIds: [input.uid],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateProject(projectId: string, input: { name: string; description: string }) {
  await updateDoc(doc(database(), "projects", projectId), {
    name: input.name.trim(),
    description: input.description.trim(),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteProjectWhenEmpty(projectId: string) {
  const store = database()
  const tasks = await getDocs(collection(store, "projects", projectId, "tasks"))
  if (!tasks.empty) throw new Error("لا يمكن حذف مشروع يحتوي على مهام. احذف المهام أولًا.")
  const { deleteDoc } = await import("firebase/firestore")
  await deleteDoc(doc(store, "projects", projectId))
}

export async function addProjectMember(projectId: string, email: string) {
  const store = database()
  const normalizedEmail = email.trim().toLowerCase()
  const memberDocument = await getDoc(doc(store, "memberIndex", normalizedEmail))
  if (!memberDocument.exists()) throw new Error("لم نعثر على حساب مسجل بهذا البريد الإلكتروني.")
  const member = memberDocument.data() as Member
  const projectReference = doc(store, "projects", projectId)

  await runTransaction(store, async (transaction) => {
    const projectDocument = await transaction.get(projectReference)
    if (!projectDocument.exists()) throw new Error("هذا المشروع لم يعد موجودًا.")
    const project = projectDocument.data()
    const memberIds = project.memberIds as string[]
    if (memberIds.includes(member.uid)) throw new Error("هذا العضو موجود في المشروع بالفعل.")
    if (memberIds.length >= 50) throw new Error("وصل المشروع إلى الحد الأقصى للأعضاء (50 عضوًا).")
    transaction.update(projectReference, {
      memberIds: arrayUnion(member.uid),
      updatedAt: serverTimestamp(),
    })
  })
  return member
}

export async function removeProjectMember(projectId: string, memberUid: string, ownerUid: string) {
  if (memberUid === ownerUid) throw new Error("لا يمكن للمالك إزالة نفسه من المشروع.")
  const store = database()
  const taskResults = await getDocs(collection(store, "projects", projectId, "tasks"))
  const assignedTasks = taskResults.docs.filter((taskDocument) => taskDocument.data().assigneeId === memberUid)

  for (let start = 0; start < assignedTasks.length; start += 450) {
    const batch = writeBatch(store)
    assignedTasks.slice(start, start + 450).forEach((taskDocument) => {
      batch.update(taskDocument.ref, { assigneeId: null, updatedAt: serverTimestamp() })
    })
    await batch.commit()
  }

  await updateDoc(doc(store, "projects", projectId), {
    memberIds: arrayRemove(memberUid),
    updatedAt: serverTimestamp(),
  })
}

export async function createTask(
  projectId: string,
  uid: string,
  input: Pick<Task, "title" | "description" | "status" | "priority" | "assigneeId" | "dueDate">,
): Promise<string> {
  const store = database()
  const task = doc(collection(store, "projects", projectId, "tasks"))
  const activity = doc(collection(store, "projects", projectId, "activities"))
  const now = serverTimestamp()
  const batch = writeBatch(store)
  batch.set(task, {
    ...input,
    title: input.title.trim(),
    description: input.description.trim(),
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  })
  batch.set(activity, {
    action: "created",
    taskId: task.id,
    taskTitle: input.title.trim(),
    actorId: uid,
    fromStatus: null,
    toStatus: input.status,
    createdAt: now,
  })
  await batch.commit()
  return task.id
}

export async function updateTask(
  projectId: string,
  taskId: string,
  input: Pick<Task, "title" | "description" | "status" | "priority" | "assigneeId" | "dueDate">,
  actorUid: string,
  previousStatus: TaskStatus,
) {
  const store = database()
  const taskReference = doc(store, "projects", projectId, "tasks", taskId)
  const batch = writeBatch(store)
  batch.update(taskReference, {
    ...input,
    title: input.title.trim(),
    description: input.description.trim(),
    updatedAt: serverTimestamp(),
  })
  if (previousStatus !== input.status) {
    const activity = doc(collection(store, "projects", projectId, "activities"))
    batch.set(activity, {
      action: "status_changed",
      taskId,
      taskTitle: input.title.trim(),
      actorId: actorUid,
      fromStatus: previousStatus,
      toStatus: input.status,
      createdAt: serverTimestamp(),
    })
  }
  await batch.commit()
}

export async function removeTask(projectId: string, taskId: string) {
  await deleteDoc(doc(database(), "projects", projectId, "tasks", taskId))
}

export async function createNotification(
  recipientUid: string,
  notification: Omit<AppNotification, "id" | "read" | "createdAt">,
) {
  await createNotifications([{ recipientUid, notification }])
}

export async function createNotifications(
  notifications: Array<{
    recipientUid: string
    notification: Omit<AppNotification, "id" | "read" | "createdAt">
  }>,
) {
  const pending = notifications.filter(({ recipientUid, notification }) => recipientUid !== notification.actorId)
  if (pending.length === 0) return

  const store = database()
  for (let start = 0; start < pending.length; start += 450) {
    const batch = writeBatch(store)
    pending.slice(start, start + 450).forEach(({ recipientUid, notification }) => {
      const notificationReference = doc(collection(store, "users", recipientUid, "notifications"))
      batch.set(notificationReference, { ...notification, read: false, createdAt: serverTimestamp() })
    })
    await batch.commit()
  }
}

export async function loadProjectActivity(projectId: string): Promise<ProjectActivity[]> {
  const results = await getDocs(query(
    collection(database(), "projects", projectId, "activities"),
    orderBy("createdAt", "desc"),
    limit(30),
  ))
  return results.docs.map((activityDocument) => {
    const data = activityDocument.data()
    return {
      id: activityDocument.id,
      action: data.action as ProjectActivity["action"],
      taskId: String(data.taskId ?? ""),
      taskTitle: String(data.taskTitle ?? "مهمة بدون عنوان"),
      actorId: String(data.actorId ?? ""),
      fromStatus: data.fromStatus as TaskStatus | null,
      toStatus: data.toStatus as TaskStatus,
      createdAt: timestampValue(data.createdAt),
    }
  })
}

export async function loadNotifications(uid: string): Promise<AppNotification[]> {
  const store = database()
  const results = await getDocs(query(
    collection(store, "users", uid, "notifications"),
    orderBy("createdAt", "desc"),
    limit(30),
  ))
  return results.docs.map((notificationDocument) => {
    const data = notificationDocument.data()
    return {
      id: notificationDocument.id,
      type: data.type as AppNotification["type"],
      title: String(data.title ?? "إشعار جديد"),
      message: String(data.message ?? ""),
      projectId: String(data.projectId ?? ""),
      taskId: typeof data.taskId === "string" ? data.taskId : null,
      actorId: String(data.actorId ?? ""),
      read: data.read === true,
      createdAt: timestampValue(data.createdAt),
    }
  })
}

export async function markNotificationRead(uid: string, notificationId: string) {
  await updateDoc(doc(database(), "users", uid, "notifications", notificationId), { read: true })
}

export async function markAllNotificationsRead(uid: string, notificationIds: string[]) {
  const store = database()
  for (let start = 0; start < notificationIds.length; start += 450) {
    const batch = writeBatch(store)
    notificationIds.slice(start, start + 450).forEach((notificationId) => {
      batch.update(doc(store, "users", uid, "notifications", notificationId), { read: true })
    })
    await batch.commit()
  }
}
