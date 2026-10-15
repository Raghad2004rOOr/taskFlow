"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme-provider"

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const nextTheme = theme === "dark" ? "light" : "dark"
  const Icon = theme === "dark" ? Sun : Moon

  return (
    <button
      className="icon-button theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={`تفعيل الوضع ${nextTheme === "dark" ? "الداكن" : "الفاتح"}`}
      aria-pressed={theme === "dark"}
      title={`تفعيل الوضع ${nextTheme === "dark" ? "الداكن" : "الفاتح"}`}
    >
      <Icon aria-hidden="true" />
    </button>
  )
}
