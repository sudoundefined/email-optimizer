import { useCallback, useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
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
import ConfirmDialog from './ConfirmDialog'
import { useJob } from '../hooks/useJob'

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

function SelectableMessageList({
  messages,
  loading,
  emptyText,
  selected,
  onSelectedChange,
}: {
  messages: GroupMessage[] | null
  loading: boolean
  emptyText: string
  selected: Set<string>
  onSelectedChange: (next: Set<string>) => void
}) {
  if (loading) return <Typography variant="body2" color="text.secondary">Loading messages…</Typography>
  if (messages && messages.length === 0) return <Typography variant="body2" color="text.secondary">{emptyText}</Typography>
  if (!messages) return null

  const allSelected = messages.length > 0 && messages.every((m) => selected.has(m.id))

  const toggleAll = () => {
    onSelectedChange(
      allSelected ? new Set([...selected].filter((id) => !messages.some((m) => m.id === id)))
                  : new Set([...selected, ...messages.map((m) => m.id)])
    )
  }

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedChange(next)
  }

  return (
    <List dense disablePadding sx={{ maxHeight: 400, overflowY: 'auto' }}>
      {/* select-all header row */}
      <ListItem
        dense
        divider
        sx={{ bgcolor: 'action.hover', py: 0.25 }}
        secondaryAction={
          <Typography variant="caption" color="text.secondary">
            {messages.filter((m) => selected.has(m.id)).length} / {messages.length} selected
          </Typography>
        }
      >
        <Checkbox
          size="small"
          checked={allSelected}
          indeterminate={messages.some((m) => selected.has(m.id)) && !allSelected}
          onChange={toggleAll}
          aria-label="Select all messages"
          sx={{ mr: 1 }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          Select all
        </Typography>
      </ListItem>

      {messages.map((m) => (
        <ListItem
          key={m.id}
          dense
          divider
          onClick={() => toggle(m.id)}
          sx={{ cursor: 'pointer', bgcolor: selected.has(m.id) ? 'action.selected' : undefined }}
        >
          <Checkbox
            size="small"
            checked={selected.has(m.id)}
            onChange={() => toggle(m.id)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select message: ${m.subject || '(no subject)'}`}
            sx={{ mr: 1, flexShrink: 0 }}
          />
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 160, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

  // selection state — unified across group messages and filter results
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmTrash, setConfirmTrash] = useState(false)
  const [trashDone, setTrashDone] = useState<string | null>(null)

  const trashJob = useJob()

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
    return () => { cancelled = true }
  }, [handleApiError])

  // clear selection when switching context
  const clearContext = () => {
    setSelected(new Set())
    setTrashDone(null)
  }

  const toggleGroup = async (key: string) => {
    if (openGroup === key) {
      setOpenGroup(null)
      setMessages(null)
      clearContext()
      return
    }
    setOpenGroup(key)
    setMessages(null)
    setMessagesLoading(true)
    setActiveFilter(null)
    setFilterResults(null)
    clearContext()
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
    clearContext()
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

  const runTrash = async () => {
    setConfirmTrash(false)
    setError(null)
    setTrashDone(null)
    const ids = [...selected]
    try {
      const response = await api.trashMessages(ids)
      if ('jobId' in response && response.jobId) {
        const snapshot = await trashJob.start(() => Promise.resolve({ jobId: response.jobId! }))
        if (snapshot.state === 'error') {
          setError(snapshot.error || 'Move to Trash failed')
          return
        }
      }
      const count = 'trashed' in response ? response.trashed : ids.length
      setTrashDone(`Moved ${count.toLocaleString()} messages to Trash. Recoverable in Gmail for 30 days.`)
      setSelected(new Set())
      // remove trashed messages from local state
      setMessages((prev) => prev ? prev.filter((m) => !ids.includes(m.id)) : prev)
      setFilterResults((prev) => prev ? prev.filter((m) => !ids.includes(m.id)) : prev)
    } catch (err) {
      handleApiError(err)
    }
  }

  const openTitle = groups?.find((g) => g.key === openGroup)?.title

  return (
    <div>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {trashDone && <Alert severity="success" sx={{ mb: 2 }}>{trashDone}</Alert>}

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
          <SelectableMessageList
            messages={filterResults}
            loading={filterLoading}
            emptyText="No messages match this filter."
            selected={selected}
            onSelectedChange={setSelected}
          />
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
          <SelectableMessageList
            messages={messages}
            loading={messagesLoading}
            emptyText="No messages in this group."
            selected={selected}
            onSelectedChange={setSelected}
          />
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

      {/* Floating trash tray */}
      {selected.size > 0 && (
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            left: '50%',
            bottom: 22,
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            bgcolor: 'grey.900',
            color: 'common.white',
            borderRadius: 3,
            px: 2.5,
            py: 1.5,
            zIndex: 50,
            maxWidth: 'min(92vw, 600px)',
          }}
          role="toolbar"
          aria-label="Actions for selected messages"
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flex: 1 }}>
            <Chip label={selected.size} color="primary" size="small" />
            <Typography variant="body2" sx={{ color: 'grey.400' }}>
              messages selected
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              color="error"
              disabled={trashJob.running}
              onClick={() => setConfirmTrash(true)}
            >
              Move to Trash
            </Button>
            <Button
              variant="text"
              size="small"
              sx={{ color: 'grey.500' }}
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </Stack>
        </Paper>
      )}

      {confirmTrash && (
        <ConfirmDialog
          title={`Move ${selected.size.toLocaleString()} messages to Trash?`}
          message="These messages will move to Gmail Trash (recoverable for 30 days, then permanently deleted by Gmail). This does not unsubscribe you from any senders."
          danger
          onCancel={() => setConfirmTrash(false)}
          onConfirm={runTrash}
        />
      )}
    </div>
  )
}
