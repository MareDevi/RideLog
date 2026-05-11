import { useEffect, useState } from "react"
import { useTheme } from "@/components/theme-provider"

type ResolvedMapTheme = "dark" | "light"

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)"

const MAP_STYLE_URLS: Record<ResolvedMapTheme, string> = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
}

function resolveSystemTheme(): ResolvedMapTheme {
  const root = document.documentElement

  if (root.classList.contains("dark")) {
    return "dark"
  }

  if (root.classList.contains("light")) {
    return "light"
  }

  return window.matchMedia(COLOR_SCHEME_QUERY).matches ? "dark" : "light"
}

export function useMapStyleUrl() {
  const { theme } = useTheme()
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedMapTheme>(() => {
    if (theme === "dark" || theme === "light") {
      return theme
    }

    return resolveSystemTheme()
  })

  useEffect(() => {
    if (theme === "dark" || theme === "light") {
      setResolvedTheme(theme)
      return undefined
    }

    const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY)
    const syncTheme = () => setResolvedTheme(resolveSystemTheme())

    syncTheme()
    mediaQuery.addEventListener("change", syncTheme)

    return () => {
      mediaQuery.removeEventListener("change", syncTheme)
    }
  }, [theme])

  return MAP_STYLE_URLS[resolvedTheme]
}
