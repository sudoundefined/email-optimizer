import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert, AlertIcon, Box, Button, Card, CardBody, Tag,
  Grid, GridItem, Input, Progress,
  Select, HStack, Text, Flex, Icon, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalBody, ModalFooter, VStack, CircularProgress,
  Table, Thead, Tbody, Tr, Th, Td, TableContainer, Checkbox, Tooltip, IconButton
} from '@chakra-ui/react'
import { EmailIcon, StarIcon, CopyIcon, UpDownIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from '@chakra-ui/icons'
import { exportToExcel } from '../utils/exportExcel'
import { api, ApiError } from '../api'
import type { ScanResult, Sender, Suggestion, UnsubSummary, ProtectedSender, Subscription, Filter, GroupMessage } from '../types'
import { useJob } from '../hooks/useJob'
import ScanControls from './ScanControls'
import ScanLoader from './ScanLoader'
import SenderTable, { CATEGORY_COLORS } from './SenderTable'
import UnsubscribePanel from './UnsubscribePanel'
import LabelReview from './LabelReview'
import ConfirmDialog from './ConfirmDialog'
import ProtectedTab from './ProtectedTab'
import FilterToolbar from './FilterToolbar'
import TagSearchInput from './TagSearchInput'
import { compileGmailQuery, filterSenders, needsGmail } from '../utils/searchQuery'
import type { Chip } from '../utils/searchQuery'
import { useAutoClearAlert } from '../hooks/useAutoClearAlert'

type Segment = 'all' | 'unsub' | 'nomethod' | 'subscriptions' | 'protected'
type SortKey = 'volume' | 'name' | 'recent'

const SEGMENTS: { key: Segment; label: string; blurb: string }[] = [
  { key: 'all', label: 'All senders', blurb: 'Everything from your scan' },
  { key: 'unsub', label: 'With unsubscribe', blurb: 'One-click, email, or link' },
  { key: 'nomethod', label: 'No method', blurb: 'No unsubscribe detected' },
  { key: 'subscriptions', label: 'Subscriptions', blurb: 'Recurring paid services' },
  { key: 'protected', label: 'Protected list', blurb: 'Shielded from bulk actions' },
]

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
  if (loading) return (
    <Flex flex={1} align="center" justify="center" py={12} direction="column" gap={4}>
      <CircularProgress isIndeterminate color="brand.500" size="28px" />
      <Text fontSize="sm" color="neutral.500">Loading messages…</Text>
    </Flex>
  )
  if (messages && messages.length === 0) return (
    <Box p={8} textAlign="center">
      <Text fontSize="sm" color="neutral.500">{emptyText}</Text>
    </Box>
  )
  if (!messages) return null

  const allSelected = messages.length > 0 && messages.every((m) => selected.has(m.id))
  const someSelected = messages.some((m) => selected.has(m.id))

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

  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)

  const paginate = messages ? messages.length > rowsPerPage : false
  const pageCount = messages ? Math.ceil(messages.length / rowsPerPage) : 0
  const safePage = Math.min(page, Math.max(0, pageCount - 1))
  const start = safePage * rowsPerPage
  const pageRows = paginate && messages ? messages.slice(start, start + rowsPerPage) : (messages ?? [])

  return (
    <Flex direction="column" minH={0} h="100%">
    <TableContainer flex={1} overflowY="auto">
      <Table size="sm" variant="simple">
        <Thead position="sticky" top={0} bg="brand.50" zIndex={1} boxShadow="0 2px 4px rgba(0,0,0,0.02)">
          <Tr>
            <Th w="40px" px={4} borderBottom="1px solid" borderColor="gray.200" py={4}>
              <Checkbox
                isChecked={allSelected}
                isIndeterminate={someSelected && !allSelected}
                onChange={toggleAll}
                colorScheme="brand"
              />
            </Th>
            <Th borderBottom="1px solid" borderColor="gray.200" color="gray.700" fontSize="sm" fontWeight="600" textTransform="none" letterSpacing="normal" py={4}>
              <Flex align="center" gap={2}>From <UpDownIcon boxSize={3} color="gray.400" /></Flex>
            </Th>
            <Th borderBottom="1px solid" borderColor="gray.200" color="gray.700" fontSize="sm" fontWeight="600" textTransform="none" letterSpacing="normal" py={4}>
              <Flex align="center" gap={2}>Subject <UpDownIcon boxSize={3} color="gray.400" /></Flex>
            </Th>
            <Th isNumeric borderBottom="1px solid" borderColor="gray.200" color="gray.700" fontSize="sm" fontWeight="600" textTransform="none" letterSpacing="normal" py={4}>
              <Flex justify="flex-end" align="center" gap={2}>Date <UpDownIcon boxSize={3} color="gray.400" /></Flex>
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {pageRows.map((m) => (
            <Tr
              key={m.id}
              bg="transparent"
              _hover={{ bg: 'gray.50' }}
              onClick={() => toggle(m.id)}
              cursor="pointer"
              borderBottom="1px solid"
              borderColor="gray.100"
              boxShadow={selected.has(m.id) ? 'inset 3px 0 0 0 var(--chakra-colors-brand-500)' : 'none'}
            >
              <Td px={4} onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  isChecked={selected.has(m.id)}
                  onChange={() => toggle(m.id)}
                  onClick={(e) => e.stopPropagation()}
                  colorScheme="brand"
                />
              </Td>
              <Td maxW="160px">
                <Tooltip label={m.from} placement="top-start" hasArrow maxW="400px" whiteSpace="normal">
                  <Text fontSize="sm" fontWeight={600} color="brand.900" isTruncated>
                    {parseFromHeader(m.from)}
                  </Text>
                </Tooltip>
              </Td>
              <Td maxW="280px">
                <Text fontSize="sm" color="neutral.500" isTruncated>
                  {m.subject || '(no subject)'}
                </Text>
              </Td>
              <Td isNumeric whiteSpace="nowrap">
                <Text fontSize="xs" color="neutral.500">
                  {new Date(m.date).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </Text>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableContainer>
    {paginate && (
      <Flex align="center" justify="flex-end" px={4} py={2} borderTop="1px" borderColor="gray.200" bg="gray.50">
        <HStack spacing={4}>
          <HStack>
            <Text fontSize="sm" color="gray.600">Rows per page:</Text>
            <Select size="sm" w="80px" value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0) }}>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </Select>
          </HStack>
          <Text fontSize="sm" color="gray.600">
            {start + 1}-{Math.min(start + rowsPerPage, messages?.length || 0)} of {messages?.length || 0}
          </Text>
          <HStack spacing={1}>
            <IconButton aria-label="Previous" icon={<ChevronLeftIcon />} size="sm" variant="ghost" isDisabled={safePage === 0} onClick={() => setPage(p => p - 1)} />
            <IconButton aria-label="Next" icon={<ChevronRightIcon />} size="sm" variant="ghost" isDisabled={safePage >= pageCount - 1} onClick={() => setPage(p => p + 1)} />
          </HStack>
        </HStack>
      </Flex>
    )}
    </Flex>
  )
}

