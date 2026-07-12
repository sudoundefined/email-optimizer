import { useCallback, useEffect, useState, useMemo } from 'react'
import {
  Alert, AlertIcon, Box, Button, Card, CardBody, Checkbox, Tag,
  Grid, GridItem, Flex, Text, Table, Thead, Tbody,
  Tr, Th, Td, TableContainer, Tooltip, Icon, VStack, HStack, Select, IconButton,
  SimpleGrid, useColorModeValue
} from '@chakra-ui/react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid
} from 'recharts'
import EmailLoader from './EmailLoader'
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, CopyIcon, UpDownIcon } from '@chakra-ui/icons'
import { HardDrive, ChevronDown, ChevronUp } from 'lucide-react'
import StatCard from '../ui/StatCard'
import { api, ApiError } from '../api'
import { clientCache } from '../cache'
import type { StorageAttachment, StorageDrillMessage, StorageStats, StorageYear, StorageSizeBand } from '../types'
import ConfirmDialog from './ConfirmDialog'
import { useJob } from '../hooks/useJob'
import { useAutoClearAlert } from '../hooks/useAutoClearAlert'

function parseFromHeader(from: string): string {
  const m = from.match(/^\s*"?([^"<]*)"?\s*<.*>$/)
  return (m && m[1].trim()) || from
}

// ── Drill-down panel ─────────────────────────────────────────────────────────

interface DrillPanelProps {
  title: string
  messages: StorageDrillMessage[] | null
  loading: boolean
  selected: Set<string>
  onSelectedChange: (next: Set<string>) => void
  onClose: () => void
}

