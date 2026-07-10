import React from 'react'
import ReactDOM from 'react-dom/client'
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react'
import { botanicalTheme, espressoTheme } from './theme/themes'
import { AppThemeProvider, useAppTheme } from './theme/ThemeContext'
import App from './App'

function ChakraWrapper({ children }: { children: React.ReactNode }) {
  const { theme } = useAppTheme()
  const activeTheme = theme === 'botanical' ? botanicalTheme : espressoTheme
  return <ChakraProvider theme={activeTheme}>{children}</ChakraProvider>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ColorModeScript initialColorMode={botanicalTheme.config.initialColorMode} />
    <AppThemeProvider>
      <ChakraWrapper>
        <App />
      </ChakraWrapper>
    </AppThemeProvider>
  </React.StrictMode>
)
