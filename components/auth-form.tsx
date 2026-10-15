"use client"

import { FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createUserWithEmailAndPassword, deleteUser, onAuthStateChanged, signInWithEmailAndPassword, updateProfile } from "firebase/auth"
import { ArrowLeft, Check, Layers3 } from "lucide-react"
import { auth, firebaseReady } from "@/lib/firebase"
import { createUserProfile } from "@/lib/firestore"

function readableAuthError(code: string) {
  const messages: Record<string, string> = {
    "auth/email-already-in-use": "يوجد حساب مسجّل بهذا البريد الإلكتروني.",
    "auth/invalid-email": "تحقّق من صيغة البريد الإلكتروني.",
    "auth/invalid-credential": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "auth/user-not-found": "لا يوجد حساب بهذا البريد الإلكتروني.",
    "auth/wrong-password": "كلمة المرور غير صحيحة.",
    "auth/weak-password": "استخدم كلمة مرور من 6 أحرف على الأقل.",
    "auth/too-many-requests": "محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.",
    "auth/network-request-failed": "تعذّر الاتصال. تحقّق من الإنترنت وحاول مجددًا.",
    "permission-denied": "تعذّر حفظ ملف الحساب في Firestore. راجع قواعد الأمان.",
  }
  return messages[code] ?? "حدث خطأ غير متوقع. حاول مرة أخرى."
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter()
  const registering = mode === "register"
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, (user) => {
      if (user && !registering) router.replace("/")
    })
  }, [router, registering])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    if (!auth) {
      setError("إعدادات Firebase غير مكتملة. أضف إعدادات تطبيق الويب من Firebase إلى متغيرات البيئة.")
      return
    }
    setSaving(true)
    try {
      if (registering) {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
        const name = displayName.trim()
        try {
          await updateProfile(credential.user, { displayName: name })
          await createUserProfile({ uid: credential.user.uid, displayName: name, email: credential.user.email ?? email.trim() })
        } catch (cause) {
          await deleteUser(credential.user).catch(() => undefined)
          throw cause
        }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      }
      router.replace("/")
    } catch (cause) {
      const code = typeof cause === "object" && cause && "code" in cause ? String(cause.code) : "unknown"
      setError(readableAuthError(code))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-panel">
        <div className="auth-content">
          <Link href="/login" className="auth-brand" aria-label="TaskFlow — الصفحة الرئيسية">
            <span className="brand-mark"><Layers3 aria-hidden="true" /></span>
            <span>TaskFlow</span>
          </Link>
          <h1>{registering ? "ابدأ بتنظيم عملك" : "مرحبًا بعودتك"}</h1>
          <p className="auth-subtitle">
            {registering ? "أنشئ حسابك وابدأ التعاون مع فريقك في مساحة واحدة." : "سجّل الدخول لتتابع مشاريعك وما ينتظر فريقك."}
          </p>
          {!firebaseReady && (
            <div className="auth-error" role="alert">
              إعدادات Firebase غير مكتملة. تأكد من إعداد متغيرات Firebase الستة في بيئة المشروع.
            </div>
          )}
          <form className="form-stack" onSubmit={handleSubmit}>
            {registering && (
              <div className="field">
                <label htmlFor="displayName">الاسم</label>
                <input id="displayName" name="name" autoComplete="name" required minLength={2} maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="الاسم الذي يراه فريقك" />
              </div>
            )}
            <div className="field">
              <label htmlFor="email">البريد الإلكتروني</label>
              <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" dir="ltr" />
            </div>
            <div className="field">
              <label htmlFor="password">كلمة المرور</label>
              <input id="password" name="password" type="password" autoComplete={registering ? "new-password" : "current-password"} required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="6 أحرف على الأقل" dir="ltr" />
            </div>
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button className="primary-button full-button" type="submit" disabled={saving || !firebaseReady}>
              {saving ? "جارٍ التحقق…" : registering ? "إنشاء الحساب" : "تسجيل الدخول"}
              {!saving && <ArrowLeft aria-hidden="true" />}
            </button>
          </form>
          <p className="auth-switch">
            {registering ? "لديك حساب بالفعل؟" : "ليس لديك حساب؟"}
            <Link href={registering ? "/login" : "/register"}>{registering ? "سجّل الدخول" : "أنشئ حسابًا"}</Link>
          </p>
        </div>
      </section>
      <aside className="auth-aside" aria-label="مساحة عمل TaskFlow">
        <div className="auth-aside-copy">
          <span className="eyebrow">مساحة واحدة. عمل أوضح.</span>
          <h2>كل مشروع يبدأ بخطوة واضحة.</h2>
          <p>رتّب الأولويات، وزّع المهام، وابقَ على اطلاع بتقدّم فريقك — من دون أن تفقد الصورة الكبيرة.</p>
        </div>
        <div className="auth-proof"><span className="proof-dot" /><span>مساحة عمل آمنة لفريقك ومشاريعك</span><Check aria-hidden="true" /></div>
      </aside>
    </main>
  )
}