function DrillPanel({ title, messages, loading, selected, onSelectedChange, onClose }: DrillPanelProps) {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(100)
  useEffect(() => { setPage(0) }, [messages])

  if (!messages && !loading) return null

  const paginate = (messages?.length ?? 0) > rowsPerPage
  const pageCount = Math.max(1, Math.ceil((messages?.length ?? 0) / rowsPerPage))
  const safePage = Math.min(page, pageCount - 1)
  const start = safePage * rowsPerPage
  const pageRows = paginate ? (messages ?? []).slice(start, start + rowsPerPage) : (messages ?? [])
  const ids = pageRows.map((m) => m.id)
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id))
  const someSelected = ids.some((id) => selected.has(id))

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selected)
      ids.forEach((id) => next.delete(id))
      onSelectedChange(next)
    } else {
      onSelectedChange(new Set([...selected, ...ids]))
    }
  }

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedChange(next)
  }

  const panelSelected = (messages ?? []).filter((m) => selected.has(m.id)).length

  return (
    <Flex
      direction="column"
      h="100%"
      border="1px solid" borderColor="border.subtle"
      borderRadius="xl"
      overflow="hidden"
      bg="bg.card"
      
      pb={selected.size > 0 ? "80px" : "0px"}
      transition="padding-bottom 0.2s"
    >
      <Flex align="center" justify="space-between" px={6} py={4} borderBottom="1px" borderColor="border.subtle" bg="bg.glass">
        <HStack spacing={2} minW={0}>
          <Text fontSize="lg" fontWeight={700} isTruncated>{title}</Text>
          {messages && (
            <Tag size="sm" variant="outline" borderRadius="full" flexShrink={0}>
              {messages.length} emails
            </Tag>
          )}
          {panelSelected > 0 && (
            <Tag size="sm" colorScheme="brand" borderRadius="full" flexShrink={0}>
              {panelSelected} selected
            </Tag>
          )}
        </HStack>
        <Button size="sm" variant="ghost" onClick={onClose} flexShrink={0}>Close</Button>
      </Flex>

      {loading && (
        <Flex align="center" justify="center" py={12}>
          <EmailLoader size="sm" message="Loading messages…" />
        </Flex>
      )}

      {messages && messages.length === 0 && (
        <Text fontSize="sm" color="text.secondary" px={6} py={6}>
          No messages found for this selection.
        </Text>
      )}

      {messages && messages.length > 0 && (
        <TableContainer flex={1} overflowY="auto">
          <Table size="sm" variant="simple" style={{ tableLayout: 'fixed' }}>
            <Thead position="sticky" top={0} bg="bg.muted" zIndex={1} boxShadow="0 2px 4px rgba(0,0,0,0.02)">
              <Tr>
                <Th w="40px" px={4} borderBottom="1px solid" borderColor="border.subtle" py={4}>
                  <Checkbox
                    isChecked={allSelected}
                    isIndeterminate={someSelected && !allSelected}
                    onChange={toggleAll}
                    colorScheme="brand"
                  />
                </Th>
                <Th borderBottom="1px solid" borderColor="border.subtle" color="text.secondary" fontSize="sm" fontWeight="600" textTransform="none" letterSpacing="normal" py={4}>
                  <Flex align="center" gap={2}>From <UpDownIcon boxSize={3} color="text.tertiary" /></Flex>
                </Th>
                <Th borderBottom="1px solid" borderColor="border.subtle" color="text.secondary" fontSize="sm" fontWeight="600" textTransform="none" letterSpacing="normal" py={4}>
                  <Flex align="center" gap={2}>Subject <UpDownIcon boxSize={3} color="text.tertiary" /></Flex>
                </Th>
                <Th isNumeric borderBottom="1px solid" borderColor="border.subtle" color="text.secondary" fontSize="sm" fontWeight="600" textTransform="none" letterSpacing="normal" py={4}>
                  <Flex justify="flex-end" align="center" gap={2}>Size <UpDownIcon boxSize={3} color="text.tertiary" /></Flex>
                </Th>
                <Th isNumeric borderBottom="1px solid" borderColor="border.subtle" color="text.secondary" fontSize="sm" fontWeight="600" textTransform="none" letterSpacing="normal" py={4}>
                  <Flex justify="flex-end" align="center" gap={2}>Date <UpDownIcon boxSize={3} color="text.tertiary" /></Flex>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {pageRows.map((m) => (
                <Tr
                  key={m.id}
                  bg="transparent"
                  _hover={{ bg: 'bg.hover' }}
                  onClick={() => toggle(m.id)}
                  cursor="pointer"
                  borderBottom="1px solid"
                  borderColor="border.subtle"
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
                      <Text fontSize="sm" fontWeight={600} isTruncated>
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
                    <Text fontSize="xs" fontWeight={600} color="text.primary">{m.sizeMB.toLocaleString()} MB</Text>
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
      )}
      {paginate && (
        <Flex align="center" justify="flex-end" px={4} py={2} borderTop="1px" borderColor="border.subtle" bg="bg.card">
          <HStack spacing={4}>
            <HStack>
              <Text fontSize="sm" color="text.secondary">Rows per page:</Text>
              <Select size="sm" w="80px" value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0) }}>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </Select>
            </HStack>
            <Text fontSize="sm" color="text.secondary">
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

// ── Main component ────────────────────────────────────────────────────────────

type DrillKey = { by: 'sender'; value: string } | { by: 'month'; value: string } | { by: 'year'; value: string } | { by: 'size'; value: string } | null

export default function StorageTab({ 
  onDisconnected, 
  onCacheInfo 
}: { 
  onDisconnected: () => void
  onCacheInfo?: (info: { timestamp: number | null; secondsUntilRefresh: number; onRefresh: () => void; stats?: { totalMB: number; messageCount: number } }) => void
}) {
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trashDone, setTrashDone] = useState<string | null>(null)
  const [confirmTrash, setConfirmTrash] = useState(false)
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null)
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState<number>(300)

  useAutoClearAlert(error, setError)
  useAutoClearAlert(trashDone, setTrashDone)

  const [drillKey, setDrillKey] = useState<DrillKey>(null)
  const [drillMessages, setDrillMessages] = useState<StorageDrillMessage[] | null>(null)
  const [drillLoading, setDrillLoading] = useState(false)
  const [showAllData, setShowAllData] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [attachPage, setAttachPage] = useState(0)
  const [attachRowsPerPage, setAttachRowsPerPage] = useState(100)
  useEffect(() => { setAttachPage(0) }, [stats?.attachments])
  const attachView = useMemo(() => {
    const list = stats?.attachments ?? []
    const paginate = list.length > attachRowsPerPage
    const pageCount = Math.max(1, Math.ceil(list.length / attachRowsPerPage))
    const safePage = Math.min(attachPage, pageCount - 1)
    const startIdx = safePage * attachRowsPerPage
    return {
      paginate,
      safePage,
      rows: paginate ? list.slice(startIdx, startIdx + attachRowsPerPage) : list,
      total: list.length,
      pageCount
    }
  }, [stats, attachPage, attachRowsPerPage])

  const trashJob = useJob()

  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set())
  const toggleYear = (year: string) => {
    setExpandedYears(prev => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })
  }

  const monthsByYear = useMemo(() => {
    if (!stats) return {}
    const groups: Record<string, typeof stats.months> = {}
    for (const m of stats.months) {
      const year = m.month.split('-')[0]
      if (!groups[year]) groups[year] = []
      groups[year].push(m)
    }
    return groups
  }, [stats])

  const handleApiError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    },
    [onDisconnected]
  )

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true)
      setError(null)
    }
    try {
      const data = await api.storageStats()
      if (isSilent) {
        // Compare with current stats
        const currentStatsStr = stats ? JSON.stringify(stats) : ''
        const newStatsStr = JSON.stringify(data)
        if (currentStatsStr !== newStatsStr) {
          setStats(data)
        }
      } else {
        setStats(data)
      }
      clientCache.setStorageStats(data)
      setCacheTimestamp(Date.now())
      setSecondsUntilRefresh(300)
    } catch (err) {
      if (!isSilent) {
        handleApiError(err)
      } else {
        console.error("Background load failed", err)
      }
    } finally {
      if (!isSilent) {
        setLoading(false)
      }
    }
  }, [handleApiError, stats])

  // Initial load checking client cache
  useEffect(() => {
    const cached = clientCache.getStorageStats()
    if (cached) {
      setStats(cached.data)
      setCacheTimestamp(cached.timestamp)
      setLoading(false)
      const remaining = Math.max(0, 300000 - (Date.now() - cached.timestamp))
      setSecondsUntilRefresh(Math.ceil(remaining / 1000))
    } else {
      load(false)
    }
  }, []) // run once on mount

  // Background refresh checking loop
  useEffect(() => {
    if (!cacheTimestamp) return
    let isFetching = false
    const interval = setInterval(async () => {
      const elapsed = Date.now() - cacheTimestamp
      const remaining = Math.max(0, 300000 - elapsed)
      const secs = Math.ceil(remaining / 1000)
      setSecondsUntilRefresh(secs)

      if (remaining === 0 && !isFetching) {
        isFetching = true
        try {
          await load(true)
        } catch (err) {
          console.error("Background refresh failed", err)
          setCacheTimestamp(Date.now())
        } finally {
          isFetching = false
        }
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [cacheTimestamp, load])

  const refresh = async () => {
    setSelectedIds(new Set())
    setTrashDone(null)
    setDrillKey(null)
    setDrillMessages(null)
    clientCache.clearStorageStats()
    try {
      await api.storageRefresh()
      await load(false)
    } catch (err) {
      handleApiError(err)
    }
  }

  useEffect(() => {
    if (onCacheInfo) {
      onCacheInfo({
        timestamp: cacheTimestamp,
        secondsUntilRefresh,
        onRefresh: refresh,
        stats: stats ? { totalMB: stats.totalMB, messageCount: stats.messageCount } : undefined
      })
    }
  }, [cacheTimestamp, secondsUntilRefresh, onCacheInfo, stats])

  const openDrill = async (by: 'sender' | 'month' | 'year' | 'size', value: string) => {
    setShowAllData(true)
    if (drillKey?.by === by && drillKey.value === value) {
      setDrillKey(null)
      setDrillMessages(null)
      return
    }
    setDrillKey({ by, value } as DrillKey)
    setDrillMessages(null)
    setDrillLoading(true)
    try {
      const msgs = await api.storageDrillDown(by, value)
      setDrillMessages(msgs)
    } catch (err) {
      handleApiError(err)
      setDrillKey(null)
    } finally {
      setDrillLoading(false)
    }
  }

  const closeDrill = () => {
    setDrillKey(null)
    setDrillMessages(null)
  }

  const toggleAttachment = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllAttachments = () => {
    if (!stats) return
    const allIds = attachView.rows.map((a) => a.id)
    const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))
    if (allSelected) {
      const next = new Set(selectedIds)
      allIds.forEach((id) => next.delete(id))
      setSelectedIds(next)
    } else {
      setSelectedIds(new Set([...selectedIds, ...allIds]))
    }
  }

  const runTrash = async () => {
    setConfirmTrash(false)
    setError(null)
    setTrashDone(null)
    const ids = [...selectedIds]
    try {
      const response = await api.trashMessages(ids)
      if ('jobId' in response && response.jobId) {
        const snapshot = await trashJob.start(() =>
          Promise.resolve({ jobId: (response as { jobId: string }).jobId })
        )
        if (snapshot.state === 'error') {
          setError(snapshot.error || 'Move to Trash failed')
          return
        }
      }
      const count = 'trashed' in response ? response.trashed : ids.length
      setTrashDone(`Moved ${count.toLocaleString()} messages to Trash. Recoverable in Gmail for 30 days.`)
      setSelectedIds(new Set())
      setStats((prev) =>
        prev ? { ...prev, attachments: prev.attachments.filter((a) => !ids.includes(a.id)) } : prev
      )
      setDrillMessages((prev) => prev ? prev.filter((m) => !ids.includes(m.id)) : prev)
    } catch (err) {
      handleApiError(err)
    }
  }

  const gridStroke = useColorModeValue('#EEF0F2', 'rgba(255,255,255,0.06)')

  const largestSender = useMemo(() => {
    return stats && stats.senders && stats.senders.length > 0
      ? [...stats.senders].sort((a, b) => b.totalMB - a.totalMB)[0]
      : null
  }, [stats])

  const oldestYear = useMemo(() => {
    return stats && stats.years && stats.years.length > 0
      ? [...stats.years].sort((a, b) => Number(a.year) - Number(b.year))[0]
      : null
  }, [stats])

  const topSendersChart = useMemo(() => {
    return (stats?.senders || []).slice(0, 8).map((s) => ({
      name: parseFromHeader(s.name || s.email),
      email: s.email,
      mb: s.totalMB,
      count: s.messageCount,
    }))
  }, [stats])

  const sizeDonutData = useMemo(() => {
    const palette = ['#15803D', '#2563EB', '#8B5CF6', '#F59E0B']
    return (stats?.sizes || [])
      .filter((s) => s.totalMB > 0)
      .map((s, idx) => ({
        name: s.label,
        value: s.totalMB,
        count: s.messageCount,
        color: palette[idx % palette.length]
      }))
  }, [stats])

  if (loading) {
    return (
      <Flex direction="column" align="center" justify="center" py={16}>
        <EmailLoader size="md" message="Analyzing your largest emails… this can take a moment." />
      </Flex>
    )
  }

  if (error && !stats) {
    return <Alert status="error" borderRadius="md"><AlertIcon />{error}</Alert>
  }

  if (!stats) return null

  const allAttachmentsSelected =
    attachView.rows.length > 0 && attachView.rows.every((a) => selectedIds.has(a.id))
  const someAttachmentsSelected = attachView.rows.some((a) => selectedIds.has(a.id))

  const drillTitle =
    drillKey?.by === 'sender'
      ? `Emails from ${parseFromHeader(
          stats.senders.find((s) => s.email === drillKey.value)?.name ?? drillKey.value
        )}`
      : drillKey?.by === 'month'
      ? `Emails from ${drillKey.value}`
      : drillKey?.by === 'year'
      ? `Emails from ${drillKey.value}`
      : drillKey?.by === 'size'
      ? `Emails sized ${(stats.sizes ?? []).find(s => s.key === drillKey.value)?.label ?? drillKey.value}`
      : ''

  return (
    <Flex direction="column" h="100%" minH={0} pr={1} overflowY="auto">
      {error && <Alert status="error" mb={4} borderRadius="md"><AlertIcon />{error}</Alert>}
      {trashDone && <Alert status="success" mb={4} borderRadius="md"><AlertIcon />{trashDone}</Alert>}

      {/* Insight-First Hero Section (§3.4) */}
      <Box mb={6}>
        <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={4} mb={4}>
          <StatCard
            label="Total recoverable"
            value={Math.round(stats.totalMB)}
            unit="MB"
            hint={`${stats.messageCount.toLocaleString()} large emails`}
            accent="brand.500"
            icon={<Icon as={HardDrive} boxSize={4} />}
          />
          <StatCard
            label="Largest sender"
            value={largestSender ? Math.round(largestSender.totalMB) : 0}
            unit="MB"
            hint={largestSender ? parseFromHeader(largestSender.name || largestSender.email) : 'None'}
            accent="ai.500"
          />
          <StatCard
            label="Oldest heavy year"
            value={oldestYear ? Number(oldestYear.year) : 0}
            animate={false}
            hint={oldestYear ? `${Math.round(oldestYear.totalMB)} MB in ${oldestYear.messageCount} emails` : 'None'}
            accent="highlight.500"
          />
        </SimpleGrid>

        <Grid templateColumns={{ base: '1fr', lg: '1fr 1.6fr' }} gap={4} mb={4}>
          <GridItem
            bg="bg.card" border="1px solid" borderColor="border.subtle" borderRadius="card"
            boxShadow="e1" p={5}
          >
            <Text fontSize="15px" fontWeight={600} color="text.primary" mb={1}>Storage by size category</Text>
            <Text fontSize="13px" color="text.tertiary" mb={3}>Distribution across file size bands</Text>
            {sizeDonutData.length === 0 ? (
              <Flex h="210px" align="center" justify="center">
                <Text fontSize="13px" color="text.tertiary">No size categories recorded.</Text>
              </Flex>
            ) : (
              <Flex align="center" gap={4} direction={{ base: 'column', sm: 'row' }}>
                <Box w="140px" h="170px" flexShrink={0}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sizeDonutData} dataKey="value" nameKey="name"
                        innerRadius={44} outerRadius={66} paddingAngle={2} stroke="none"
                      >
                        {sizeDonutData.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                      <RTooltip
                        contentStyle={{ borderRadius: 12, border: '1px solid var(--chakra-colors-border-subtle)', boxShadow: 'var(--chakra-shadows-e2)', fontSize: 13 }}
                        formatter={(v, n) => [`${Number(v).toLocaleString()} MB`, String(n)]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
                <VStack align="stretch" spacing={2.5} flex={1}>
                  {sizeDonutData.map((d) => (
                    <Flex key={d.name} align="center" justify="space-between" fontSize="13px">
                      <HStack spacing={2}>
                        <Box w={2.5} h={2.5} borderRadius="sm" bg={d.color} />
                        <Text color="text.secondary" isTruncated>{d.name}</Text>
                      </HStack>
                      <Text fontWeight={600} color="text.primary">{d.value.toLocaleString()} MB</Text>
                    </Flex>
                  ))}
                </VStack>
              </Flex>
            )}
          </GridItem>

          <GridItem
            bg="bg.card" border="1px solid" borderColor="border.subtle" borderRadius="card"
            boxShadow="e1" p={5}
          >
            <Flex justify="space-between" align="center" mb={1}>
              <Text fontSize="15px" fontWeight={600} color="text.primary">Top senders by storage</Text>
              <Text fontSize="xs" color="text.tertiary">Click a bar to inspect</Text>
            </Flex>
            <Text fontSize="13px" color="text.tertiary" mb={3}>Heavy senders taking up mailbox quota</Text>
            {topSendersChart.length === 0 ? (
              <Flex h="210px" align="center" justify="center">
                <Text fontSize="13px" color="text.tertiary">No senders found.</Text>
              </Flex>
            ) : (
              <Box h="200px">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={topSendersChart}
                    margin={{ top: 0, right: 16, left: 30, bottom: 0 }}
                  >
                    <CartesianGrid stroke={gridStroke} horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--chakra-colors-text-tertiary)' }} unit=" MB" />
                    <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--chakra-colors-text-secondary)' }} width={95} />
                    <RTooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid var(--chakra-colors-border-subtle)', boxShadow: 'var(--chakra-shadows-e2)', fontSize: 13 }}
                      formatter={(v) => [`${Number(v).toLocaleString()} MB`, 'Storage']}
                    />
                    <Bar
                      dataKey="mb"
                      fill="var(--chakra-colors-brand-500)"
                      radius={[0, 6, 6, 0]}
                      cursor="pointer"
                      onClick={(data: any) => {
                        if (data && data.email) openDrill('sender', data.email)
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
          </GridItem>
        </Grid>

        <Flex justify="flex-end">
          <Button
            size="sm"
            variant="ghost"
            rightIcon={<Icon as={showAllData ? ChevronUp : ChevronDown} boxSize={4} />}
            onClick={() => setShowAllData(v => !v)}
            color="text.secondary"
          >
            {showAllData ? 'Hide detailed breakdown' : 'Explore all data & filters'}
          </Button>
        </Flex>
      </Box>

      {(showAllData || drillKey !== null || drillMessages !== null) && (
        <Box>

      {/* Horizontal Size Bands */}
      {(stats.sizes ?? []).length > 0 && !(stats.sizes ?? []).every(s => s.messageCount === 0) && (
        <Flex 
          overflowX="auto" 
          py={2} 
          mb={6}
          gap={3} 
          sx={{ '&::-webkit-scrollbar': { display: 'none' } }}
        >
            <Button
              size="sm"
              variant={drillKey?.by !== 'size' ? 'solid' : 'outline'}
              colorScheme={drillKey?.by !== 'size' ? 'brand' : 'gray'}
              onClick={() => {
                if (drillKey?.by === 'size') closeDrill()
              }}
              borderRadius="full"
              flexShrink={0}
            >
              All Sizes
            </Button>
            {(stats.sizes ?? []).map((s: StorageSizeBand) => {
              const active = drillKey?.by === 'size' && drillKey.value === s.key
              const disabled = s.messageCount === 0
              return (
                <Button
                  key={s.key}
                  size="sm"
                  isDisabled={disabled}
                  variant={active ? 'solid' : 'outline'}
                  onClick={() => !disabled && openDrill('size', s.key)}
                  bg={active ? 'brand.500' : 'bg.card'}
                  borderColor={active ? 'brand.500' : 'border.glass'}
                  color={active ? 'white' : 'text.primary'}
                  _hover={disabled ? {} : { bg: active ? 'brand.500' : 'bg.hover' }}
                  borderRadius="full"
                  flexShrink={0}
                  borderWidth="1px"
                >
                  {s.label} <Text as="span" ml={2} opacity={0.7} fontSize="xs">{disabled ? '0' : `${s.totalMB.toLocaleString()} MB`}</Text>
                </Button>
              )
            })}
          </Flex>
      )}

      <Grid templateColumns={{ base: '1fr', md: 'repeat(12, 1fr)' }} gap={6} mb={6} flex={1} minH={0}>
        {/* LEFT PANE — Navigation */}
        <GridItem colSpan={{ base: 12, md: 4, lg: 4 }} minH={0} overflowY={{ md: 'auto' }} pr={{ md: 2 }}>
          <VStack spacing={6} align="stretch">
            {/* Storage by Year -> Month */}
            <Card borderRadius="2xl" overflow="hidden" boxShadow="sm" border="1px solid" borderColor="border.glass" bg="bg.card">
              <Box px={5} py={4} borderBottom="1px" borderColor="border.glass" bgGradient="linear(to-r, brand.50, transparent)">
                <Text fontSize="xs" fontWeight="800" color="text.secondary" letterSpacing="wider" textTransform="uppercase" display="flex" alignItems="center">
                  <Icon as={CalendarIcon} mr={2} color="brand.500" /> Storage by Date
                </Text>
              </Box>
              <CardBody p={3} maxH="320px" overflowY="auto" css={{ '&::-webkit-scrollbar': { display: 'none' } }}>
                {(stats.years ?? []).length === 0 && (
                  <Text fontSize="sm" color="text.secondary" p={2}>No large emails found.</Text>
                )}
                <VStack spacing={2} align="stretch">
                  {(stats.years ?? []).map((y: StorageYear) => {
                    const isExpanded = expandedYears.has(y.year)
                    return (
                      <Box key={y.year}>
                        <Flex
                          onClick={() => toggleYear(y.year)}
                          align="center" justify="space-between" px={4} py={3} borderRadius="xl" cursor="pointer"
                          bg={isExpanded ? 'brand.500' : 'bg.glass'}
                          color={isExpanded ? 'white' : 'text.primary'}
                          border="1px solid" borderColor={isExpanded ? 'brand.500' : 'border.subtle'}
                          boxShadow={isExpanded ? '0 4px 14px rgba(0,0,0,0.1)' : 'none'}
                          transition="all 0.2s"
                          _hover={{ transform: 'translateX(4px)', bg: isExpanded ? 'brand.600' : 'bg.hover' }}
                        >
                          <HStack spacing={3}>
                            <Flex w="32px" h="32px" borderRadius="lg" bg={isExpanded ? 'whiteAlpha.300' : 'brand.100'} align="center" justify="center">
                              <CalendarIcon color={isExpanded ? 'white' : 'brand.500'} boxSize={4} />
                            </Flex>
                            <Text fontSize="sm" fontWeight={700} isTruncated>
                              {y.year}
                            </Text>
                          </HStack>
                          <HStack spacing={2} flexShrink={0}>
                            <Text fontSize="sm" fontWeight={800}>
                              {y.totalMB.toLocaleString()} MB
                            </Text>
                            <Text fontSize="10px" opacity={0.6}>{isExpanded ? '▲' : '▼'}</Text>
                          </HStack>
                        </Flex>
                        {isExpanded && (
                          <VStack spacing={1} align="stretch" mt={2} pl={6}>
                            {(monthsByYear[y.year] || []).map((m) => {
                              const active = drillKey?.by === 'month' && drillKey.value === m.month
                              return (
                                <Flex
                                  key={m.month}
                                  onClick={() => openDrill('month', m.month)}
                                  align="center" justify="space-between" px={4} py={2} borderRadius="lg" cursor="pointer"
                                  bg={active ? 'blue.50' : 'transparent'}
                                  borderLeft="3px solid" borderColor={active ? 'blue.400' : 'transparent'}
                                  color={active ? 'blue.800' : 'text.secondary'}
                                  transition="all 0.2s"
                                  _hover={{ bg: active ? 'blue.100' : 'bg.hover', transform: 'translateX(2px)' }}
                                >
                                  <Text fontSize="sm" fontWeight={active ? 700 : 500} isTruncated>
                                    {new Date(Number(m.month.split('-')[0]), Number(m.month.split('-')[1]) - 1).toLocaleString('default', { month: 'long' })}
                                  </Text>
                                  <Text fontSize="xs" fontWeight={active ? 800 : 600} flexShrink={0}>
                                    {m.totalMB.toLocaleString()} MB
                                  </Text>
                                </Flex>
                              )
                            })}
                          </VStack>
                        )}
                      </Box>
                    )
                  })}
                </VStack>
              </CardBody>
            </Card>

            {/* Top Senders */}
            <Card borderRadius="2xl" overflow="hidden" boxShadow="sm" border="1px solid" borderColor="border.glass" bg="bg.card">
              <Box px={5} py={4} borderBottom="1px" borderColor="border.glass" bgGradient="linear(to-r, brand.50, transparent)">
                <Text fontSize="xs" fontWeight="800" color="text.secondary" letterSpacing="wider" textTransform="uppercase" display="flex" alignItems="center">
                  <Icon as={CopyIcon} mr={2} color="brand.500" /> Top Senders
                </Text>
              </Box>
              <CardBody p={3} maxH="320px" overflowY="auto" css={{ '&::-webkit-scrollbar': { display: 'none' } }}>
                {stats.senders.length === 0 && (
                  <Text fontSize="sm" color="text.secondary" p={2}>No large emails found.</Text>
                )}
                <VStack spacing={2} align="stretch">
                  {stats.senders.map((s) => {
                    const active = drillKey?.by === 'sender' && drillKey.value === s.email
                    return (
                      <Flex
                        key={s.email}
                        onClick={() => openDrill('sender', s.email)}
                        align="center" justify="space-between" px={4} py={3} borderRadius="xl" cursor="pointer"
                        bg={active ? 'brand.500' : 'bg.glass'}
                        color={active ? 'white' : 'text.primary'}
                        border="1px solid" borderColor={active ? 'brand.500' : 'border.subtle'}
                        boxShadow={active ? '0 4px 14px rgba(0,0,0,0.1)' : 'none'}
                        transition="all 0.2s"
                        _hover={{ transform: 'translateX(4px)', bg: active ? 'brand.600' : 'bg.hover' }}
                      >
                        <Box overflow="hidden">
                          <Text fontSize="sm" fontWeight={active ? 700 : 500} isTruncated>
                            {parseFromHeader(s.name)}
                          </Text>
                          <Text fontSize="xs" opacity={0.8} isTruncated>
                            {s.email}
                          </Text>
                        </Box>
                        <Text fontSize="sm" fontWeight={active ? 800 : 600} flexShrink={0}>
                          {s.totalMB.toLocaleString()} MB
                        </Text>
                      </Flex>
                    )
                  })}
                </VStack>
              </CardBody>
            </Card>
          </VStack>
        </GridItem>

        {/* RIGHT PANE — Content */}
        <GridItem colSpan={{ base: 12, md: 8, lg: 8 }} minH={0}>
            <Box position="relative" h="100%">
            {drillKey ? (
              <Box h="100%">
                <DrillPanel
                  title={drillTitle}
                  messages={drillMessages}
                  loading={drillLoading}
                  selected={selectedIds}
                  onSelectedChange={setSelectedIds}
                  onClose={closeDrill}
                />
              </Box>
            ) : (
              <Card 
                variant="outline" 
                borderRadius="xl" 
                h="100%" 
                display="flex" 
                flexDir="column" 
                bg="bg.card" 
                
                pb={selectedIds.size > 0 ? "80px" : "0px"}
                transition="padding-bottom 0.2s"
              >
              <Box px={6} py={4} borderBottom="1px" borderColor="border.glass" bg="transparent">
                <Flex align="center" justify="space-between">
                  <Text fontSize="lg" fontWeight={700} color="text.primary">Largest attachments (&gt;5 MB)</Text>
                  {selectedIds.size > 0 && (
                    <Tag size="sm" colorScheme="brand" borderRadius="full">
                      {selectedIds.size} selected
                    </Tag>
                  )}
                </Flex>
                <Text fontSize="sm" color="neutral.500" mt={1}>
                  Default view showing all massive attachments across your mailbox.
                </Text>
              </Box>

              {stats.attachments.length === 0 ? (
                <Box p={6}>
                  <Text fontSize="sm" color="text.secondary">No attachments larger than 5 MB found.</Text>
                </Box>
              ) : (
                <TableContainer flex={1} overflowY="auto">
                  <Table size="sm" variant="simple">
                    <Thead position="sticky" top={0} bg="bg.muted" zIndex={1} boxShadow="0 2px 4px rgba(0,0,0,0.02)">
                      <Tr>
                        <Th w="40px" px={4} borderBottom="1px solid" borderColor="border.subtle" py={4}>
                          <Checkbox
                            isChecked={allAttachmentsSelected}
                            isIndeterminate={someAttachmentsSelected && !allAttachmentsSelected}
                            onChange={toggleAllAttachments}
                            colorScheme="brand"
                          />
                        </Th>
                        <Th borderBottom="1px solid" borderColor="border.subtle" color="text.secondary" fontSize="sm" fontWeight="600" textTransform="none" letterSpacing="normal" py={4}>
                          <Flex align="center" gap={2}>From <UpDownIcon boxSize={3} color="text.tertiary" /></Flex>
                        </Th>
                        <Th borderBottom="1px solid" borderColor="border.subtle" color="text.secondary" fontSize="sm" fontWeight="600" textTransform="none" letterSpacing="normal" py={4}>
                          <Flex align="center" gap={2}>Subject <UpDownIcon boxSize={3} color="text.tertiary" /></Flex>
                        </Th>
                        <Th isNumeric borderBottom="1px solid" borderColor="border.subtle" color="text.secondary" fontSize="sm" fontWeight="600" textTransform="none" letterSpacing="normal" py={4}>
                          <Flex justify="flex-end" align="center" gap={2}>Size <UpDownIcon boxSize={3} color="text.tertiary" /></Flex>
                        </Th>
                        <Th isNumeric borderBottom="1px solid" borderColor="border.subtle" color="text.secondary" fontSize="sm" fontWeight="600" textTransform="none" letterSpacing="normal" py={4}>
                          <Flex justify="flex-end" align="center" gap={2}>Date <UpDownIcon boxSize={3} color="text.tertiary" /></Flex>
                        </Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {attachView.rows.map((a: StorageAttachment) => (
                        <Tr
                          key={a.id}
                          bg="transparent"
                          _hover={{ bg: 'bg.hover' }}
                          onClick={() => toggleAttachment(a.id)}
                          cursor="pointer"
                          borderBottom="1px solid"
                          borderColor="border.subtle"
                          boxShadow={selectedIds.has(a.id) ? 'inset 3px 0 0 0 var(--chakra-colors-brand-500)' : 'none'}
                        >
                          <Td px={4} onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              isChecked={selectedIds.has(a.id)}
                              onChange={() => toggleAttachment(a.id)}
                              onClick={(e) => e.stopPropagation()}
                              colorScheme="brand"
                            />
                          </Td>
                          <Td maxW="160px">
                            <Tooltip label={a.from} placement="top-start" hasArrow maxW="400px" whiteSpace="normal">
                              <Text fontSize="sm" fontWeight={600} isTruncated>
                                {parseFromHeader(a.from)}
                              </Text>
                            </Tooltip>
                          </Td>
                          <Td maxW="280px">
                            <Text fontSize="sm" color="text.secondary" isTruncated>
                              {a.subject || '(no subject)'}
                            </Text>
                          </Td>
                          <Td isNumeric whiteSpace="nowrap">
                            <Text fontSize="xs" fontWeight={600}>{a.sizeMB.toLocaleString()} MB</Text>
                          </Td>
                          <Td isNumeric whiteSpace="nowrap">
                            <Text fontSize="xs" color="text.secondary">
                              {new Date(a.date).toLocaleDateString(undefined, {
                                month: 'short', day: 'numeric', year: 'numeric',
                              })}
                            </Text>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              )}
              {attachView.paginate && (
                <Flex align="center" justify="flex-end" px={4} py={2} borderTop="1px" borderColor="border.subtle" bg="bg.card">
                  <HStack spacing={4}>
                    <HStack>
                      <Text fontSize="sm" color="text.secondary">Rows per page:</Text>
                      <Select size="sm" w="80px" value={attachRowsPerPage} onChange={(e) => { setAttachRowsPerPage(Number(e.target.value)); setAttachPage(0) }}>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={200}>200</option>
                      </Select>
                    </HStack>
                    <Text fontSize="sm" color="text.secondary">
                      {attachView.safePage * attachRowsPerPage + 1}-{Math.min((attachView.safePage + 1) * attachRowsPerPage, attachView.total)} of {attachView.total}
                    </Text>
                    <HStack spacing={1}>
                      <IconButton aria-label="Previous" icon={<ChevronLeftIcon />} size="sm" variant="ghost" isDisabled={attachView.safePage === 0} onClick={() => setAttachPage(p => p - 1)} />
                      <IconButton aria-label="Next" icon={<ChevronRightIcon />} size="sm" variant="ghost" isDisabled={attachView.safePage >= attachView.pageCount - 1} onClick={() => setAttachPage(p => p + 1)} />
                    </HStack>
                  </HStack>
                </Flex>
              )}
            </Card>
          )}

          {/* Floating trash tray */}
          {selectedIds.size > 0 && (
            <Flex
              position="absolute" left={6} right={6} bottom={6} mx="auto"
              align="center" justify="space-between" gap={4}
              bg="bg.tray" color="text.inverse"
              borderRadius="full" pl={4} pr={3} py={3} zIndex={50}
              boxShadow="0 18px 50px rgba(0,0,0, 0.4)" border="1px solid" borderColor="whiteAlpha.200"
            >
              <HStack spacing={3} flex={1}>
                <Flex px={2} py={1} borderRadius="md" bg="brand.500" fontWeight={800} fontSize="sm" color="white" boxShadow="0 2px 8px rgba(67, 110, 111, 0.4)">
                  {selectedIds.size}
                </Flex>
                <Text fontSize="sm" color="whiteAlpha.800">messages selected</Text>
              </HStack>
              <HStack spacing={2}>
                <Button
                  size="sm" borderRadius="full" px={4} colorScheme="red"
                  isDisabled={trashJob.running}
                  onClick={() => setConfirmTrash(true)}
                >
                  Move to Trash
                </Button>
                <Button size="sm" borderRadius="full" px={4} variant="ghost" color="whiteAlpha.800" _hover={{ color: 'white', bg: 'whiteAlpha.300' }} onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
              </HStack>
            </Flex>
          )}
        </Box>
        </GridItem>
      </Grid>
      </Box>
      )}

      {confirmTrash && (
        <ConfirmDialog
          title={`Move ${selectedIds.size.toLocaleString()} messages to Trash?`}
          message="These messages will move to Gmail Trash, recoverable for 30 days. Nothing is permanently deleted."
          danger
          requireTypedCount={selectedIds.size > 50 ? selectedIds.size : undefined}
          onCancel={() => setConfirmTrash(false)}
          onConfirm={runTrash}
        />
      )}
    </Flex>
  )
}
