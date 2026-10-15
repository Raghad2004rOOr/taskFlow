import type { Metadata, Viewport } from "next"
import { cookies } from "next/headers"
import { ThemeProvider, type Theme } from "@/components/theme-provider"
import "@/app/globals.css"

export const metadata: Metadata = {
  title: "TaskFlow — مساحة عمل فريقك",
  description: "نظّم مشاريع فريقك ومهامه ومواعيده في مساحة عمل واحدة واضحة.",
  applicationName: "TaskFlow",
}

export async function generateViewport(): Promise<Viewport> {
  const theme = (await cookies()).get("taskflow-theme")?.value
  return {
    width: "device-width",
    initialScale: 1,
    themeColor: theme === "dark" ? "#171824" : "#f7f8fc",
  }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const savedTheme = (await cookies()).get("taskflow-theme")?.value
  const initialTheme: Theme = savedTheme === "dark" ? "dark" : "light"

  return (
    <html lang="ar" dir="rtl" data-theme={initialTheme}>
      <body><ThemeProvider initialTheme={initialTheme}>{children}</ThemeProvider></body>
    </html>
  )
}
