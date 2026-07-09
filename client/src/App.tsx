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
  { value: 'senders', label: 'Senders', icon: <PeopleIcon fontSize="small" />, blurb: 'Find and manage marketing senders' },
  { value: 'inbox',   label: 'Inbox',   icon: <InboxIcon fontSize="small" />,   blurb: 'Browse and filter your inbox' },
  { value: 'storage', label: 'Storage', icon: <StorageIcon fontSize="small" />, blurb: 'Reclaim space from large emails' },
  { value: 'labels',  label: 'Labels',  icon: <LabelIcon fontSize="small" />,   blurb: 'Manage your app-created labels' },
] as const

type TabValue = (typeof TABS)[number]['value']

export default function App() {
  const auth = useAuth()
  const [tab, setTab] = useState<TabValue>('senders')
  const [digestOpen, setDigestOpen] = useState(false)

  if (auth.loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: '#F2F2F7' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Box
            sx={{
              width: 60, height: 60, borderRadius: '15px', mx: 'auto', mb: 2.5,
              background: '#007AFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(0,122,255,0.28)',
            }}
          >
            <MailIcon sx={{ color: '#fff', fontSize: 30 }} />
          </Box>
          <CircularProgress size={22} sx={{ color: '#007AFF' }} />
        </Box>
      </Box>
    )
  }

  if (!auth.status?.connected) return <ConnectScreen />

  const active = TABS.find(t => t.value === tab)

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F2F2F7' }}>
      {/* ── Frosted toolbar (Apple material) ── */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderBottom: '1px solid rgba(60,60,67,0.16)',
          color: '#1C1C1E',
        }}
      >
        <Toolbar sx={{ gap: 2, minHeight: 56 }}>
          {/* App mark */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mr: 1 }}>
            <Box
              sx={{
                width: 30, height: 30, borderRadius: '8px',
                background: '#007AFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,122,255,0.35)',
                flexShrink: 0,
              }}
            >
              <MailIcon sx={{ color: '#fff', fontSize: 18 }} />
            </Box>
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, letterSpacing: '-0.02em', color: '#1C1C1E', display: { xs: 'none', sm: 'block' } }}
              noWrap
            >
              Email Optimizer
            </Typography>
            <Chip
              label="Beta"
              size="small"
              sx={{
                height: 19, fontSize: '0.62rem', fontWeight: 600,
                background: 'rgba(60,60,67,0.10)', color: 'rgba(60,60,67,0.7)',
                display: { xs: 'none', md: 'flex' },
              }}
            />
          </Box>

          {/* Tabs — single accent, Apple style */}
          <Tabs
            value={TABS.findIndex(t => t.value === tab)}
            onChange={(_, i) => setTab(TABS[i].value)}
            sx={{
              flex: 1, minWidth: 0,
              '& .MuiTab-root': { color: 'rgba(60,60,67,0.6)', minHeight: 56 },
              '& .MuiTab-root.Mui-selected': { color: '#007AFF' },
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
              sx={{ color: 'rgba(60,60,67,0.6)', '&:hover': { color: '#007AFF', background: 'rgba(0,122,255,0.08)' } }}
              aria-label="Weekly digest settings"
            >
              <ScheduleIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <AccountBadge email={auth.status.email!} onLogout={auth.logout} />
        </Toolbar>
      </AppBar>

      {/* ── Section header ── */}
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          py: 1.75,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderBottom: '1px solid rgba(60,60,67,0.12)',
          background: 'rgba(255,255,255,0.5)',
        }}
      >
        <Box
          sx={{
            width: 32, height: 32, borderRadius: '9px',
            background: '#007AFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,122,255,0.28)', color: '#fff',
          }}
        >
          {active?.icon}
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            {active?.label}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
            {active?.blurb}
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
