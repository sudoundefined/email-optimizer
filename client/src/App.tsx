import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import ConnectScreen from './components/ConnectScreen'
import AccountBadge from './components/AccountBadge'
import SendersTab from './components/SendersTab'
import InboxTab from './components/InboxTab'
import LabelManager from './components/LabelManager'

export default function App() {
  const auth = useAuth()
  const [tab, setTab] = useState<'senders' | 'inbox' | 'labels'>('senders')

  if (auth.loading) {
    return (
      <>
        <div className="airmail-edge" aria-hidden="true" />
        <div className="center-screen">
          <div className="hint">Loading…</div>
        </div>
      </>
    )
  }
  if (!auth.status?.connected) {
    return <ConnectScreen />
  }

  return (
    <>
      <div className="airmail-edge" aria-hidden="true" />
      <div className="app">
        <header className="app-header">
          <div className="wordmark">
            <span className="postmark" aria-hidden="true">✉</span>
            <div className="wordmark-text">
              <span className="wordmark-title">Email Unsubscriber</span>
              <span className="wordmark-sub">Gmail cleanup</span>
            </div>
          </div>
          <nav className="tabs" aria-label="Sections">
            <button
              className={tab === 'senders' ? 'tab active' : 'tab'}
              onClick={() => setTab('senders')}
            >
              Senders
            </button>
            <button
              className={tab === 'inbox' ? 'tab active' : 'tab'}
              onClick={() => setTab('inbox')}
            >
              Inbox
            </button>
            <button
              className={tab === 'labels' ? 'tab active' : 'tab'}
              onClick={() => setTab('labels')}
            >
              Labels
            </button>
          </nav>
          <AccountBadge email={auth.status.email!} onLogout={auth.logout} />
        </header>
        <main>
          {tab === 'senders' && <SendersTab onDisconnected={auth.markDisconnected} />}
          {tab === 'inbox' && <InboxTab onDisconnected={auth.markDisconnected} />}
          {tab === 'labels' && <LabelManager onDisconnected={auth.markDisconnected} />}
        </main>
      </div>
    </>
  )
}
