"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged, type User } from "firebase/auth"
import { auth, firebaseReady } from "@/lib/firebase"
import { TaskFlowApp } from "@/components/taskflow-app"

export function AuthGate({ projectId }: { projectId?: string }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!auth) {
      setChecking(false)
      return
    }
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setChecking(false)
      if (!currentUser) router.replace("/login")
    })
  }, [router])

  if (checking) {
    return <main className="loading-page"><div className="loading-card"><span className="skeleton-block" /><span className="skeleton-block" /><p>جارٍ التحقق من الجلسة…</p></div></main>
  }

  if (!firebaseReady) {
    return (
      <main className="loading-page">
        <section className="setup-notice" dir="rtl">
          <h1>أكمل ربط Firebase</h1>
          <p>أضف إعدادات تطبيق الويب في Firebase إلى متغيرات البيئة. يحتاج TaskFlow إلى Firebase Authentication وCloud Firestore لتسجيل الدخول وحفظ المشاريع والمهام.</p>
          <p><code>NEXT_PUBLIC_FIREBASE_API_KEY</code> وبيانات Firebase الخمس الأخرى.</p>
          <a className="secondary-button" href="/login">العودة إلى تسجيل الدخول</a>
        </section>
      </main>
    )
  }

  return user ? <TaskFlowApp user={user} projectId={projectId} /> : null
}
