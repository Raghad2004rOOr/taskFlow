import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
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
import type { Member, Project, Task, TaskPriority, TaskStatus, UserProfile } from "@/lib/types"

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

export async function loadWorkspace(uid: string): Promise<Project[]> {
  const store = database()
  const projectResults = await getDocs(
    query(collection(store, "projects"), where("memberIds", "array-contains", uid)),
  )

  return Promise.all(
    projectResults.docs.map(async (projectDocument) => {
      const projectData = projectDocument.data()
      const [taskResults, memberResults] = await Promise.all([
        getDocs(collection(store, "projects", projectDocument.id, "tasks")),
        Promise.all(
          (projectData.memberIds as string[]).map((memberUid) =>
            getDoc(doc(store, "userDirectory", memberUid)),
          ),
        ),
      ])
      const members = memberResults
        .filter((memberDocument) => memberDocument.exists())
        .map((memberDocument) => memberDocument.data() as Member)

      return {
        id: projectDocument.id,
        name: String(projectData.name ?? ""),
        description: String(projectData.description ?? ""),
        ownerId: String(projectData.ownerId ?? ""),
        memberIds: (projectData.memberIds as string[]) ?? [],
        members,
        tasks: taskResults.docs.map((taskDocument) => asTask(taskDocument.id, taskDocument.data())),
        createdAt: timestampValue(projectData.createdAt),
        updatedAt: timestampValue(projectData.updatedAt),
      }
    }),
  )
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
) {
  const store = database()
  const task = doc(collection(store, "projects", projectId, "tasks"))
  await setDoc(task, {
    ...input,
    title: input.title.trim(),
    description: input.description.trim(),
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateTask(
  projectId: string,
  taskId: string,
  input: Pick<Task, "title" | "description" | "status" | "priority" | "assigneeId" | "dueDate">,
) {
  await updateDoc(doc(database(), "projects", projectId, "tasks", taskId), {
    ...input,
    title: input.title.trim(),
    description: input.description.trim(),
    updatedAt: serverTimestamp(),
  })
}

export async function removeTask(projectId: string, taskId: string) {
  const { deleteDoc } = await import("firebase/firestore")
  await deleteDoc(doc(database(), "projects", projectId, "tasks", taskId))
}
