import { useState } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import { MailOutlined as MailOutlineIcon } from '@mui/icons-material'
import CircularProgress from '@mui/material/CircularProgress'
import { useAuth } from './hooks/useAuth'
import ConnectScreen from './components/ConnectScreen'
import AccountBadge from './components/AccountBadge'
import SendersTab from './components/SendersTab'
import InboxTab from './components/InboxTab'
import StorageTab from './components/StorageTab'
import LabelManager from './components/LabelManager'

const TAB_VALUES = ['senders', 'inbox', 'storage', 'labels'] as const
type TabValue = (typeof TAB_VALUES)[number]

export default function App() {
  const auth = useAuth()
  const [tab, setTab] = useState<TabValue>('senders')

  if (auth.loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }
  if (!auth.status?.connected) {
    return <ConnectScreen />
  }

  return (
    <Box>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar sx={{ gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MailOutlineIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }} noWrap>
              Email Unsubscriber
            </Typography>
          </Box>
          <Tabs
            value={TAB_VALUES.indexOf(tab)}
            onChange={(_, i) => setTab(TAB_VALUES[i])}
            sx={{ flex: 1, minWidth: 0 }}
          >
            <Tab label="Senders" />
            <Tab label="Inbox" />
            <Tab label="Storage" />
            <Tab label="Labels" />
          </Tabs>
          <AccountBadge email={auth.status.email!} onLogout={auth.logout} />
        </Toolbar>
      </AppBar>
      <Box sx={{ maxWidth: 1140, mx: 'auto', px: 3, pb: 18, pt: 3 }}>
        {tab === 'senders' && <SendersTab onDisconnected={auth.markDisconnected} />}
        {tab === 'inbox' && <InboxTab onDisconnected={auth.markDisconnected} />}
        {tab === 'storage' && <StorageTab onDisconnected={auth.markDisconnected} />}
        {tab === 'labels' && <LabelManager onDisconnected={auth.markDisconnected} />}
      </Box>
    </Box>
  )
}