export default function MailboxTab({ onDisconnected }: { onDisconnected: () => void }) {
  // Senders State
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [selectedSenders, setSelectedSenders] = useState<Set<string>>(new Set())
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [unsubSummary, setUnsubSummary] = useState<UnsubSummary | null>(null)
  const [showLabelReview, setShowLabelReview] = useState(false)
  const [confirmSenderTrash, setConfirmSenderTrash] = useState(false)
  const [trashDone, setTrashDone] = useState<string | null>(null)
  const [keepDone, setKeepDone] = useState<string | null>(null)
  const [showKeepDialog, setShowKeepDialog] = useState(false)
  const [keepN, setKeepN] = useState(3)
  const [error, setError] = useState<string | null>(null)
  const [protectedList, setProtectedList] = useState<ProtectedSender[]>([])
  const [protectionWarning, setProtectionWarning] = useState<string | null>(null)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [showFilterLabelDialog, setShowFilterLabelDialog] = useState(false)
  const [customLabelName, setCustomLabelName] = useState('')
  const [customLabelArchive, setCustomLabelArchive] = useState(false)
  const [labelDone, setLabelDone] = useState<string | null>(null)

  useAutoClearAlert(error, setError)
  useAutoClearAlert(trashDone, setTrashDone)
  useAutoClearAlert(keepDone, setKeepDone)
  useAutoClearAlert(protectionWarning, setProtectionWarning)
  useAutoClearAlert(labelDone, setLabelDone)

  const [segment, setSegment] = useState<Segment>('all')
  const [category, setCategory] = useState<string | null>(null)
  const [chips, setChips] = useState<Chip[]>([])            // being edited in the input
  const [activeSearch, setActiveSearch] = useState<Chip[]>([]) // applied on last Search click
  const [tagSearchQuery, setTagSearchQuery] = useState<string | null>(null) // non-null → Gmail-routed results shown
  const [labelPrefix, setLabelPrefix] = useState('Unsub/')
  const [sort, setSort] = useState<SortKey>('volume')

  // Inbox / Messages State
  const [filters, setFilters] = useState<Filter[]>([])
  const [activeFilter, setActiveFilter] = useState<Filter | null>(null)
  const [activeDrillDownSender, setActiveDrillDownSender] = useState<Sender | null>(null)
  const [messages, setMessages] = useState<GroupMessage[] | null>(null)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set())
  const [confirmMessageTrash, setConfirmMessageTrash] = useState(false)
  const [confirmFilterTrash, setConfirmFilterTrash] = useState(false)

  // Jobs
  const scanJob = useJob()
  const unsubJob = useJob()
  const trashSenderJob = useJob()
  const keepJob = useJob()
  const trashMessageJob = useJob()
  const filterTrashJob = useJob()
  const filterLabelJob = useJob()

  const handleApiError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else if (err instanceof ApiError && err.code === 'no_scan') setError('No scan data found. Please run a new scan.')
      else setError(err instanceof Error ? err.message : String(err))
    },
    [onDisconnected]
  )

  const loadData = useCallback(async () => {
    try {
      const [scanRes, suggRes, protRes, subRes, filterRes, prefRes] = await Promise.all([
        api.senders().catch((e) => { if (e instanceof ApiError && (e.status === 404 || e.status === 409)) return null; throw e }),
        api.suggestions().catch((e) => { if (e instanceof ApiError && (e.status === 404 || e.status === 409)) return []; throw e }),
        api.protectedList(),
        api.subscriptions().catch((e) => { if (e instanceof ApiError && e.code === 'no_scan') return []; throw e }),
        api.inboxFilters(),
        api.userPreferences().catch(() => ({} as { labelPrefix?: string })),
      ])
      if (scanRes) setScan(scanRes)
      setSuggestions(suggRes)
      setProtectedList(protRes.protected)
      setSubscriptions(subRes)
      setFilters(filterRes)
      if (prefRes.labelPrefix) setLabelPrefix(prefRes.labelPrefix)
    } catch (err) {
      handleApiError(err)
    }
  }, [handleApiError])

  useEffect(() => {
    loadData()
  }, [loadData])

  // --- Senders Actions ---
  const runScan = async (range: string) => {
    setError(null)
    setUnsubSummary(null)
    setTrashDone(null)
    setKeepDone(null)
    setSelectedSenders(new Set())
    try {
      const snapshot = await scanJob.start(() => api.startScan(range))
      if (snapshot.state === 'error') setError(snapshot.error || 'Scan failed')
      else if (snapshot.state === 'cancelled') setError('Scan cancelled.')
      else await loadData()
    } catch (err) {
      handleApiError(err)
    }
  }

  const runUnsubscribe = async () => {
    setError(null)
    setUnsubSummary(null)
    setTrashDone(null)
    setKeepDone(null)
    setProtectionWarning(null)
    try {
      const emails = [...selectedSenders]
      const response = await api.startUnsubscribe(emails)

      if (response.excluded > 0) {
        setProtectionWarning(`${response.excluded} protected sender${response.excluded > 1 ? 's' : ''} excluded.`)
      }
      if (!response.jobId) {
        setError('All selected senders are protected')
        return
      }
      const snapshot = await unsubJob.start(() => Promise.resolve({ jobId: response.jobId! }))
      if (snapshot.state === 'error') setError(snapshot.error || 'Unsubscribe failed')
      else setUnsubSummary(snapshot.result as UnsubSummary)
    } catch (err) {
      handleApiError(err)
    }
  }

  const runTrashSenders = async () => {
    setConfirmSenderTrash(false)
    setError(null)
    setUnsubSummary(null)
    setTrashDone(null)
    setKeepDone(null)
    setProtectionWarning(null)
    try {
      const emails = [...selectedSenders]
      const response = await api.trashSenders(emails)

      if (response.excluded > 0) {
        setProtectionWarning(`${response.excluded} protected sender${response.excluded > 1 ? 's' : ''} excluded.`)
      }
      if (!response.jobId) {
        setError('All selected senders are protected')
        return
      }
      const snapshot = await trashSenderJob.start(() => Promise.resolve({ jobId: response.jobId! }))
      if (snapshot.state === 'error') {
        setError(snapshot.error || 'Moving to Trash failed')
      } else {
        const result = snapshot.result as { trashed: number; senders: number }
        setTrashDone(`Moved ${result.trashed.toLocaleString()} emails from ${result.senders} senders to Trash. Recoverable in Gmail for 30 days.`)
        setSelectedSenders(new Set())
        await loadData()
      }
    } catch (err) {
      handleApiError(err)
    }
  }

  const runKeepLatest = async () => {
    setShowKeepDialog(false)
    setError(null)
    setKeepDone(null)
    setTrashDone(null)
    setUnsubSummary(null)
    setProtectionWarning(null)
    const target = selectedSendersList.find((s) => !protectedSet.has(s.email.toLowerCase()))
    if (!target) return
    try {
      const response = await api.keepLatest(target.email, keepN)
      if (response.protected || !response.jobId) {
        setProtectionWarning('That sender is protected and was skipped.')
        return
      }
      const snapshot = await keepJob.start(() => Promise.resolve({ jobId: response.jobId! }))
      if (snapshot.state === 'error') {
        setError(snapshot.error || 'Keep-latest failed')
      } else {
        const r = snapshot.result as { trashed: number; kept: number; capped?: boolean }
        setKeepDone(`Kept the ${r.kept} newest email(s) from ${target.name || target.email} and moved ${r.trashed.toLocaleString()} older one(s) to Trash.`)
        setSelectedSenders(new Set())
        await loadData()
      }
    } catch (err) {
      handleApiError(err)
    }
  }

  const runProtect = async () => {
    setError(null)
    setProtectionWarning(null)
    try {
      const nonProtected = selectedSendersList.filter((s) => !protectedSet.has(s.email.toLowerCase()))
      if (nonProtected.length === 0) return
      await api.protectSenders(nonProtected.map((s) => s.email))
      await loadData()
      setSelectedSenders(new Set())
    } catch (err) {
      handleApiError(err)
    }
  }

  const runUnprotect = async () => {
    setError(null)
    setProtectionWarning(null)
    try {
      const protList = selectedSendersList.filter((s) => protectedSet.has(s.email.toLowerCase()))
      if (protList.length === 0) return
      await api.unprotectSenders(protList.map((s) => s.email))
      await loadData()
      setSelectedSenders(new Set())
    } catch (err) {
      handleApiError(err)
    }
  }

  // --- Messages Actions ---
  const handleFilterSelect = async (filter: Filter | null) => {
    setActiveFilter(filter)
    setActiveDrillDownSender(null)
    setTagSearchQuery(null)
    setMessages(null)
    setSelectedMessages(new Set())
    setTrashDone(null)
    if (!filter) return
    setMessagesLoading(true)
    try {
      const msgs = await api.filterMessages(filter.query)
      setMessages(msgs)
    } catch (err) {
      handleApiError(err)
      setActiveFilter(null)
    } finally {
      setMessagesLoading(false)
    }
  }

  const handleSenderDrillDown = async (sender: Sender) => {
    setActiveDrillDownSender(sender)
    setActiveFilter(null)
    setTagSearchQuery(null)
    setMessages(null)
    setSelectedMessages(new Set())
    setTrashDone(null)
    setMessagesLoading(true)
    try {
      const msgs = await api.filterMessages(`from:${sender.email}`)
      setMessages(msgs)
    } catch (err) {
      handleApiError(err)
      setActiveDrillDownSender(null)
    } finally {
      setMessagesLoading(false)
    }
  }

  const runTagSearch = async (searchChips: Chip[]) => {
    setActiveFilter(null)
    setActiveDrillDownSender(null)
    setSelectedMessages(new Set())
    setTrashDone(null)
    if (needsGmail(searchChips)) {
      setActiveSearch([])
      const q = compileGmailQuery(searchChips, labelPrefix)
      setTagSearchQuery(q)
      setMessages(null)
      setMessagesLoading(true)
      try {
        const msgs = await api.filterMessages(q)
        setMessages(msgs)
      } catch (err) {
        handleApiError(err)
        setTagSearchQuery(null)
      } finally {
        setMessagesLoading(false)
      }
    } else {
      setTagSearchQuery(null)
      setActiveSearch(searchChips)
    }
  }

  const clearTagSearch = () => {
    setChips([])
    setActiveSearch([])
    setTagSearchQuery(null)
  }

  const runTrashMessages = async () => {
    setConfirmMessageTrash(false)
    setError(null)
    setTrashDone(null)
    const ids = [...selectedMessages]
    try {
      const response = await api.trashMessages(ids)
      if ('jobId' in response && response.jobId) {
        const snapshot = await trashMessageJob.start(() => Promise.resolve({ jobId: response.jobId! }))
        if (snapshot.state === 'error') {
          setError(snapshot.error || 'Move to Trash failed')
          return
        }
      }
      const count = 'trashed' in response ? response.trashed : ids.length
      setTrashDone(`Moved ${count.toLocaleString()} messages to Trash. Recoverable in Gmail for 30 days.`)
      setSelectedMessages(new Set())
      setMessages((prev) => prev ? prev.filter((m) => !ids.includes(m.id)) : prev)
    } catch (err) {
      handleApiError(err)
    }
  }

  const runFilterTrash = async () => {
    if (!activeFilter) return
    setConfirmFilterTrash(false)
    setError(null)
    setTrashDone(null)
    try {
      const snapshot = await filterTrashJob.start(() => api.trashFilter(activeFilter.key))
      if (snapshot.state === 'error') {
        setError(snapshot.error || 'Trash failed')
        return
      }
      const r = snapshot.result as { trashed: number; excluded?: number; capped?: boolean }
      const excludedNote = r.excluded && r.excluded > 0 ? ` ${r.excluded.toLocaleString()} protected message(s) skipped.` : ''
      const cappedNote = r.capped ? ' Only the first 10,000 were scanned — run again to clear more.' : ''
      setTrashDone(`Moved ${r.trashed.toLocaleString()} message(s) matching "${activeFilter.label}" to Trash.${excludedNote}${cappedNote}`)
      setMessages([])
      setSelectedMessages(new Set())
      await loadData()
    } catch (err) {
      handleApiError(err)
    }
  }

  const runFilterLabel = async () => {
    const labelQuery = activeFilter?.query ?? tagSearchQuery
    if (!labelQuery || !customLabelName.trim()) return
    setShowFilterLabelDialog(false)
    setError(null)
    setLabelDone(null)
    setTrashDone(null)
    try {
      const snapshot = await filterLabelJob.start(() =>
        api.applyFilterLabel(labelQuery, customLabelName.trim(), customLabelArchive)
      )
      if (snapshot.state === 'error') {
        setError(snapshot.error || 'Labeling failed')
      } else {
        const r = snapshot.result as { labeled: number; total: number; capped?: boolean }
        const cappedNote = r.capped ? ' (capped at 5,000)' : ''
        setLabelDone(`Successfully applied label to ${r.labeled.toLocaleString()} messages${cappedNote}.`)
        setCustomLabelName('')
        await loadData()
      }
    } catch (err) {
      handleApiError(err)
    }
  }

  // --- Computed ---
  const suggestionMap = useMemo(() => {
    const m = new Map<string, Suggestion>()
    for (const s of suggestions || []) m.set(s.senderEmail, s)
    return m
  }, [suggestions])

  const protectedSet = useMemo(() => new Set(protectedList.map((p) => p.email.toLowerCase())), [protectedList])

  const selectedSendersList = useMemo(
    () => (scan ? scan.senders.filter((s) => selectedSenders.has(s.email)) : []),
    [scan, selectedSenders]
  )
  const selectedUnsubscribable = selectedSendersList.filter((s) => s.method !== 'none').length
  const selectedEmailCount = selectedSendersList.reduce((n, s) => n + s.messageCount, 0)
  const selectedProtectedCount = useMemo(() => selectedSendersList.filter((s) => protectedSet.has(s.email.toLowerCase())).length, [selectedSendersList, protectedSet])
  const selectedNonProtectedCount = selectedSendersList.length - selectedProtectedCount

  const trashProgress = trashSenderJob.job?.progress as { trashed?: number; total?: number } | null
  const keepProgress = keepJob.job?.progress as { phase?: string; trashed?: number; total?: number; listed?: number } | null

  const segmentCounts = useMemo(() => {
    const all = scan?.senders ?? []
    return {
      all: all.length,
      unsub: all.filter((s) => s.method !== 'none').length,
      nomethod: all.filter((s) => s.method === 'none').length,
      subscriptions: subscriptions.length,
      protected: protectedList.length,
    }
  }, [scan, protectedList, subscriptions])

  const subMap = useMemo(() => {
    const m = new Map<string, Subscription>()
    for (const s of subscriptions) m.set(s.email.toLowerCase(), s)
    return m
  }, [subscriptions])

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of scan?.senders ?? []) {
      const c = suggestionMap.get(s.email)?.category
      if (c) m.set(c, (m.get(c) || 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [scan, suggestionMap])

  const categoryList = useMemo(() => categoryCounts.map(([c]) => c), [categoryCounts])

  const visibleSenders = useMemo(() => {
    if (!scan) return []
    let list: Sender[] = scan.senders
    if (segment === 'unsub') list = list.filter((s) => s.method !== 'none')
    else if (segment === 'nomethod') list = list.filter((s) => s.method === 'none')
    else if (segment === 'subscriptions') list = list.filter((s) => subMap.has(s.email.toLowerCase()))
    if (category) list = list.filter((s) => suggestionMap.get(s.email)?.category === category)
    if (activeSearch.length > 0) list = filterSenders(list, suggestionMap, activeSearch)
    const sorted = [...list]
    if (sort === 'volume') sorted.sort((a, b) => b.messageCount - a.messageCount)
    else if (sort === 'name') sorted.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email))
    else if (sort === 'recent') sorted.sort((a, b) => b.latestDate - a.latestDate)
    return sorted
  }, [scan, segment, category, activeSearch, sort, suggestionMap, subMap])

  const showProtectedView = segment === 'protected' && !activeFilter && !activeDrillDownSender
  const rightTitle = SEGMENTS.find((s) => s.key === segment)?.label ?? 'Senders'
  const isMessageView = !!activeFilter || !!activeDrillDownSender || !!tagSearchQuery

  return (
    <Flex direction="column" h="100%" minH={0}>
      <ScanControls onScan={runScan} onCancel={scanJob.cancel} running={scanJob.running} scan={scan} />
      
      {error && <Alert status="error" mb={4} borderRadius="md"><AlertIcon />{error}</Alert>}
      {trashDone && <Alert status="success" mb={4} borderRadius="md"><AlertIcon />{trashDone}</Alert>}
      {keepDone && <Alert status="success" mb={4} borderRadius="md"><AlertIcon />{keepDone}</Alert>}
      {protectionWarning && <Alert status="warning" mb={4} borderRadius="md"><AlertIcon />{protectionWarning}</Alert>}
      {labelDone && <Alert status="success" mb={4} borderRadius="md"><AlertIcon />{labelDone}</Alert>}

      {filterLabelJob.running && (
        <Box mb={4}>
          <Text fontSize="xs" color="gray.500">
            {filterLabelJob.job?.progress?.phase === 'listing'
              ? `Scanning matching emails…`
              : `Applying custom label… ${(filterLabelJob.job?.progress as any)?.labeled ?? 0} / ${(filterLabelJob.job?.progress as any)?.total ?? '?'}`}
          </Text>
          <Progress size="sm" colorScheme="blue" value={(filterLabelJob.job?.progress as any)?.total ? (((filterLabelJob.job?.progress as any)?.labeled || 0) / (filterLabelJob.job?.progress as any)?.total) * 100 : undefined} mt={1} borderRadius="md" isIndeterminate={!(filterLabelJob.job?.progress as any)?.total} />
        </Box>
      )}

      {trashSenderJob.running && trashProgress && (
        <Box mb={4}>
          <Text fontSize="xs" color="gray.500">
            Moving to Trash… {trashProgress.trashed ?? 0} / {trashProgress.total ?? '?'} emails
          </Text>
          <Progress size="sm" colorScheme="blue" value={trashProgress.total ? (trashProgress.trashed! / trashProgress.total) * 100 : undefined} mt={1} borderRadius="md" isIndeterminate={!trashProgress.total} />
        </Box>
      )}

      {keepJob.running && (
        <Box mb={4}>
          <Text fontSize="xs" color="gray.500">
            {keepProgress?.phase === 'trashing'
              ? `Keeping latest, trashing older… ${keepProgress.trashed ?? 0} / ${keepProgress.total ?? '?'} emails`
              : `Scanning sender history… ${keepProgress?.listed ?? 0} found`}
          </Text>
          <Progress size="sm" colorScheme="blue" value={keepProgress?.total ? (keepProgress.trashed! / keepProgress.total) * 100 : undefined} mt={1} borderRadius="md" isIndeterminate={!keepProgress?.total} />
        </Box>
      )}

      {unsubJob.running && unsubJob.job?.progress != null && (
        <UnsubscribePanel progress={unsubJob.job.progress as never} running />
      )}
      {unsubSummary && <UnsubscribePanel summary={unsubSummary} />}

      {!scan && !scanJob.running && (
        <Flex direction="column" align="center" textAlign="center" py={20} color="gray.500">
          <Icon as={EmailIcon} boxSize={14} opacity={0.5} mb={4} />
          <Text fontSize="xl" fontWeight={600} color="brand.900" mb={2}>
            See who's filling your inbox
          </Text>
          <Text fontSize="sm" maxW="420px">
            Scan your mailbox to group marketing email by sender, then unsubscribe, label, protect,
            or trash them in bulk.
          </Text>
        </Flex>
      )}

      {scanJob.running && (
        <ScanLoader progress={scanJob.job?.progress as any} />
      )}

      {scan && !scanJob.running && (
        <>
          {!showProtectedView && categoryCounts.length > 0 && (
            <Flex 
              overflowX="auto" 
              py={4} 
              mb={2}
              gap={3} 
              sx={{ '&::-webkit-scrollbar': { display: 'none' } }}
            >
              <Button
                size="sm"
                variant={category === null && !isMessageView ? 'solid' : 'outline'}
                colorScheme={category === null && !isMessageView ? 'brand' : 'gray'}
                onClick={() => {
                  setCategory(null)
                  setActiveFilter(null)
                  setActiveDrillDownSender(null)
                  setTagSearchQuery(null)
                }}
                borderRadius="full"
                flexShrink={0}
              >
                All categories
              </Button>
              {categoryCounts.map(([cat, count]) => {
                const active = category === cat && !isMessageView
                const color = CATEGORY_COLORS[cat] ?? '#AEAEB2'
                return (
                  <Button
                    key={cat}
                    size="sm"
                    variant={active ? 'solid' : 'outline'}
                    onClick={() => {
                      setCategory(active ? null : cat)
                      setActiveFilter(null)
                      setActiveDrillDownSender(null)
                      setTagSearchQuery(null)
                    }}
                    bg={active ? color : 'bg.card'}
                    borderColor={active ? color : 'border.subtle'}
                    color={active ? 'white' : color}
                    _hover={{ bg: active ? color : `${color}15` }}
                    borderRadius="full"
                    flexShrink={0}
                  >
                    {cat} <Text as="span" ml={2} opacity={0.8} fontSize="xs">{count}</Text>
                  </Button>
                )
              })}
            </Flex>
          )}

          <Grid templateColumns={{ base: '1fr', md: 'repeat(12, 1fr)' }} gap={6} flex={1} minH={0}>
          {/* ── LEFT PANE — navigation & filters ── */}
          <GridItem colSpan={{ base: 12, md: 4, lg: 3 }} minH={0} overflowY={{ md: 'auto' }} pr={{ md: 2 }}>
            <VStack spacing={4} align="stretch">
              <Card borderRadius="xl" overflow="hidden" _hover={{ boxShadow: 'md' }} transition="box-shadow 0.2s" bg="bg.glass" backdropFilter="blur(10px)">
                <Box px={4} py={3} borderBottom="1px" borderColor="border.glass">
                  <Text fontSize="xs" fontWeight="bold" color="text.secondary" letterSpacing="wider" textTransform="uppercase" display="flex" alignItems="center">
                    <Icon as={StarIcon} mr={2} color="brand.500" /> Smart Filters
                  </Text>
                </Box>
                <CardBody p={4}>
                  <FilterToolbar filters={filters} activeKey={activeFilter?.key ?? null} onSelect={handleFilterSelect} />
                </CardBody>
              </Card>

              <Card borderRadius="xl">
                <CardBody p={3}>
                  <TagSearchInput
                    chips={chips}
                    onChipsChange={setChips}
                    onSearch={runTagSearch}
                    onClear={clearTagSearch}
                    categories={categoryList}
                    isSearching={messagesLoading && !!tagSearchQuery}
                  />
                </CardBody>
              </Card>

              <Card borderRadius="xl" overflow="hidden" _hover={{ boxShadow: 'md' }} transition="box-shadow 0.2s" bg="bg.glass" backdropFilter="blur(10px)">
                <Box px={4} py={3} borderBottom="1px" borderColor="border.glass">
                  <Text fontSize="xs" fontWeight="bold" color="text.secondary" letterSpacing="wider" textTransform="uppercase" display="flex" alignItems="center">
                    <Icon as={CopyIcon} mr={2} color="brand.500" /> Segments
                  </Text>
                </Box>
                <CardBody p={2}>
                  {SEGMENTS.map((seg) => {
                    const active = segment === seg.key && !isMessageView
                    const count = segmentCounts[seg.key]
                    return (
                      <Flex
                        key={seg.key}
                        onClick={() => {
                          setSegment(seg.key)
                          setActiveFilter(null)
                          setActiveDrillDownSender(null)
                          setTagSearchQuery(null)
                          if (seg.key === 'protected') setCategory(null)
                        }}
                        align="center"
                        justify="space-between"
                        px={3} py={2} mb={1}
                        borderRadius="md"
                        cursor="pointer"
                        bg={active ? 'bg.accent' : 'transparent'}
                        borderLeft="2px solid"
                        borderColor={active ? 'brand.icon' : 'transparent'}
                        _hover={{ bg: active ? 'bg.accent' : 'bg.hover' }}
                      >
                        <Box overflow="hidden">
                          <Text fontSize="sm" fontWeight={600} color={active ? 'text.secondary' : 'text.primary'} isTruncated>
                            {seg.label}
                          </Text>
                          <Text fontSize="xs" color={active ? 'text.secondary' : 'neutral.500'} isTruncated>
                            {seg.blurb}
                          </Text>
                        </Box>
                        <Text fontSize="sm" fontWeight={700} ml={2} flexShrink={0} color={active ? 'text.secondary' : 'text.primary'}>
                          {count.toLocaleString()}
                        </Text>
                      </Flex>
                    )
                  })}
                </CardBody>
              </Card>

            </VStack>
          </GridItem>

          {/* ── RIGHT PANE — content ── */}
          <GridItem colSpan={{ base: 12, md: 8, lg: 9 }} minH={0}>
            <Box position="relative" h="100%">
            {isMessageView ? (
              <Card 
                variant="outline" 
                borderRadius="xl" 
                h="100%" 
                display="flex" 
                flexDir="column" 
                bg="bg.card" 
                backdropFilter="blur(12px)"
                pb={selectedMessages.size > 0 ? "80px" : "0px"}
                transition="padding-bottom 0.2s"
              >
                <Flex align="center" justify="space-between" px={6} py={4} borderBottom="1px" borderColor="border.glass" bg="transparent">
                  <Box>
                    <Text fontSize="lg" fontWeight={700} color="text.primary">
                      {activeFilter
                        ? activeFilter.label
                        : activeDrillDownSender
                          ? activeDrillDownSender.name || activeDrillDownSender.email
                          : 'Search results'}
                    </Text>
                    <Text fontSize="sm" color="neutral.500" mt={1}>
                      {activeFilter
                        ? 'Viewing filtered messages'
                        : activeDrillDownSender
                          ? `Browsing emails from ${activeDrillDownSender.email}`
                          : `Messages matching your tag search`}
                    </Text>
                  </Box>
                  <HStack spacing={2}>
                    {selectedMessages.size > 0 && (
                      <Tag size="sm" colorScheme="brand" borderRadius="full">
                        {selectedMessages.size} selected
                      </Tag>
                    )}
                    {(activeFilter || tagSearchQuery) && (
                      <Button
                        size="sm"
                        variant="outline"
                        colorScheme="brand"
                        isLoading={filterLabelJob.running}
                        onClick={() => {
                          setCustomLabelArchive(false)
                          setCustomLabelName('')
                          setShowFilterLabelDialog(true)
                        }}
                      >
                        Label all matching
                      </Button>
                    )}
                    {activeFilter && (
                      <Button
                        size="sm"
                        variant="outline"
                        colorScheme="red"
                        isLoading={filterTrashJob.running}
                        onClick={() => setConfirmFilterTrash(true)}
                      >
                        Trash all matching
                      </Button>
                    )}
                    <Button size="sm" variant="solid" colorScheme="brand" onClick={() => { setActiveFilter(null); setActiveDrillDownSender(null); setTagSearchQuery(null); setMessages(null); setSelectedMessages(new Set()) }}>
                      Close
                    </Button>
                  </HStack>
                </Flex>
                <SelectableMessageList
                  messages={messages}
                  loading={messagesLoading}
                  emptyText={
                    activeFilter
                      ? "No messages match this filter."
                      : activeDrillDownSender
                        ? "No messages found from this sender."
                        : "No messages match your tag search."
                  }
                  selected={selectedMessages}
                  onSelectedChange={setSelectedMessages}
                />
              </Card>
            ) : showProtectedView ? (
              <Card variant="outline" borderRadius="xl" h="100%" display="flex" flexDir="column" bg="bg.card" backdropFilter="blur(12px)">
                <Box px={6} py={4} borderBottom="1px" borderColor="border.glass" bg="transparent">
                  <Text fontSize="lg" fontWeight={700} color="text.primary">Protected list</Text>
                  <Text fontSize="sm" color="neutral.500" mt={1}>
                    Senders shielded from bulk unsubscribe and trash. Banks, utilities, and government are auto-protected.
                  </Text>
                </Box>
                <Box flex={1} overflowY="auto" p={6}>
                  <ProtectedTab onDisconnected={onDisconnected} />
                </Box>
              </Card>
            ) : (
              <Card 
                variant="outline" 
                borderRadius="xl" 
                h="100%" 
                display="flex" 
                flexDir="column" 
                bg="bg.card" 
                backdropFilter="blur(12px)"
                pb={selectedSenders.size > 0 ? "80px" : "0px"}
                transition="padding-bottom 0.2s"
              >
                <Flex align="center" justify="space-between" px={6} py={4} borderBottom="1px" borderColor="border.glass" bg="transparent" gap={4}>
                  <HStack spacing={3} minW={0} overflow="hidden">
                    <Text fontSize="lg" fontWeight={700} color="text.primary" isTruncated>{rightTitle}</Text>
                    <Tag size="sm" variant="outline" borderRadius="full">{visibleSenders.length.toLocaleString()}</Tag>
                    {category && (
                      <Tag size="sm" borderRadius="full" bg={`${CATEGORY_COLORS[category] ?? '#AEAEB2'}20`} color={CATEGORY_COLORS[category] ?? '#8E8E93'}>
                        {category}
                      </Tag>
                    )}
                    {selectedSenders.size > 0 && (
                      <Tag size="sm" colorScheme="brand" borderRadius="full">{selectedSenders.size} selected</Tag>
                    )}
                  </HStack>
                  <HStack spacing={2} flexShrink={0}>
                    <Select
                      size="sm"
                      w="160px"
                      value={sort}
                      onChange={(e) => setSort(e.target.value as SortKey)}
                      bg="white"
                    >
                      <option value="volume">Sort: Most emails</option>
                      <option value="name">Sort: Name (A–Z)</option>
                      <option value="recent">Sort: Most recent</option>
                    </Select>
                    <Tooltip label="Export to Excel" hasArrow>
                      <IconButton
                        aria-label="Export to Excel"
                        icon={<DownloadIcon />}
                        size="sm"
                        variant="outline"
                        colorScheme="brand"
                        isDisabled={visibleSenders.length === 0}
                        onClick={() => {
                          const toExport = selectedSenders.size > 0
                            ? visibleSenders.filter((s) => selectedSenders.has(s.email))
                            : visibleSenders
                          exportToExcel(toExport)
                        }}
                      />
                    </Tooltip>
                  </HStack>
                </Flex>
                
                {segment === 'subscriptions' && (
                  <Flex px={6} py={3} borderBottom="1px" borderColor="whiteAlpha.400" wrap="wrap" gap={2} align="center">
                    <Text fontSize="xs" color="neutral.500" mr={1}>
                      Recurring services detected from your scan — select to unsubscribe, keep-latest, or trash:
                    </Text>
                    {[...new Map(subscriptions.map((s) => [s.vendor, s])).values()].slice(0, 16).map((s) => (
                      <Tag key={s.vendor} size="sm" colorScheme="purple" variant="subtle" fontWeight={500}>
                        {s.cadence === 'unknown' ? s.vendor : `${s.vendor} · ${s.cadence}`}
                      </Tag>
                    ))}
                    {subscriptions.length === 0 && (
                      <Text fontSize="xs" color="neutral.500">No recurring services matched — scan a wider date range to catch more.</Text>
                    )}
                  </Flex>
                )}

                <SenderTable
                  senders={visibleSenders}
                  selected={selectedSenders}
                  onSelectedChange={setSelectedSenders}
                  suggestions={suggestionMap}
                  protectedSet={protectedSet}
                  onDrillDown={handleSenderDrillDown}
                />
              </Card>
            )}
            
            {/* Floating action tray for Senders */}
            {!isMessageView && !showProtectedView && selectedSenders.size > 0 && (() => {
              const busy = unsubJob.running || trashSenderJob.running || keepJob.running
              return (
                <Flex
                  position="absolute" left={6} right={6} bottom={6} mx="auto"
                  align="center" justify="space-between" gap={4}
                  bg="bg.tray" color="text.inverse"
                  borderRadius="full" pl={3} pr={2} py={2} zIndex={50}
                  boxShadow="0 18px 50px rgba(0,0,0, 0.4)" border="1px solid" borderColor="whiteAlpha.200"
                >
                  <HStack spacing={3} minW={0} pl={1}>
                    <Flex w="32px" h="32px" borderRadius="full" bg="brand.500" align="center" justify="center" fontWeight={800} fontSize="sm" flexShrink={0}>
                      {selectedSenders.size}
                    </Flex>
                    <Text fontSize="sm" color="whiteAlpha.700" isTruncated>
                      senders · <Text as="strong" color="white">{selectedEmailCount.toLocaleString()}</Text> emails
                      {selectedUnsubscribable < selectedSenders.size && ` · ${selectedUnsubscribable} unsub-able`}
                    </Text>
                  </HStack>

                  <HStack spacing={2} overflowX="auto" py={1} flexShrink={0}>
                    <Button
                      size="sm" borderRadius="full" px={4} bg="brand.500" color="white"
                      _hover={{ bg: 'brand.600' }} isDisabled={selectedUnsubscribable === 0 || busy}
                      onClick={runUnsubscribe}
                    >
                      Unsubscribe
                    </Button>
                    <Button size="sm" borderRadius="full" px={4} variant="ghost" color="white" bg="whiteAlpha.200" _hover={{ bg: 'whiteAlpha.300' }} isDisabled={busy} onClick={() => setShowLabelReview(true)}>
                      Label…
                    </Button>
                    <Button size="sm" borderRadius="full" px={4} variant="ghost" color="white" bg="whiteAlpha.200" _hover={{ bg: 'whiteAlpha.300' }} isDisabled={selectedNonProtectedCount === 0 || busy} onClick={runProtect}>
                      Protect
                    </Button>
                    <Button size="sm" borderRadius="full" px={4} variant="ghost" color="white" bg="whiteAlpha.200" _hover={{ bg: 'whiteAlpha.300' }} isDisabled={selectedProtectedCount === 0 || busy} onClick={runUnprotect}>
                      Unprotect
                    </Button>
                    <Button size="sm" borderRadius="full" px={4} variant="ghost" color="white" bg="whiteAlpha.200" _hover={{ bg: 'whiteAlpha.300' }} isDisabled={selectedNonProtectedCount !== 1 || busy} onClick={() => setShowKeepDialog(true)}>
                      Keep latest…
                    </Button>
                    <Button
                      size="sm" borderRadius="full" px={4} bg="red.500" color="white"
                      _hover={{ bg: 'red.600' }} isDisabled={busy}
                      onClick={() => setConfirmSenderTrash(true)}
                    >
                      Move to Trash
                    </Button>
                    <Button size="sm" borderRadius="full" px={4} variant="ghost" color="whiteAlpha.700" _hover={{ color: 'white', bg: 'whiteAlpha.200' }} onClick={() => setSelectedSenders(new Set())}>
                      Clear
                    </Button>
                  </HStack>
                </Flex>
              )
            })()}

            {/* Floating action tray for Messages */}
            {isMessageView && selectedMessages.size > 0 && (
              <Flex
                position="absolute" left={6} right={6} bottom={6} mx="auto"
                align="center" justify="space-between" gap={4}
                bg="bg.tray" color="text.inverse"
                borderRadius="full" pl={4} pr={3} py={3} zIndex={50}
                boxShadow="0 18px 50px rgba(0,0,0, 0.4)" border="1px solid" borderColor="whiteAlpha.200"
              >
                <HStack spacing={3} flex={1}>
                  <Flex px={2} py={1} borderRadius="md" bg="brand.500" fontWeight={800} fontSize="sm" color="white" boxShadow="0 2px 8px rgba(67, 110, 111, 0.4)">
                    {selectedMessages.size}
                  </Flex>
                  <Text fontSize="sm" color="whiteAlpha.800">messages selected</Text>
                </HStack>
                <HStack spacing={2}>
                  <Button
                    size="sm" borderRadius="full" px={4} colorScheme="red"
                    isDisabled={trashMessageJob.running}
                    onClick={() => setConfirmMessageTrash(true)}
                  >
                    Move to Trash
                  </Button>
                  <Button size="sm" borderRadius="full" px={4} variant="ghost" color="whiteAlpha.800" _hover={{ color: 'white', bg: 'whiteAlpha.300' }} onClick={() => setSelectedMessages(new Set())}>
                    Clear
                  </Button>
                </HStack>
              </Flex>
            )}
            </Box>
          </GridItem>
        </Grid>
      </>)}

      {showLabelReview && scan && (
        <LabelReview
          senders={selectedSendersList}
          suggestions={suggestionMap}
          onClose={() => setShowLabelReview(false)}
          onDisconnected={onDisconnected}
        />
      )}

      {showKeepDialog && (() => {
        const target = selectedSendersList.find((s) => !protectedSet.has(s.email.toLowerCase()))
        return (
          <Modal isOpen onClose={() => setShowKeepDialog(false)} size="sm" isCentered>
            <ModalOverlay />
            <ModalContent>
              <ModalHeader>Keep latest emails</ModalHeader>
              <ModalBody>
                <Text fontSize="sm" mb={4}>
                  Keep the newest emails from{' '}
                  <Text as="strong">{target?.name || target?.email}</Text> and move all older ones to
                  Trash (recoverable for 30 days). This does not unsubscribe you.
                </Text>
                <Input
                  type="number"
                  size="sm"
                  value={keepN}
                  onChange={(e) => setKeepN(Math.max(1, Math.min(1000, Math.floor(Number(e.target.value) || 1))))}
                  min={1} max={1000}
                  autoFocus
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" mr={3} onClick={() => setShowKeepDialog(false)}>Cancel</Button>
                <Button colorScheme="red" onClick={runKeepLatest}>
                  Keep {keepN}, trash the rest
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        )
      })()}

      {confirmSenderTrash && (
        <ConfirmDialog
          title={`Move ${selectedEmailCount.toLocaleString()} emails to Trash?`}
          message={`Every scanned email from the ${selectedSenders.size} selected senders goes to Gmail Trash. Trash is recoverable for 30 days, then Gmail deletes it permanently. This does not unsubscribe you — new emails will still arrive.`}
          danger
          requireTypedCount={selectedEmailCount > 500 ? selectedEmailCount : undefined}
          onCancel={() => setConfirmSenderTrash(false)}
          onConfirm={runTrashSenders}
        />
      )}

      {confirmMessageTrash && (
        <ConfirmDialog
          title={`Move ${selectedMessages.size.toLocaleString()} messages to Trash?`}
          message="These messages will move to Gmail Trash (recoverable for 30 days, then permanently deleted by Gmail). This does not unsubscribe you from any senders."
          danger
          onCancel={() => setConfirmMessageTrash(false)}
          onConfirm={runTrashMessages}
        />
      )}

      {confirmFilterTrash && activeFilter && (
        <ConfirmDialog
          title={`Trash all messages matching "${activeFilter.label}"?`}
          message="This moves EVERY message matching this filter to Gmail Trash — not just the ones shown here. Recoverable for 30 days, then permanently deleted by Gmail. This does not unsubscribe you from any senders."
          danger
          onCancel={() => setConfirmFilterTrash(false)}
          onConfirm={runFilterTrash}
        />
      )}

      {showFilterLabelDialog && (activeFilter || tagSearchQuery) && (
        <Modal isOpen onClose={() => setShowFilterLabelDialog(false)} size="md" isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Label matching messages</ModalHeader>
            <ModalBody>
              <Text fontSize="sm" mb={4}>
                Apply a custom label to all emails matching {activeFilter ? (
                  <>the filter <Text as="strong">"{activeFilter.label}"</Text></>
                ) : (
                  <Text as="strong">your tag search</Text>
                )} (up to 5,000 messages).
              </Text>
              <VStack spacing={4} align="stretch">
                <Box>
                  <Text fontSize="xs" fontWeight="bold" color="gray.500" mb={1} textTransform="uppercase">
                    Label Name
                  </Text>
                  <Input
                    placeholder="e.g. Clean Promotions"
                    value={customLabelName}
                    onChange={(e) => setCustomLabelName(e.target.value)}
                    size="sm"
                    borderRadius="md"
                    autoFocus
                  />
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Note: The label will be prefixed with the app's folder (e.g. Unsub/Promo Clean).
                  </Text>
                </Box>
                <Checkbox
                  isChecked={customLabelArchive}
                  onChange={(e) => setCustomLabelArchive(e.target.checked)}
                  size="sm"
                  colorScheme="blue"
                >
                  Also archive tagged emails (move out of Inbox)
                </Checkbox>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" size="sm" mr={3} onClick={() => setShowFilterLabelDialog(false)}>
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                size="sm"
                isDisabled={!customLabelName.trim()}
                onClick={runFilterLabel}
              >
                Apply Label
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </Flex>
  )
}
