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

// ─── EmailDiet 2.0 "Daylight" — premium AI-productivity light theme ───────────
// Spec: docs/redesign/EMAILDIET-2.0-DESIGN-SPEC.md §1. Green is a verb (actions/
// success only); AI blue marks machine-generated content; blur only on floating
// layers; opaque white cards on a warm-white canvas; neutral shadows.
const INTER = "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

const daylightComponents = {
  Button: {
    baseStyle: { fontWeight: 600, borderRadius: '12px' },
    defaultProps: { colorScheme: 'brand' },
  },
  Card: {
    baseStyle: {
      container: {
        borderRadius: '18px',
        boxShadow: 'e1',
        border: '1px solid',
        borderColor: 'border.subtle',
        bg: 'bg.card',
        // opaque — no backdropFilter (blur is reserved for floating layers)
      },
    },
  },
  Modal: {
    baseStyle: {
      dialog: {
        borderRadius: '20px',
        bg: 'bg.card',
        boxShadow: 'e3',
        border: '1px solid',
        borderColor: 'border.subtle',
      },
    },
  },
  Input: {
    defaultProps: { focusBorderColor: 'brand.500' },
    variants: {
      outline: {
        field: {
          borderRadius: '12px',
          bg: 'bg.input',
          borderColor: 'border.subtle',
          _hover: { borderColor: 'border.strong' },
        },
      },
    },
  },
  Select: {
    defaultProps: { focusBorderColor: 'brand.500' },
    variants: {
      outline: {
        field: {
          borderRadius: '12px',
          bg: 'bg.input',
          borderColor: 'border.subtle',
          _hover: { borderColor: 'border.strong' },
        },
      },
    },
  },
  Tabs: {
    baseStyle: { tab: { fontWeight: 600, borderRadius: '10px' } },
    variants: {
      'soft-rounded': {
        tab: {
          borderRadius: '10px',
          fontWeight: 600,
          color: 'text.secondary',
          _selected: { color: 'text.primary', bg: 'bg.muted' },
        },
      },
    },
    defaultProps: { variant: 'soft-rounded' },
  },
  Tag: {
    baseStyle: { container: { fontWeight: 600, borderRadius: 'full' } },
  },
}

export const daylightTheme = extendTheme({
  config,
  fonts: { heading: INTER, body: INTER, mono: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace" },
  radii: { card: '18px', panel: '20px', control: '12px' },
  shadows: {
    e1: '0 1px 2px rgba(17,24,39,0.05)',
    e2: '0 4px 12px rgba(17,24,39,0.08)',
    e3: '0 12px 32px rgba(17,24,39,0.12)',
    outline: '0 0 0 2px rgba(139,92,246,0.55)', // lavender focus ring
  },
  colors: {
    // Emerald — the action/success color. brand.500 is the one primary green.
    brand: {
      50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399',
      500: '#15803D', 600: '#166534', 700: '#14532d', 800: '#0f3d22', 900: '#0a2c18',
    },
    // Royal blue — anything AI-generated.
    ai: {
      50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa',
      500: '#2563EB', 600: '#1d4ed8', 700: '#1e40af', 800: '#1e3a8a', 900: '#172554',
    },
    // Lavender — selection, focus, tertiary chart accent.
    highlight: {
      50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa',
      500: '#8B5CF6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95',
    },
    accent: { 50: '#fdfbf7', 100: '#F6F7F5', 200: '#e5e7eb' },
  },
  semanticTokens: {
    colors: {
      'bg.app': { default: '#FCFCFA', _dark: '#0F1115' },
      'bg.card': { default: '#FFFFFF', _dark: '#16181D' },
      'bg.glass': { default: 'rgba(255,255,255,0.72)', _dark: 'rgba(22,24,29,0.72)' },
      'bg.muted': { default: '#F6F7F5', _dark: '#1C1F26' },
      'bg.input': { default: '#FFFFFF', _dark: '#1C1F26' },
      'bg.accent': { default: '#F0FDF4', _dark: 'rgba(34,197,94,0.12)' }, // faint emerald wash for active nav/selection
      'bg.tray': { default: '#111827', _dark: '#000000' },
      'bg.hover': { default: '#F6F7F5', _dark: 'rgba(255,255,255,0.06)' },
      'text.primary': { default: '#111827', _dark: '#F3F4F6' },
      'text.secondary': { default: '#6B7280', _dark: '#9CA3AF' },
      'text.tertiary': { default: '#9CA3AF', _dark: '#6B7280' },
      'text.inverse': { default: '#FFFFFF', _dark: '#FFFFFF' },
      'border.subtle': { default: '#E9ECEF', _dark: 'rgba(255,255,255,0.08)' },
      'border.strong': { default: '#D1D5DB', _dark: 'rgba(255,255,255,0.16)' },
      'border.glass': { default: 'rgba(233,236,239,0.6)', _dark: 'rgba(255,255,255,0.08)' },
      'brand.icon': { default: '#15803D', _dark: '#22C55E' },
      'ai.solid': { default: '#2563EB', _dark: '#3B82F6' },
    },
  },
  styles: {
    global: {
      body: { bg: 'bg.app', color: 'text.primary' },
      '*::selection': { bg: 'rgba(139,92,246,0.18)' },
    },
  },
  components: daylightComponents,
})

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
