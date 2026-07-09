import { createTheme } from '@mui/material/styles'

// Apple Human Interface Guidelines-inspired design system.
// System font stack, Apple system colors, rounded rectangles, translucent
// materials, hairline separators, restrained shadows.

export const SECTION_COLORS = {
  senders: '#007AFF',
  inbox:   '#007AFF',
  storage: '#007AFF',
  labels:  '#007AFF',
} as const

const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif'
const SF_MONO = 'ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Consolas, monospace'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary:   { main: '#007AFF', contrastText: '#ffffff' }, // systemBlue
    secondary: { main: '#5856D6', contrastText: '#ffffff' }, // systemIndigo
    success:   { main: '#34C759', contrastText: '#ffffff' }, // systemGreen
    warning:   { main: '#FF9500', contrastText: '#ffffff' }, // systemOrange
    error:     { main: '#FF3B30', contrastText: '#ffffff' }, // systemRed
    info:      { main: '#007AFF', contrastText: '#ffffff' },
    background: {
      default: '#F2F2F7', // systemGroupedBackground
      paper:   '#FFFFFF',
    },
    text: {
      primary:   '#1C1C1E',              // label
      secondary: 'rgba(60,60,67,0.60)',  // secondaryLabel
    },
    divider: 'rgba(60,60,67,0.18)',      // separator
  },

  typography: {
    fontFamily: SF,
    // Apple text-style-inspired scale, tuned for a dense web app.
    h1: { fontWeight: 700, fontSize: '28px', letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, fontSize: '22px', letterSpacing: '-0.02em' },
    h3: { fontWeight: 600, fontSize: '20px', letterSpacing: '-0.01em' },
    h4: { fontWeight: 600, fontSize: '17px', letterSpacing: '-0.01em' },
    h5: { fontWeight: 600, fontSize: '16px' },
    h6: { fontWeight: 600, fontSize: '15px', letterSpacing: '-0.01em' },
    body1: { fontWeight: 400, fontSize: '15px', lineHeight: 1.47 },
    body2: { fontWeight: 400, fontSize: '13px', lineHeight: 1.45 },
    subtitle1: { fontWeight: 500, fontSize: '15px' },
    subtitle2: { fontWeight: 600, fontSize: '13px' },
    overline: { fontWeight: 600, letterSpacing: '0.06em', fontSize: '11px', textTransform: 'uppercase' },
    button: { fontWeight: 590, fontSize: '15px', textTransform: 'none', letterSpacing: 0 },
    caption: { fontWeight: 400, fontSize: '12px' },
  },

  shape: { borderRadius: 10 },

  components: {
    MuiCssBaseline: {
      styleOverrides: `
        :root {
          /* Apple system tokens reused by components via CSS variables */
          --color-dominant: #1C1C1E;
          --color-dominant-light: #F2F2F7;
          --color-accent: #007AFF;
          --color-accent-soft: rgba(0, 122, 255, 0.10);
          --hairline: rgba(60, 60, 67, 0.18);
          /* Section header materials — Apple system hues */
          --card-date: linear-gradient(135deg, #0A84FF 0%, #007AFF 100%);
          --card-senders: linear-gradient(135deg, #5E5CE6 0%, #5856D6 100%);
          --card-size: linear-gradient(135deg, #FF9F0A 0%, #FF9500 100%);
          --card-hero: linear-gradient(135deg, #0A84FF 0%, #0060DF 100%);
        }

        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; scrollbar-gutter: stable; overflow-y: scroll; }
        body {
          background: #F2F2F7;
          color: #1C1C1E;
          font-family: ${SF};
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        code, pre { font-family: ${SF_MONO}; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(60, 60, 67, 0.28); border-radius: 8px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(60, 60, 67, 0.45); }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 8px 30px rgba(0, 122, 255, 0.18); }
          50%      { box-shadow: 0 8px 40px rgba(0, 122, 255, 0.28); }
        }
      `,
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 10,
          paddingInline: 16,
          minHeight: 34,
          fontWeight: 590,
          transition: 'background-color 120ms ease, opacity 120ms ease, box-shadow 120ms ease, filter 120ms ease',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none', filter: 'brightness(0.96)' },
          '&:active': { filter: 'brightness(0.92)' },
        },
        outlined: {
          borderColor: 'rgba(60, 60, 67, 0.22)',
          '&:hover': { borderColor: 'rgba(60, 60, 67, 0.35)', background: 'rgba(60, 60, 67, 0.04)' },
        },
        text: {
          '&:hover': { background: 'rgba(0, 122, 255, 0.08)' },
        },
        sizeSmall: { minHeight: 30, paddingInline: 12, fontSize: '14px' },
      },
    },

    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: '1px solid rgba(60, 60, 67, 0.10)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 10px 30px rgba(0,0,0,0.05)',
          borderRadius: 14,
          background: '#ffffff',
          backgroundImage: 'none',
        },
      },
    },

    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(60, 60, 67, 0.10)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        },
        rounded: { borderRadius: 14 },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, borderRadius: 8, fontSize: '12.5px' },
        outlined: { borderColor: 'rgba(60,60,67,0.22)' },
        colorPrimary: { background: '#007AFF', color: '#fff' },
        colorSuccess: { background: '#34C759', color: '#fff' },
        colorError:   { background: '#FF3B30', color: '#fff' },
        colorWarning: { background: '#FF9500', color: '#fff' },
        colorInfo:    { background: '#007AFF', color: '#fff' },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 18,
          border: '1px solid rgba(60,60,67,0.10)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontWeight: 600, fontSize: '18px', letterSpacing: '-0.01em' } },
    },

    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          fontSize: '12px',
          textTransform: 'none',
          letterSpacing: 0,
          color: 'rgba(60,60,67,0.60)',
          background: '#F2F2F7',
          borderBottom: '1px solid rgba(60,60,67,0.14)',
        },
        root: { borderColor: 'rgba(60,60,67,0.10)' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background 120ms ease',
          '&.Mui-selected, &.Mui-selected:hover': { background: 'rgba(0,122,255,0.08)' },
        },
      },
    },

    MuiTabs: {
      styleOverrides: {
        indicator: { height: 2.5, borderRadius: '3px 3px 0 0', background: '#007AFF' },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '15px',
          minHeight: 48,
          letterSpacing: '-0.01em',
          '&.Mui-selected': { color: '#007AFF', fontWeight: 600 },
        },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 8, height: 6, background: 'rgba(60,60,67,0.12)' },
        bar: { borderRadius: 8, background: '#007AFF' },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 12, fontWeight: 500, fontSize: '13.5px', boxShadow: 'none' },
      },
    },

    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '13px',
          borderRadius: '9px !important',
          border: '1px solid rgba(60,60,67,0.16) !important',
          color: '#1C1C1E',
          '&.Mui-selected': {
            background: '#ffffff',
            color: '#007AFF',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          },
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 400,
          background: '#ffffff',
          '& fieldset': { borderColor: 'rgba(60,60,67,0.22)' },
          '&:hover fieldset': { borderColor: 'rgba(60,60,67,0.35)' },
          '&.Mui-focused fieldset': { borderColor: '#007AFF', borderWidth: 1 },
        },
      },
    },

    MuiSwitch: {
      styleOverrides: {
        root: { width: 46, height: 28, padding: 0, marginRight: 4 },
        switchBase: {
          padding: 3,
          '&.Mui-checked': { transform: 'translateX(18px)', color: '#fff' },
          '&.Mui-checked + .MuiSwitch-track': { backgroundColor: '#34C759', opacity: 1 },
        },
        thumb: { width: 22, height: 22, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' },
        track: { borderRadius: 14, backgroundColor: 'rgba(120,120,128,0.32)', opacity: 1 },
      },
    },

    MuiMenu: {
      styleOverrides: { paper: { borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.18)' } },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { borderRadius: 8, background: 'rgba(28,28,30,0.92)', fontSize: '12px', fontWeight: 500, padding: '6px 10px' },
      },
    },
  },
})

export default theme
