import type { Metadata, Viewport } from "next"
import "@/app/globals.css"

export const metadata: Metadata = {
  title: "TaskFlow — مساحة عمل فريقك",
  description: "نظّم مشاريع فريقك ومهامه ومواعيده في مساحة عمل واحدة واضحة.",
  applicationName: "TaskFlow",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f8fc",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
