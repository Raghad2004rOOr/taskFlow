"use client"

import { FormEvent, useState } from "react"
import { X } from "lucide-react"
import type { Project } from "@/lib/types"

interface ProjectFormValue { name: string; description: string }

export function ProjectDialog({
  project,
  onClose,
  onSave,
}: {
  project: Project | null
  onClose: () => void
  onSave: (value: ProjectFormValue) => Promise<void>
}) {
  const [name, setName] = useState(project?.name ?? "")
  const [description, setDescription] = useState(project?.description ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSaving(true)
    try {
      await onSave({ name: name.trim(), description: description.trim() })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذّر حفظ المشروع. حاول مرة أخرى.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onKeyDown={(event) => { if (event.key === "Escape") onClose() }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="project-dialog-title">
        <div className="modal-heading">
          <div>
            <h2 id="project-dialog-title">{project ? "تعديل المشروع" : "مشروع جديد"}</h2>
            <p>{project ? "حدّث اسم المشروع ووصفه." : "أنشئ مساحة واضحة لتنظيم عمل فريقك."}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="إغلاق"><X /></button>
        </div>
        <form className="form-stack" onSubmit={submit}>
          <div className="field">
            <label htmlFor="project-name">اسم المشروع</label>
            <input id="project-name" required minLength={3} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="مثال: تطوير الموقع" autoFocus />
          </div>
          <div className="field">
            <label htmlFor="project-description">الوصف <span className="muted-inline">(اختياري)</span></label>
            <textarea id="project-description" maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="ما الذي يعمل عليه الفريق؟" />
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <div className="modal-actions">
            <button className="quiet-button" type="button" onClick={onClose}>إلغاء</button>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? "جارٍ الحفظ…" : project ? "حفظ التعديلات" : "إنشاء المشروع"}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
