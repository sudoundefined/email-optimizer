import React from 'react'
import ReactDOM from 'react-dom/client'
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react'
import '@fontsource-variable/inter'
import { daylightTheme, botanicalTheme, espressoTheme } from './theme/themes'
import { AppThemeProvider, useAppTheme } from './theme/ThemeContext'
import App from './App'

function ChakraWrapper({ children }: { children: React.ReactNode }) {
  const { theme } = useAppTheme()
  const activeTheme = theme === 'botanical' ? botanicalTheme
    : theme === 'espresso' ? espressoTheme
    : daylightTheme
  return <ChakraProvider theme={activeTheme}>{children}</ChakraProvider>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ColorModeScript initialColorMode={daylightTheme.config.initialColorMode} />
    <AppThemeProvider>
      <ChakraWrapper>
        <App />
      </ChakraWrapper>
    </AppThemeProvider>
  </React.StrictMode>
)
