import { AuthGate } from "@/components/auth-gate"

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AuthGate projectId={id} />
}
