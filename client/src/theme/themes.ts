import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
}

const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif'
const SF_MONO = 'ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Consolas, monospace'

const baseComponents = {
  Button: {
    baseStyle: {
      fontWeight: 600,
      borderRadius: 'full',
    },
    defaultProps: {
      colorScheme: 'brand',
    }
  },
  Card: {
    baseStyle: {
      container: {
        borderRadius: '3xl',
        boxShadow: 'xl',
        border: '1px solid',
        borderColor: 'border.glass',
        bg: 'bg.card',
        backdropFilter: 'blur(12px)',
      }
    }
  },
  Modal: {
    baseStyle: {
      dialog: {
        borderRadius: '3xl',
        bg: 'bg.card',
        backdropFilter: 'blur(12px)',
        boxShadow: '2xl',
        border: '1px solid',
        borderColor: 'border.glass',
      }
    }
  },
  Input: {
    defaultProps: {
      focusBorderColor: 'brand.500',
    },
    variants: {
      outline: {
        field: {
          borderRadius: 'xl',
          bg: 'bg.input',
          borderColor: 'border.subtle',
          _hover: { borderColor: 'brand.400' }
        }
      }
    }
  },
  Select: {
    defaultProps: {
      focusBorderColor: 'brand.500',
    },
    variants: {
      outline: {
        field: {
          borderRadius: 'xl',
          bg: 'bg.input',
          borderColor: 'border.subtle',
          _hover: { borderColor: 'brand.400' }
        }
      }
    }
  },
  Tabs: {
    baseStyle: {
      tab: {
        fontWeight: 600,
        borderRadius: 'full',
      }
    },
    variants: {
      'soft-rounded': {
        tab: {
          borderRadius: 'full',
          fontWeight: 600,
          color: 'text.secondary',
          _selected: {
            color: 'text.primary',
            bg: 'bg.accent',
          },
        },
      },
    },
    defaultProps: {
      variant: 'soft-rounded',
    }
  },
  Tag: {
    baseStyle: {
      container: {
        fontWeight: 600,
        borderRadius: 'full',
      }
    }
  }
}

export const botanicalTheme = extendTheme({
  config,
  fonts: { heading: SF, body: SF, mono: SF_MONO },
  colors: {
    brand: {
      50: '#eef6f1',
      100: '#d5e9dc',
      200: '#A8D8B9', // Mint Green
      300: '#89c59c',
      400: '#6C9D94', // Muted Teal
      500: '#3E7B4C', // Deep Forest (Primary Action)
      600: '#32673f', 
      700: '#2E4D38', // Very Dark Green
      800: '#1b3223',
      900: '#102116', 
    },
    accent: {
      50: '#fdfbf7',
      100: '#F1E7D3', // Cream
      200: '#e5d3b6',
    },
  },
  semanticTokens: {
    colors: {
      'bg.app': { default: '#F1E7D3', _dark: '#16281e' },
      'bg.card': { default: 'whiteAlpha.800', _dark: 'blackAlpha.600' },
      'bg.glass': { default: 'whiteAlpha.600', _dark: 'blackAlpha.400' },
      'bg.input': { default: 'white', _dark: 'whiteAlpha.100' },
      'bg.accent': { default: 'blackAlpha.100', _dark: 'whiteAlpha.200' },
      'bg.tray': { default: '#2E4D38', _dark: '#1b3223' }, // Very Dark Green
      'bg.hover': { default: 'blackAlpha.50', _dark: 'whiteAlpha.100' },
      'text.primary': { default: '#102116', _dark: '#F1E7D3' },
      'text.secondary': { default: '#3E7B4C', _dark: '#A8D8B9' },
      'text.inverse': { default: 'white', _dark: 'white' },
      'border.glass': { default: 'whiteAlpha.600', _dark: 'whiteAlpha.200' },
      'border.subtle': { default: 'blackAlpha.200', _dark: 'whiteAlpha.200' },
      'brand.icon': { default: '#3E7B4C', _dark: '#A8D8B9' },
    }
  },
  styles: {
    global: {
      body: {
        bg: 'bg.app',
        color: 'text.primary',
      },
    },
  },
  components: baseComponents,
})

export const espressoTheme = extendTheme({
  config,
  fonts: { heading: SF, body: SF, mono: SF_MONO },
  colors: {
    brand: {
      50: '#fbf8f5',
      100: '#f2e6d9',
      200: '#E7B475', // Warm Sandy Orange
      300: '#d89b52',
      400: '#C49A6A', // Light Warm Brown/Camel
      500: '#6E4C3E', // Dark Warm Brown (Primary Action)
      600: '#5c3d31',
      700: '#4B3C32', // Very Dark Espresso
      800: '#2d221c',
      900: '#1a1310',
    },
    accent: {
      50: '#fefdfb',
      100: '#F9F2E1', // Creamy Off-White
      200: '#f0dfbd',
    },
  },
  semanticTokens: {
    colors: {
      'bg.app': { default: '#F9F2E1', _dark: '#28201a' },
      'bg.card': { default: 'whiteAlpha.900', _dark: 'blackAlpha.600' },
      'bg.glass': { default: 'whiteAlpha.600', _dark: 'blackAlpha.400' },
      'bg.input': { default: 'white', _dark: 'whiteAlpha.100' },
      'bg.accent': { default: 'blackAlpha.100', _dark: 'whiteAlpha.200' },
      'bg.tray': { default: '#4B3C32', _dark: '#2d221c' }, // Espresso
      'bg.hover': { default: 'blackAlpha.50', _dark: 'whiteAlpha.100' },
      'text.primary': { default: '#2d221c', _dark: '#F9F2E1' },
      'text.secondary': { default: '#6E4C3E', _dark: '#E7B475' },
      'text.inverse': { default: 'white', _dark: 'white' },
      'border.glass': { default: 'whiteAlpha.600', _dark: 'whiteAlpha.200' },
      'border.subtle': { default: 'blackAlpha.200', _dark: 'whiteAlpha.200' },
      'brand.icon': { default: '#6E4C3E', _dark: '#E7B475' },
    }
  },
  styles: {
    global: {
      body: {
        bg: 'bg.app',
        color: 'text.primary',
      },
    },
  },
  components: baseComponents,
})
