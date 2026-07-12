import { useCallback, useEffect, useState, useMemo } from 'react'
import {
  Alert, AlertIcon, Box, Button, Card, CardBody, Checkbox, Tag, IconButton,
  Grid, GridItem, Flex, Text, Table, Thead, Tbody,
  Tr, Th, Td, TableContainer, Tooltip, Icon, HStack, VStack, InputGroup, InputLeftElement, Input, Progress, Select,
  Accordion, AccordionItem, AccordionButton, AccordionPanel, AccordionIcon
} from '@chakra-ui/react'
import EmailLoader from './EmailLoader'
import { SearchIcon, UpDownIcon, ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons'
import { Tags, Trash2, ArrowLeft, X } from 'lucide-react'
import StatCard from '../ui/StatCard'

import { api, ApiError } from '../api'
import { clientCache } from '../cache'
import type { GmailLabel, GroupMessage } from '../types'
import { useJob } from '../hooks/useJob'
import { useAutoClearAlert } from '../hooks/useAutoClearAlert'
import ConfirmDialog from './ConfirmDialog'

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

export default function LabelManager({ 
  onDisconnected, 
  onCacheInfo 
}: { 
  onDisconnected: () => void
  onCacheInfo?: (info: { timestamp: number | null; secondsUntilRefresh: number; onRefresh: () => void; stats?: { totalMB: number; messageCount: number } }) => void
}) {
  const [labels, setLabels] = useState<GmailLabel[] | null>(null)
  const [selectedLabel, setSelectedLabel] = useState<GmailLabel | null>(null)
  const [messages, setMessages] = useState<GroupMessage[] | null>(null)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'name' | 'total' | 'unread'>('name')
  
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set())
  const [confirmTrashMsgs, setConfirmTrashMsgs] = useState(false)
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false)
  const [trashMsgsDone, setTrashMsgsDone] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [confirmLabelAction, setConfirmLabelAction] = useState<{ label: GmailLabel; mode: 'labelOnly' | 'trashEmails' } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)

  const paginate = messages ? messages.length > rowsPerPage : false
  const pageCount = messages ? Math.ceil(messages.length / rowsPerPage) : 0
  const safePage = Math.min(page, Math.max(0, pageCount - 1))
  const start = safePage * rowsPerPage
  const pageRows = paginate && messages ? messages.slice(start, start + rowsPerPage) : (messages ?? [])
  
  useAutoClearAlert(error, setError)
  useAutoClearAlert(trashMsgsDone, setTrashMsgsDone)

  const trashJob = useJob()

  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null)
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState<number>(300)

  const handleApiError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    },
    [onDisconnected]
  )

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setError(null)
    }
    try {
      const all = await api.allLabels()
      if (isSilent) {
        // Compare with current labels
        const currentLabelsStr = labels ? JSON.stringify(labels) : ''
        const newLabelsStr = JSON.stringify(all)
        if (currentLabelsStr !== newLabelsStr) {
          setLabels(all)
          // If selectedLabel changed, refresh its messages
          if (selectedLabel) {
            const freshSelected = all.find(l => l.id === selectedLabel.id)
            if (freshSelected) {
              setSelectedLabel(freshSelected)
            } else {
              setSelectedLabel(null)
            }
          }
        }
      } else {
        setLabels(all)
      }
      clientCache.setLabels(all)
      setCacheTimestamp(Date.now())
      setSecondsUntilRefresh(300)
    } catch (err) {
      if (!isSilent) {
        handleApiError(err)
      } else {
        console.error("Background labels load failed", err)
      }
    }
  }, [handleApiError, labels, selectedLabel])

  // Initial load checking client cache
  useEffect(() => {
    const cached = clientCache.getLabels()
    if (cached) {
      setLabels(cached.data)
      setCacheTimestamp(cached.timestamp)
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
          console.error("Background labels refresh failed", err)
          setCacheTimestamp(Date.now())
        } finally {
          isFetching = false
        }
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [cacheTimestamp, load])

  const refresh = async () => {
    setError(null)
    setLabels(null)
    clientCache.clearLabels()
    try {
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
        onRefresh: refresh
      })
    }
  }, [cacheTimestamp, secondsUntilRefresh, onCacheInfo])

  const loadMessages = useCallback(async (label: GmailLabel) => {
    setMessagesLoading(true)
    setTrashMsgsDone(null)
    setSelectedMsgIds(new Set())
    try {
      const msgs = await api.labelMessages(label.id)
      setMessages(msgs)
    } catch (err) {
      handleApiError(err)
      setMessages(null)
    } finally {
      setMessagesLoading(false)
    }
  }, [handleApiError])

  useEffect(() => {
    if (selectedLabel) {
      loadMessages(selectedLabel)
    } else {
      setMessages(null)
    }
  }, [selectedLabel, loadMessages])

  const executeLabelAction = async () => {
    if (!confirmLabelAction) return
    const { label, mode } = confirmLabelAction
    setConfirmLabelAction(null)
    setError(null)
    setBusyId(label.id)
    try {
      if (mode === 'labelOnly') {
        await api.deleteLabelOnly(label.id)
      } else {
        const snapshot = await trashJob.start(() => api.trashLabel(label.id))
        if (snapshot.state === 'error') setError(snapshot.error || 'Trashing failed')
      }
      
      if (selectedLabel?.id === label.id) {
        setSelectedLabel(null)
        setMessages(null)
        setSelectedMsgIds(new Set())
      }
      await load()
    } catch (err) {
      handleApiError(err)
    } finally {
      setBusyId(null)
    }
  }

  const executeTrashMessages = async () => {
    setConfirmTrashMsgs(false)
    setError(null)
    setTrashMsgsDone(null)
    const ids = [...selectedMsgIds]
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
      setTrashMsgsDone(`Moved ${count.toLocaleString()} messages to Trash.`)
      setSelectedMsgIds(new Set())
      
      if (selectedLabel) {
        loadMessages(selectedLabel)
      }
      await load()
    } catch (err) {
      handleApiError(err)
    }
  }

  const executeEmptyTrash = async () => {
    setConfirmEmptyTrash(false)
    setError(null)
    setTrashMsgsDone(null)
    setBusyId('TRASH')
    try {
      const response = await api.emptyTrash()
      if (response.jobId) {
        const snapshot = await trashJob.start(() => Promise.resolve({ jobId: response.jobId }))
        if (snapshot.state === 'error') {
          setError(snapshot.error || 'Empty Trash failed')
          return
        }
      }
      setTrashMsgsDone(`Trash has been emptied.`)
      if (selectedLabel) {
        loadMessages(selectedLabel)
      }
      await load()
    } catch (err) {
      handleApiError(err)
    } finally {
      setBusyId(null)
    }
  }

  const filteredLabels = useMemo(() => {
    if (!labels) return []
    const q = search.toLowerCase().trim()
    let filtered = labels
    // Hide system labels EXCEPT trash
    filtered = filtered.filter(l => l.type !== 'system' || l.id === 'TRASH')
    
    if (q) {
      filtered = filtered.filter((l) => l.name.toLowerCase().includes(q))
    }

    filtered.sort((a, b) => {
      if (sort === 'total') return b.messagesTotal - a.messagesTotal
      if (sort === 'unread') return b.messagesUnread - a.messagesUnread
      return a.name.localeCompare(b.name)
    })

    return filtered
  }, [labels, search, sort])

  const groupedLabels = useMemo(() => {
    return {
      app: filteredLabels.filter(l => l.appCreated),
      user: filteredLabels.filter(l => !l.appCreated && l.type !== 'system'),
      system: filteredLabels.filter(l => l.type === 'system')
    }
  }, [filteredLabels])

  const toggleMessage = (id: string) => {
    setSelectedMsgIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllMessages = () => {
    if (!messages) return
    const allSelected = messages.length > 0 && messages.every((m) => selectedMsgIds.has(m.id))
    if (allSelected) {
      const next = new Set(selectedMsgIds)
      messages.forEach((m) => next.delete(m.id))
      setSelectedMsgIds(next)
    } else {
      setSelectedMsgIds(new Set([...selectedMsgIds, ...messages.map((m) => m.id)]))
    }
  }

  const allSelected = messages && messages.length > 0 && messages.every((m) => selectedMsgIds.has(m.id))

  const progress = trashJob.job?.progress as
    | { phase?: string; collected?: number; trashed?: number; total?: number }
    | null

  const renderLabelItem = (l: GmailLabel) => {
    const isSelected = selectedLabel?.id === l.id
    const badgeColor = l.appCreated ? 'brand.500' : l.type === 'system' ? 'gray.400' : 'purple.500'

    return (
      <Flex
        key={l.id}
        onClick={() => setSelectedLabel(l)}
        align="center"
        justify="space-between"
        px={4} py={3} mb={2}
        borderRadius="xl"
        cursor="pointer"
        bg={isSelected ? 'brand.500' : 'bg.glass'}
        color={isSelected ? 'white' : 'text.primary'}
        boxShadow={isSelected ? '0 4px 14px rgba(67, 110, 111, 0.25)' : 'none'}
        transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
        _hover={{ bg: isSelected ? 'brand.600' : 'bg.hover', transform: 'translateX(4px)' }}
      >
        <HStack spacing={3} overflow="hidden">
          <Box w="8px" h="8px" borderRadius="full" bg={isSelected ? 'white' : badgeColor} flexShrink={0} />
          <Box overflow="hidden">
            <Text fontSize="sm" fontWeight={isSelected ? 800 : 600} isTruncated>
              {prettyLabelName(l)}
            </Text>
            <Text fontSize="xs" color={isSelected ? 'whiteAlpha.800' : 'neutral.500'} isTruncated>
              {l.messagesTotal.toLocaleString()} emails
            </Text>
          </Box>
        </HStack>
        {l.messagesUnread > 0 && (
          <Tag size="sm" borderRadius="full" colorScheme={isSelected ? 'whiteAlpha' : 'red'} variant="subtle" fontWeight="bold">
            {l.messagesUnread}
          </Tag>
        )}
      </Flex>
    )
  }

  if (labels === null && !error) {
    return (
      <Flex align="center" justify="center" p={8}>
        <EmailLoader size="sm" message="Loading labels…" />
      </Flex>
    )
  }

  return (
    <Flex direction="column" h="100%" minH={0}>
      {error && <Alert status="error" mb={4} borderRadius="md"><AlertIcon />{error}</Alert>}
      {trashMsgsDone && <Alert status="success" mb={4} borderRadius="md"><AlertIcon />{trashMsgsDone}</Alert>}
      {trashJob.running && progress && (
        <Box mb={4} p={4} borderRadius="md" bg="orange.50" border="1px solid" borderColor="orange.200">
          <Text fontSize="xs" color="text.secondary" fontWeight={600}>
            {progress.phase === 'collecting' && `🔍 Collecting emails… ${progress.collected ?? 0}`}
            {progress.phase === 'trashing' && `🗑️ Moving to Trash… ${progress.trashed ?? 0} / ${progress.total ?? '?'}`}
          </Text>
          <Progress size="xs" isIndeterminate mt={2} colorScheme="orange" />
        </Box>
      )}

      <Grid templateColumns={{ base: '1fr', md: 'repeat(12, 1fr)' }} gap={6} flex={1} minH={0}>
        {/* LEFT PANE — Labels list */}
        <GridItem colSpan={{ base: 12, md: 4, lg: 4 }} minH={0} overflowY={{ md: 'auto' }} pr={{ md: 2 }} display={{ base: selectedLabel ? 'none' : 'block', md: 'block' }}>
          <Card borderRadius="card" overflow="hidden" boxShadow="e1" border="1px solid" borderColor="border.subtle" bg="bg.card">
            <Flex align="center" justify="space-between" px={4} py={3.5} bg="bg.card" borderBottom="1px" borderColor="border.subtle">
              <HStack spacing={2.5}>
                <Icon as={Tags} color="text.secondary" boxSize={4} />
                <Text fontSize="15px" fontWeight={600} color="text.primary">Gmail Labels</Text>
              </HStack>
              {labels && (
                <Tag size="sm" borderRadius="full" bg="bg.accent" color="text.primary" fontWeight={600}>
                  {labels.length}
                </Tag>
              )}
            </Flex>

            <CardBody p={4}>
              <HStack mb={4} spacing={2}>
                <InputGroup size="sm">
                  <InputLeftElement pointerEvents="none">
                    <SearchIcon color="text.tertiary" />
                  </InputLeftElement>
                  <Input
                    placeholder="Search labels..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    borderRadius="md"
                  />
                </InputGroup>
                <Select size="sm" w="110px" borderRadius="md" value={sort} onChange={(e) => setSort(e.target.value as any)}>
                  <option value="name">Name</option>
                  <option value="total">Size</option>
                  <option value="unread">Unread</option>
                </Select>
              </HStack>

              {filteredLabels.length === 0 ? (
                <Text fontSize="sm" color="text.secondary" py={4} textAlign="center">
                  No labels found.
                </Text>
              ) : (
                <Box pr={1}>
                  <Accordion defaultIndex={[0, 1, 2]} allowMultiple border="none">
                    {groupedLabels.system.length > 0 && (
                      <AccordionItem border="none" mb={4}>
                        <AccordionButton _hover={{ bg: 'blackAlpha.50' }} borderRadius="md" px={3} py={2} mb={2}>
                          <Box flex="1" textAlign="left">
                            <Text fontSize="xs" fontWeight="bold" color="neutral.500" textTransform="uppercase" letterSpacing="wider">System</Text>
                          </Box>
                          <AccordionIcon color="neutral.500" />
                        </AccordionButton>
                        <AccordionPanel pb={4} px={0}>
                          {groupedLabels.system.map(renderLabelItem)}
                        </AccordionPanel>
                      </AccordionItem>
                    )}
                    {groupedLabels.app.length > 0 && (
                      <AccordionItem border="none" mb={4}>
                        <AccordionButton _hover={{ bg: 'blackAlpha.50' }} borderRadius="md" px={3} py={2} mb={2}>
                          <Box flex="1" textAlign="left">
                            <Text fontSize="xs" fontWeight="bold" color="neutral.500" textTransform="uppercase" letterSpacing="wider">App-Created</Text>
                          </Box>
                          <AccordionIcon color="neutral.500" />
                        </AccordionButton>
                        <AccordionPanel pb={4} px={0}>
                          {groupedLabels.app.map(renderLabelItem)}
                        </AccordionPanel>
                      </AccordionItem>
                    )}
                    {groupedLabels.user.length > 0 && (
                      <AccordionItem border="none" mb={4}>
                        <AccordionButton _hover={{ bg: 'blackAlpha.50' }} borderRadius="md" px={3} py={2} mb={2}>
                          <Box flex="1" textAlign="left">
                            <Text fontSize="xs" fontWeight="bold" color="neutral.500" textTransform="uppercase" letterSpacing="wider">User Labels</Text>
                          </Box>
                          <AccordionIcon color="neutral.500" />
                        </AccordionButton>
                        <AccordionPanel pb={4} px={0}>
                          {groupedLabels.user.map(renderLabelItem)}
                        </AccordionPanel>
                      </AccordionItem>
                    )}
                  </Accordion>
                </Box>
              )}
            </CardBody>
          </Card>
        </GridItem>

        {/* RIGHT PANE — Detail content */}
        <GridItem colSpan={{ base: 12, md: 8, lg: 8 }} minH={0} display={{ base: selectedLabel ? 'block' : 'none', md: 'block' }}>
          <Box position="relative" h="100%">
          {selectedLabel ? (
            <Card 
              variant="outline" 
              borderRadius="xl" 
              h="100%" 
              display="flex" 
              flexDir="column" 
              bg="bg.card" 
              
              pb={selectedMsgIds.size > 0 ? "80px" : "0px"}
              transition="padding-bottom 0.2s"
            >
              <Box bg="bg.card" borderBottom="1px solid" borderColor="border.subtle" px={6} py={5}>
                <Flex align="flex-start" justify="space-between" direction={{ base: 'column', sm: 'row' }} gap={4}>
                  <Box>
                    <HStack spacing={3} align="center" mb={1.5}>
                      <IconButton
                        aria-label="Back to labels"
                        icon={<Icon as={ArrowLeft} boxSize={4} />}
                        size="sm"
                        variant="ghost"
                        color="text.secondary"
                        _hover={{ bg: 'bg.hover' }}
                        onClick={() => setSelectedLabel(null)}
                      />
                      <Text fontSize="20px" fontWeight={700} color="text.primary">
                        {prettyLabelName(selectedLabel)}
                      </Text>
                      {selectedLabel.appCreated ? (
                        <Tag size="sm" colorScheme="brand" variant="subtle" borderRadius="full">App-Created</Tag>
                      ) : selectedLabel.type === 'system' ? (
                        <Tag size="sm" bg="bg.muted" color="text.secondary" borderRadius="full">System</Tag>
                      ) : (
                        <Tag size="sm" bg="bg.muted" color="text.secondary" borderRadius="full">User Label</Tag>
                      )}
                    </HStack>
                    <Text fontSize="13px" color="text.secondary">
                      {selectedLabel.messagesTotal.toLocaleString()} total emails {selectedLabel.messagesUnread > 0 && `• ${selectedLabel.messagesUnread.toLocaleString()} unread`}
                    </Text>
                  </Box>

                  {/* Actions */}
                  {selectedLabel.id === 'TRASH' && (
                    <Button
                      size="sm"
                      leftIcon={<Icon as={Trash2} boxSize={4} />}
                      isDisabled={busyId === selectedLabel.id}
                      onClick={() => setConfirmEmptyTrash(true)}
                      colorScheme="red"
                    >
                      Empty Trash
                    </Button>
                  )}
                  {selectedLabel.appCreated && (
                    <HStack spacing={2}>
                      <Button
                        size="sm"
                        leftIcon={<Icon as={X} boxSize={3.5} />}
                        isDisabled={busyId === selectedLabel.id}
                        onClick={() => setConfirmLabelAction({ label: selectedLabel, mode: 'labelOnly' })}
                        variant="outline"
                        color="text.secondary"
                        borderColor="border.subtle"
                        _hover={{ bg: 'bg.hover' }}
                      >
                        Remove Label
                      </Button>
                      <Button
                        size="sm"
                        leftIcon={<Icon as={Trash2} boxSize={4} />}
                        isDisabled={busyId === selectedLabel.id}
                        onClick={() => setConfirmLabelAction({ label: selectedLabel, mode: 'trashEmails' })}
                        colorScheme="red"
                      >
                        Trash + Delete
                      </Button>
                    </HStack>
                  )}
                </Flex>
              </Box>

              {/* Message List area */}
              {messagesLoading ? (
                <Flex flex={1} align="center" justify="center" direction="column" py={12}>
                  <EmailLoader size="md" message="Fetching label messages..." />
                </Flex>
              ) : messages && messages.length === 0 ? (
                <Box p={8} textAlign="center">
                  <Text fontSize="sm" color="text.secondary">No messages found in this label.</Text>
                </Box>
              ) : messages ? (
                <TableContainer flex={1} overflowY="auto">
                  <Table size="sm" variant="simple" style={{ tableLayout: 'fixed' }}>
                    <Thead position="sticky" top={0} bg="bg.muted" zIndex={1} boxShadow="0 2px 4px rgba(0,0,0,0.02)">
                      <Tr>
                        <Th w="40px" px={4} borderBottom="1px solid" borderColor="border.subtle" py={4}>
                          <Checkbox
                            isChecked={allSelected || false}
                            isIndeterminate={selectedMsgIds.size > 0 && !allSelected}
                            onChange={toggleAllMessages}
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
                          onClick={() => toggleMessage(m.id)}
                          cursor="pointer"
                          borderBottom="1px solid"
                          borderColor="border.subtle"
                          boxShadow={selectedMsgIds.has(m.id) ? 'inset 3px 0 0 0 var(--chakra-colors-brand-500)' : 'none'}
                        >
                          <Td px={4}>
                            <Checkbox
                              isChecked={selectedMsgIds.has(m.id)}
                              onChange={() => toggleMessage(m.id)}
                              onClick={(e) => e.stopPropagation()}
                              colorScheme="brand"
                            />
                          </Td>
                          <Td maxW="180px">
                            <Tooltip label={m.from} placement="top-start" hasArrow maxW="400px" whiteSpace="normal">
                              <Text fontSize="sm" fontWeight={600} color="text.primary" isTruncated>
                                {parseFromHeader(m.from)}
                              </Text>
                            </Tooltip>
                          </Td>
                          <Td maxW="280px">
                            <Text fontSize="sm" color="text.secondary" isTruncated>
                              {m.subject || '(no subject)'}
                            </Text>
                          </Td>
                          <Td isNumeric whiteSpace="nowrap">
                            <Text fontSize="xs" color="text.secondary">
                              {new Date(m.date).toLocaleDateString(undefined, {
                                month: 'short', day: 'numeric', year: 'numeric',
                              })}
                            </Text>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                  {paginate && (
                    <Flex align="center" justify="flex-end" px={4} py={2} borderTop="1px" borderColor="border.subtle" bg="bg.muted">
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
                </TableContainer>
              ) : null}
            </Card>
          ) : (
            <Card variant="outline" borderRadius="xl" h="100%" display="flex" flexDir="column" bg="bg.card"  p={{ base: 4, md: 8 }} overflowY="auto">
              <Text fontSize="2xl" fontWeight={800} color="text.primary" mb={6}>Label Insights</Text>
              
              <Grid templateColumns={{ base: '1fr', sm: 'repeat(3, 1fr)' }} gap={4} mb={8}>
                <StatCard
                  label="Total labels"
                  value={labels?.length || 0}
                  accent="text.primary"
                  icon={<Icon as={Tags} boxSize={4} />}
                />
                <StatCard
                  label="App-created"
                  value={groupedLabels.app.length}
                  accent="brand.500"
                />
                <StatCard
                  label="User labels"
                  value={groupedLabels.user.length}
                  accent="highlight.500"
                />
              </Grid>

              <Text fontSize="15px" fontWeight={600} color="text.primary" mb={3}>Largest Labels</Text>
                <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={4}>
                  {(() => {
                    const sorted = [...(labels || [])].sort((a, b) => b.messagesTotal - a.messagesTotal)
                    const maxTotal = sorted[0]?.messagesTotal || 1
                    return sorted.slice(0, 6).map(l => (
                      <Card
                        key={l.id}
                        borderRadius="card"
                        overflow="hidden"
                        cursor="pointer"
                        boxShadow="e1"
                        border="1px solid"
                        borderColor="border.subtle"
                        transition="all 0.2s"
                        _hover={{ boxShadow: 'e2', borderColor: 'brand.500', transform: 'translateY(-2px)' }}
                        onClick={() => setSelectedLabel(l)}
                        bg="bg.card"
                      >
                        <Flex align="center" justify="space-between" p={4}>
                          <HStack spacing={3} overflow="hidden">
                            <Flex w="36px" h="36px" borderRadius="lg" bg="bg.muted" align="center" justify="center" flexShrink={0}>
                              <Icon as={Tags} color="brand.500" boxSize={4} />
                            </Flex>
                            <Box overflow="hidden">
                              <Text fontSize="14px" fontWeight={600} color="text.primary" isTruncated>{prettyLabelName(l)}</Text>
                              <Text fontSize="12px" color="text.tertiary">{l.type === 'system' ? 'System' : l.appCreated ? 'App-Created' : 'User Label'}</Text>
                            </Box>
                          </HStack>
                          <VStack align="flex-end" spacing={0} ml={2} flexShrink={0}>
                            <Text fontSize="14px" fontWeight={700} color="text.primary">{l.messagesTotal.toLocaleString()}</Text>
                            <Text fontSize="11px" color="text.tertiary">emails</Text>
                          </VStack>
                        </Flex>
                        <Box h="4px" w="100%" bg="bg.muted">
                          <Box h="100%" bg="brand.400" w={`${Math.max(2, (l.messagesTotal / maxTotal) * 100)}%`} borderRadius="full" />
                        </Box>
                      </Card>
                    ))
                  })()}
                </Grid>
            </Card>
          )}

          {/* Floating trash tray for selected messages */}
          {selectedMsgIds.size > 0 && (
            <Flex
              position="absolute" left={6} right={6} bottom={6} mx="auto"
              align="center" justify="space-between" gap={4}
              bg="bg.tray" color="text.inverse"
              borderRadius="full" pl={4} pr={3} py={3} zIndex={50}
              boxShadow="0 18px 50px rgba(0,0,0, 0.4)" border="1px solid" borderColor="whiteAlpha.200"
            >
              <HStack spacing={3} flex={1}>
                <Flex px={2} py={1} borderRadius="md" bg="brand.500" fontWeight={800} fontSize="sm" color="white" boxShadow="0 2px 8px rgba(67, 110, 111, 0.4)">
                  {selectedMsgIds.size}
                </Flex>
                <Text fontSize="sm" color="whiteAlpha.800">messages selected</Text>
              </HStack>
              <HStack spacing={2}>
                <Button
                  size="sm" borderRadius="full" px={4} colorScheme="red"
                  isDisabled={trashJob.running}
                  onClick={() => setConfirmTrashMsgs(true)}
                >
                  Move to Trash
                </Button>
                <Button size="sm" borderRadius="full" px={4} variant="ghost" color="whiteAlpha.800" _hover={{ color: 'white', bg: 'whiteAlpha.300' }} onClick={() => setSelectedMsgIds(new Set())}>
                  Clear
                </Button>
              </HStack>
            </Flex>
          )}
          </Box>
        </GridItem>
      </Grid>

      {confirmEmptyTrash && (
        <ConfirmDialog
          title="Empty Trash?"
          message="This will permanently delete ALL messages currently in the Trash. This action cannot be undone."
          danger
          onCancel={() => setConfirmEmptyTrash(false)}
          onConfirm={executeEmptyTrash}
        />
      )}

      {confirmLabelAction && (
        <ConfirmDialog
          title={
            confirmLabelAction.mode === 'labelOnly'
              ? `Remove label "${confirmLabelAction.label.name}"?`
              : `Delete "${confirmLabelAction.label.name}" and trash its emails?`
          }
          message={
            confirmLabelAction.mode === 'labelOnly'
              ? `The label will be removed from Gmail. Its ${confirmLabelAction.label.messagesTotal} emails stay in your mailbox.`
              : `This moves ${confirmLabelAction.label.messagesTotal} emails to Trash (recoverable for 30 days, then Gmail deletes them permanently) and removes the label.`
          }
          requireTypedCount={confirmLabelAction.mode === 'trashEmails' && confirmLabelAction.label.messagesTotal > 500 ? confirmLabelAction.label.messagesTotal : undefined}
          danger={confirmLabelAction.mode === 'trashEmails'}
          onCancel={() => setConfirmLabelAction(null)}
          onConfirm={executeLabelAction}
        />
      )}

      {confirmTrashMsgs && (
        <ConfirmDialog
          title={`Move ${selectedMsgIds.size.toLocaleString()} messages to Trash?`}
          message="These messages will move to Gmail Trash (recoverable for 30 days, then permanently deleted by Gmail)."
          danger
          requireTypedCount={selectedMsgIds.size > 50 ? selectedMsgIds.size : undefined}
          onCancel={() => setConfirmTrashMsgs(false)}
          onConfirm={executeTrashMessages}
        />
      )}
    </Flex>
  )
}
