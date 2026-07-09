import { createTheme } from '@mui/material/styles'

export const SECTION_COLORS = {
  senders: '#2563eb',   // blue
  inbox:   '#2563eb',   // blue
  storage: '#2563eb',   // blue
  labels:  '#2563eb',   // blue
} as const

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main:  '#2563eb', // Electric Blue
      contrastText: '#ffffff',
    },
    secondary: {
      main:  '#1e293b', // Slate 800
      contrastText: '#ffffff',
    },
    success: { main: '#10b981' },
    warning: { main: '#f59e0b' },
    error:   { main: '#ef4444' },
    info:    { main: '#3b82f6' },
    background: {
      default: '#f3f4f6', // Gray 100
      paper:   '#ffffff',
    },
    text: {
      primary:   '#1e293b',
      secondary: '#64748b',
    },
    divider: 'rgba(15, 23, 42, 0.08)',
  },

  typography: {
    fontFamily: '"Inter", "SF Pro Display", "Roboto", system-ui, sans-serif',
    h1: { fontWeight: 700, fontSize: '36px', letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, fontSize: '28px', letterSpacing: '-0.01em' },
    h3: { fontWeight: 600, fontSize: '24px' },
    h4: { fontWeight: 600, fontSize: '20px' },
    h5: { fontWeight: 600, fontSize: '18px' },
    h6: { fontWeight: 600, fontSize: '16px' },
    body1: { fontWeight: 400, fontSize: '14px', lineHeight: 1.5 },
    body2: { fontWeight: 400, fontSize: '13px', lineHeight: 1.5 },
    subtitle1: { fontWeight: 500, fontSize: '14px' },
    subtitle2: { fontWeight: 500, fontSize: '13px' },
    overline: { fontWeight: 600, letterSpacing: '0.05em', fontSize: '11px', textTransform: 'uppercase' },
    button: { fontWeight: 500, fontSize: '14px', textTransform: 'none' },
  },

  shape: { borderRadius: 0 },

  components: {
    MuiCssBaseline: {
      styleOverrides: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        
        :root {
          --color-dominant: #0f172a;
          --color-dominant-light: #f1f5f9;
          --color-accent: #2563eb;
          --color-accent-soft: rgba(37, 99, 235, 0.08);
          --card-date: linear-gradient(135deg, #0ea5e9, #2563eb);
          --card-senders: linear-gradient(135deg, #8b5cf6, #6366f1);
          --card-size: linear-gradient(135deg, #f59e0b, #ef4444);
          --card-hero: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%);
        }

        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { 
          background: var(--color-dominant-light);
          background-image:
            radial-gradient(ellipse 80% 50% at 20% 80%, rgba(37, 99, 235, 0.06), transparent),
            radial-gradient(ellipse 60% 40% at 80% 20%, rgba(139, 92, 246, 0.05), transparent);
          background-attachment: fixed;
          color: var(--color-dominant); 
          -webkit-font-smoothing: antialiased;
        }
        code, pre { font-family: "JetBrains Mono", monospace; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(30, 41, 59, 0.15); border-radius: 8px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(30, 41, 59, 0.3); }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(37, 99, 235, 0.15); }
          50%      { box-shadow: 0 0 40px rgba(37, 99, 235, 0.25); }
        }
      `,
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 8,
          transition: 'all 150ms ease',
        },
        contained: {
          boxShadow: '0 4px 10px rgba(37, 99, 235, 0.2)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
          },
        },
        outlined: {
          borderColor: 'rgba(30, 41, 59, 0.15)',
        }
      },
    },

    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: '1px solid rgba(30, 41, 59, 0.08)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03), 0 2px 4px rgba(0, 0, 0, 0.02)',
          borderRadius: 0,
          background: '#ffffff',
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, borderRadius: 6 },
        colorPrimary: { background: 'var(--color-accent)', color: '#fff' },
        colorSuccess: { background: '#10b981', color: '#fff' },
        colorError:   { background: '#ef4444', color: '#fff' },
        colorWarning: { background: '#f59e0b', color: '#fff' },
        colorInfo:    { background: '#3b82f6', color: '#fff' },
      },
    },

    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { 
          backgroundImage: 'none', 
          border: '1px solid rgba(30, 41, 59, 0.08)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
        },
        rounded: { borderRadius: 0 },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          fontSize: '12px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#64748b',
          background: '#f8fafc',
          borderBottom: '1px solid rgba(30, 41, 59, 0.08)',
        },
        root: { borderColor: 'rgba(30, 41, 59, 0.06)' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background 150ms ease',
          '&.Mui-selected, &.Mui-selected:hover': {
            background: 'rgba(37, 99, 235, 0.05)',
          },
        },
      },
    },

    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: '3px 3px 0 0',
          background: 'var(--color-accent)',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '14px',
          minHeight: 48,
          '&.Mui-selected': { color: 'var(--color-accent)', fontWeight: 600 },
        },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 8, height: 8, background: 'rgba(30, 41, 59, 0.06)' },
        bar: { borderRadius: 8, background: 'var(--color-accent)' },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 500, fontSize: '13px', boxShadow: 'none' },
      },
    },

    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '13px',
          borderRadius: '8px !important',
          border: '1px solid rgba(30, 41, 59, 0.1) !important',
          '&.Mui-selected': {
            background: 'rgba(37, 99, 235, 0.06)',
            color: 'var(--color-accent)',
          },
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 400,
          '& fieldset': { borderColor: 'rgba(30, 41, 59, 0.15)' },
          '&:hover fieldset': { borderColor: 'rgba(30, 41, 59, 0.3)' },
          '&.Mui-focused fieldset': { borderColor: 'var(--color-accent)' },
        },
      },
    },
  },
})

export default theme
