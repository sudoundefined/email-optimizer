import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type AppTheme = 'daylight' | 'botanical' | 'sage'

interface ThemeContextType {
  theme: AppTheme
  setTheme: (t: AppTheme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('app-theme') as AppTheme
    return (saved === 'daylight' || saved === 'botanical' || saved === 'sage') ? saved : 'daylight'
  })

  useEffect(() => {
    localStorage.setItem('app-theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useAppTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useAppTheme must be used within an AppThemeProvider')
  return context
}
