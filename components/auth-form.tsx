"use client"

import { FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createUserWithEmailAndPassword, deleteUser, GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, updateProfile } from "firebase/auth"
import { ArrowLeft, Check, Layers3 } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { auth, firebaseReady } from "@/lib/firebase"
import { createUserProfile, ensureUserProfile } from "@/lib/firestore"

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
    "auth/unauthorized-domain": "هذا النطاق غير مضاف إلى النطاقات المصرّح بها في إعدادات Firebase Authentication.",
    "auth/popup-blocked": "حُظر تسجيل الدخول المنبثق. اسمح بالنوافذ المنبثقة لهذا الموقع ثم حاول مجددًا.",
    "auth/popup-closed-by-user": "أُغلقت نافذة Google قبل اكتمال تسجيل الدخول.",
    "auth/account-exists-with-different-credential": "يوجد حساب بهذا البريد. سجّل الدخول بالطريقة الأصلية أولًا.",
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
      if (user && !registering && !saving && !error) router.replace("/dashboard")
    })
  }, [router, registering, saving, error])

  async function handleGoogleSignIn() {
    setError("")
    if (!auth) {
      setError("إعدادات Firebase غير مكتملة. أضف إعدادات تطبيق الويب من Firebase إلى متغيرات البيئة.")
      return
    }

    setSaving(true)
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: "select_account" })
      const credential = await signInWithPopup(auth, provider)
      await ensureUserProfile({
        uid: credential.user.uid,
        displayName: credential.user.displayName?.trim() || "مستخدم TaskFlow",
        email: credential.user.email ?? "",
      })
      router.replace("/dashboard")
    } catch (cause) {
      const code = typeof cause === "object" && cause && "code" in cause ? String(cause.code) : "unknown"
      setError(readableAuthError(code))
    } finally {
      setSaving(false)
    }
  }

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
      router.replace("/dashboard")
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
          <div className="auth-topline">
            <Link href="/login" className="auth-brand" aria-label="TaskFlow — الصفحة الرئيسية">
              <span className="brand-mark"><Layers3 aria-hidden="true" /></span>
              <span>TaskFlow</span>
            </Link>
            <ThemeToggle />
          </div>
          <h1>{registering ? "ابدأ بتنظيم عملك" : "مرحبًا بعودتك"}</h1>
          <p className="auth-subtitle">
            {registering ? "أنشئ حسابك وابدأ التعاون مع فريقك في مساحة واحدة." : "سجّل الدخول لتتابع مشاريعك وما ينتظر فريقك."}
          </p>
          {!firebaseReady && (
            <div className="auth-error" role="alert">
              إعدادات Firebase غير مكتملة. تأكد من إعداد متغيرات Firebase الستة في بيئة المشروع.
            </div>
          )}
          <button className="google-button" type="button" onClick={handleGoogleSignIn} disabled={saving || !firebaseReady}>
            <GoogleMark />
            <span>{saving ? "جارٍ تسجيل الدخول…" : "المتابعة باستخدام Google"}</span>
          </button>
          <div className="auth-divider"><span>أو بالبريد الإلكتروني</span></div>
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

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" width="18" height="18">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 4)" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 38.06 47 31.86 47 24.55Z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.12.75-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19Z" transform="translate(1 0)" />
      <path fill="#34A853" d="M24 48c6.48 0 11.94-2.13 15.91-5.8l-7.73-6c-2.14 1.44-4.89 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" transform="translate(0 -4)" />
    </svg>
  )
}
