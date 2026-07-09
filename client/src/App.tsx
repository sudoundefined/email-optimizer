import { useState } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import {
  MailOutlined as MailIcon,
  PeopleOutlined as PeopleIcon,
  InboxOutlined as InboxIcon,
  StorageOutlined as StorageIcon,
  LabelOutlined as LabelIcon,
  ScheduleOutlined as ScheduleIcon,
} from '@mui/icons-material'
import { useAuth } from './hooks/useAuth'
import ConnectScreen from './components/ConnectScreen'
import AccountBadge from './components/AccountBadge'
import SendersTab from './components/SendersTab'
import InboxTab from './components/InboxTab'
import StorageTab from './components/StorageTab'
import LabelManager from './components/LabelManager'
import DigestSettingsDialog from './components/DigestSettingsDialog'

const TABS = [
  { value: 'senders', label: 'Senders', icon: <PeopleIcon fontSize="small" />, color: '#6366f1' },
  { value: 'inbox',   label: 'Inbox',   icon: <InboxIcon fontSize="small" />,   color: '#0ea5e9' },
  { value: 'storage', label: 'Storage', icon: <StorageIcon fontSize="small" />, color: '#10b981' },
  { value: 'labels',  label: 'Labels',  icon: <LabelIcon fontSize="small" />,   color: '#f59e0b' },
] as const

type TabValue = (typeof TABS)[number]['value']

export default function App() {
  const auth = useAuth()
  const [tab, setTab] = useState<TabValue>('senders')
  const [digestOpen, setDigestOpen] = useState(false)

  if (auth.loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: '#f1f5f9' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Box
            sx={{
              width: 64, height: 64, borderRadius: '50%', mx: 'auto', mb: 2,
              background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <MailIcon sx={{ color: '#fff', fontSize: 32 }} />
          </Box>
          <CircularProgress size={24} sx={{ color: '#6366f1' }} />
        </Box>
      </Box>
    )
  }

  if (!auth.status?.connected) return <ConnectScreen />

  const activeColor = TABS.find(t => t.value === tab)?.color ?? '#6366f1'

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f1f5f9' }}>
      {/* ── AppBar ── */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #312e81 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Toolbar sx={{ gap: 2, minHeight: 64 }}>
          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mr: 1 }}>
            <Box
              sx={{
                width: 36, height: 36, borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(99,102,241,0.5)',
                flexShrink: 0,
              }}
            >
              <MailIcon sx={{ color: '#fff', fontSize: 20 }} />
            </Box>
            <Typography
              variant="h6"
              sx={{ fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', display: { xs: 'none', sm: 'block' } }}
              noWrap
            >
              Email Optimizer
            </Typography>
            <Chip
              label="Beta"
              size="small"
              sx={{
                height: 18, fontSize: '0.6rem', fontWeight: 700,
                background: 'rgba(99,102,241,0.3)', color: '#c7d2fe',
                border: '1px solid rgba(99,102,241,0.4)',
                display: { xs: 'none', md: 'flex' },
              }}
            />
          </Box>

          {/* Tabs */}
          <Tabs
            value={TABS.findIndex(t => t.value === tab)}
            onChange={(_, i) => setTab(TABS[i].value)}
            sx={{
              flex: 1, minWidth: 0,
              '& .MuiTab-root': { color: 'rgba(255,255,255,0.55)', minHeight: 64 },
              '& .MuiTab-root.Mui-selected': { color: '#fff' },
              '& .MuiTabs-indicator': {
                background: `linear-gradient(90deg, ${activeColor}, ${activeColor}aa)`,
                height: 3,
                borderRadius: '3px 3px 0 0',
                transition: 'background 300ms ease',
              },
            }}
          >
            {TABS.map(t => (
              <Tab
                key={t.value}
                icon={t.icon}
                iconPosition="start"
                label={t.label}
                sx={{ gap: 0.75 }}
              />
            ))}
          </Tabs>

          <Tooltip title="Weekly digest settings">
            <IconButton
              onClick={() => setDigestOpen(true)}
              sx={{ color: 'rgba(255,255,255,0.75)', '&:hover': { color: '#fff' } }}
              aria-label="Weekly digest settings"
            >
              <ScheduleIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <AccountBadge email={auth.status.email!} onLogout={auth.logout} />
        </Toolbar>
      </AppBar>

      {/* ── Section header strip ── */}
      <Box
        sx={{
          background: `linear-gradient(90deg, ${activeColor}18 0%, transparent 60%)`,
          borderBottom: `3px solid ${activeColor}30`,
          px: { xs: 2, sm: 3 },
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 32, height: 32, borderRadius: '8px',
            background: `linear-gradient(135deg, ${activeColor} 0%, ${activeColor}cc 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 12px ${activeColor}40`,
          }}
        >
          {TABS.find(t => t.value === tab)?.icon}
        </Box>
        <Box>
          <Typography variant="subtitle2" sx={{ color: activeColor, fontWeight: 700 }}>
            {TABS.find(t => t.value === tab)?.label}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
            {tab === 'senders' && 'Find and manage marketing senders'}
            {tab === 'inbox'   && 'Browse and filter your inbox'}
            {tab === 'storage' && 'Reclaim space from large emails'}
            {tab === 'labels'  && 'Manage your app-created labels'}
          </Typography>
        </Box>
      </Box>

      {/* ── Tab content ── */}
      <Box sx={{ maxWidth: tab === 'labels' || tab === 'storage' || tab === 'inbox' ? '100%' : 1180, mx: 'auto', px: tab === 'labels' || tab === 'storage' || tab === 'inbox' ? 2.5 : { xs: 2, sm: 3 }, pb: 20, pt: 3 }}>
        {tab === 'senders' && <SendersTab onDisconnected={auth.markDisconnected} />}
        {tab === 'inbox'   && <InboxTab onDisconnected={auth.markDisconnected} />}
        {tab === 'storage' && <StorageTab onDisconnected={auth.markDisconnected} />}
        {tab === 'labels'  && <LabelManager onDisconnected={auth.markDisconnected} />}
      </Box>

      <DigestSettingsDialog
        open={digestOpen}
        onClose={() => setDigestOpen(false)}
        onDisconnected={auth.markDisconnected}
        accountEmail={auth.status.email ?? ''}
      />
    </Box>
  )
}
