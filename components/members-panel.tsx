import type { FormEvent } from "react"
import { UserPlus, X } from "lucide-react"
import type { Member, Project } from "@/lib/types"

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return `${parts[0]?.[0] ?? "T"}${parts[1]?.[0] ?? ""}`.toUpperCase()
}

export function MembersPanel({ project, isOwner, memberEmail, onMemberEmailChange, addingMember, onAddMember, onRemoveMember }: {
  project: Project
  isOwner: boolean
  memberEmail: string
  onMemberEmailChange: (value: string) => void
  addingMember: boolean
  onAddMember: (event: FormEvent<HTMLFormElement>) => void
  onRemoveMember: (member: Member) => void
}) {
  return (
    <section className="member-box">
      <div className="panel-heading"><div><h3>أعضاء المشروع</h3><p>الأعضاء الحاليون لديهم وصول إلى مهام المشروع.</p></div><span className="stat-icon"><UserPlus aria-hidden="true" /></span></div>
      <div className="member-management">
        {project.members.map((member) => (
          <div className="member-line" key={member.uid}>
            <span className="avatar">{initials(member.displayName)}</span>
            <span>{member.displayName}<small>{member.email || "عضو في المشروع"}{member.uid === project.ownerId ? " · مالك المشروع" : ""}</small></span>
            {isOwner && member.uid !== project.ownerId && <button className="icon-button danger-icon" aria-label={`إزالة ${member.displayName}`} title="إزالة العضو" onClick={() => onRemoveMember(member)}><X /></button>}
          </div>
        ))}
      </div>
      {isOwner && <form className="member-form" onSubmit={onAddMember}><label className="sr-only" htmlFor="member-email">البريد الإلكتروني للعضو</label><input id="member-email" type="email" maxLength={254} required value={memberEmail} onChange={(event) => onMemberEmailChange(event.target.value)} placeholder="البريد الإلكتروني للعضو" /><button type="submit" aria-label="إضافة عضو" disabled={addingMember}><UserPlus /></button></form>}
    </section>
  )
}
