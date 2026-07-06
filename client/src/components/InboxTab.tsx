import { useCallback, useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Chip from '@mui/material/Chip'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { api, ApiError } from '../api'
import type { Filter, GmailLabel, GroupMessage, InboxGroup } from '../types'
import FilterToolbar from './FilterToolbar'

/** CATEGORY_FORUMS → "Category: Forums", INBOX → "Inbox" */
function prettyLabelName(l: GmailLabel): string {
  if (l.type !== 'system') return l.name
  return l.name
    .toLowerCase()
    .replace(/^category_/, 'category: ')
    .replace(/_/g, ' ')
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

function parseFromHeader(from: string): string {
  const m = from.match(/^\s*"?([^"<]*)"?\s*<.*>$/)
  return (m && m[1].trim()) || from
}

function MessageList({ messages, loading, emptyText }: { messages: GroupMessage[] | null; loading: boolean; emptyText: string }) {
  if (loading) return <Typography variant="body2" color="text.secondary">Loading messages…</Typography>
  if (messages && messages.length === 0) return <Typography variant="body2" color="text.secondary">{emptyText}</Typography>
  if (!messages) return null
  return (
    <List dense disablePadding sx={{ maxHeight: 360, overflowY: 'auto' }}>
      {messages.map((m) => (
        <ListItem key={m.id} dense divider>
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 180, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {parseFromHeader(m.from)}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap sx={{ flex: 1 }}>
                  {m.subject || '(no subject)'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {new Date(m.date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Typography>
              </Box>
            }
          />
        </ListItem>
      ))}
    </List>
  )
}

export default function InboxTab({ onDisconnected }: { onDisconnected: () => void }) {
  const [groups, setGroups] = useState<InboxGroup[] | null>(null)
  const [labels, setLabels] = useState<GmailLabel[] | null>(null)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [messages, setMessages] = useState<GroupMessage[] | null>(null)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<Filter | null>(null)
  const [filterResults, setFilterResults] = useState<GroupMessage[] | null>(null)
  const [filterLoading, setFilterLoading] = useState(false)

  const handleApiError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    },
    [onDisconnected]
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [g, l] = await Promise.all([api.inboxGroups(), api.allLabels()])
        if (!cancelled) {
          setGroups(g)
          setLabels(l)
        }
      } catch (err) {
        if (!cancelled) handleApiError(err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [handleApiError])

  const toggleGroup = async (key: string) => {
    if (openGroup === key) {
      setOpenGroup(null)
      setMessages(null)
      return
    }
    setOpenGroup(key)
    setMessages(null)
    setMessagesLoading(true)
    try {
      const msgs = await api.groupMessages(key)
      setMessages(msgs)
    } catch (err) {
      handleApiError(err)
      setOpenGroup(null)
    } finally {
      setMessagesLoading(false)
    }
  }

  const handleFilterSelect = async (filter: Filter | null) => {
    setActiveFilter(filter)
    setFilterResults(null)
    if (!filter) return
    setOpenGroup(null)
    setMessages(null)
    setFilterLoading(true)
    try {
      const msgs = await api.filterMessages(filter.query)
      setFilterResults(msgs)
    } catch (err) {
      handleApiError(err)
      setActiveFilter(null)
    } finally {
      setFilterLoading(false)
    }
  }

  const openTitle = groups?.find((g) => g.key === openGroup)?.title

  return (
    <div>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {groups === null && !error && (
        <Typography variant="body2" color="text.secondary">Reading your inbox…</Typography>
      )}

      {groups && (
        <FilterToolbar activeKey={activeFilter?.key ?? null} onSelect={handleFilterSelect} />
      )}

      {activeFilter && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2">{activeFilter.label}</Typography>
            <Button size="small" variant="text" onClick={() => handleFilterSelect(null)}>
              Close
            </Button>
          </Box>
          <MessageList messages={filterResults} loading={filterLoading} emptyText="No messages match this filter." />
        </Paper>
      )}

      {groups && (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
          gap: 1.5,
          mb: 2.5,
        }}>
          {groups.map((g) => (
            <Card
              key={g.key}
              variant="outlined"
              sx={{
                borderColor: openGroup === g.key ? 'primary.main' : undefined,
                bgcolor: openGroup === g.key ? 'action.selected' : undefined,
              }}
            >
              <CardActionArea onClick={() => toggleGroup(g.key)} sx={{ p: 2 }} title={g.blurb}>
                <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                  {g.title}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {g.approx && <Typography component="span" variant="h6" color="text.secondary">≈</Typography>}
                  {g.count.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {g.unread !== null && g.unread > 0
                    ? `${g.unread.toLocaleString()} unread`
                    : g.blurb}
                </Typography>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}

      {openGroup && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2">Latest in {openTitle}</Typography>
            <Button size="small" variant="text" onClick={() => toggleGroup(openGroup)}>
              Close
            </Button>
          </Box>
          <MessageList messages={messages} loading={messagesLoading} emptyText="No messages in this group." />
        </Paper>
      )}

      {labels && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>All Gmail labels</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Every label in your account — Gmail's built-in system labels, your own, and the ones this
            app created (managed on the Labels tab).
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Label</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Emails</TableCell>
                  <TableCell align="right">Unread</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {labels.map((l) => (
                  <TableRow key={l.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {prettyLabelName(l)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {l.appCreated ? (
                        <Chip size="small" label="App" color="success" />
                      ) : l.type === 'system' ? (
                        <Chip size="small" label="System" variant="outlined" />
                      ) : (
                        <Chip size="small" label="User" color="info" />
                      )}
                    </TableCell>
                    <TableCell align="right">{l.messagesTotal.toLocaleString()}</TableCell>
                    <TableCell align="right">{l.messagesUnread.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </div>
  )
}
