import { useEffect, useState } from 'react'
import {
  Table, Thead, Tbody, Tr, Th, Td, TableContainer,
  Checkbox, Tag, Text, Box, Tooltip, Flex, IconButton, Select, HStack, Avatar
} from '@chakra-ui/react'
import { CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, UpDownIcon } from '@chakra-ui/icons'
import type { Sender, Suggestion, UnsubMethod } from '../types'

const METHOD_CHIPS: Record<UnsubMethod, { label: string; bg: string; plain?: boolean }> = {
  oneclick: { label: '⚡ One-click', bg: 'brand.400' },
  mailto:   { label: '✉ Email',     bg: 'blue.500' },
  link:     { label: '🔗 Link',      bg: 'gray.400' },
  none:     { label: 'None',         bg: '', plain: true },
}

export const CATEGORY_COLORS: Record<string, string> = {
  Work:          '#0A84FF',
  Banking:       '#34C759',
  Shopping:      '#FF9500',
  Travel:        '#00C7BE',
  Medical:       '#FF375F',
  Tax:           '#BF5AF2',
  Bills:         '#FF9F0A',
  Subscriptions: '#5856D6',
  Newsletters:   '#007AFF',
  Social:        '#FF2D55',
  Promotions:    '#AF52DE',
  Education:     '#FF9500',
  Entertainment: '#FF2D55',
  'Food & Dining': '#FF375F',
  'Real Estate': '#34C759',
  'Health & Fitness': '#00C7BE',
  Investing:     '#30B0C7',
  Personal:      '#30B0C7',
  Other:         '#AEAEB2',
}



export default function SenderTable({
  senders, selected, onSelectedChange, suggestions, protectedSet, onDrillDown
}: {
  senders: Sender[]
  selected: Set<string>
  onSelectedChange: (next: Set<string>) => void
  suggestions: Map<string, Suggestion>
  protectedSet: Set<string>
  onDrillDown?: (sender: Sender) => void
}) {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(100)

  useEffect(() => { setPage(0) }, [senders])

  const paginate = senders.length > rowsPerPage
  const pageCount = Math.max(1, Math.ceil(senders.length / rowsPerPage))
  const safePage = Math.min(page, pageCount - 1)
  const start = safePage * rowsPerPage
  const pageRows = paginate ? senders.slice(start, start + rowsPerPage) : senders

  const maxCount = senders.length > 0 ? Math.max(...senders.map((s) => s.messageCount)) : 1

  const allSelected = pageRows.length > 0 && pageRows.every((s) => selected.has(s.email))
  const someSelected = pageRows.some((s) => selected.has(s.email))

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selected)
      pageRows.forEach((s) => next.delete(s.email))
      onSelectedChange(next)
    } else {
      onSelectedChange(new Set([...selected, ...pageRows.map((s) => s.email)]))
    }
  }

  const toggle = (email: string) => {
    const next = new Set(selected)
    if (next.has(email)) next.delete(email)
    else next.add(email)
    onSelectedChange(next)
  }

  if (senders.length === 0) {
    return (
      <Box p={4} textAlign="center">
        <Text fontSize="sm" color="gray.500">
          No senders match this filter.
        </Text>
      </Box>
    )
  }

  return (
    <Flex flex={1} direction="column" minH={0}>
      <TableContainer flex={1} overflowY="auto">
        <Table size="sm" variant="simple" style={{ tableLayout: 'fixed' }}>
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
                  <Flex align="center" gap={2}>Volume <UpDownIcon boxSize={3} color="gray.400" /></Flex>
                </Th>
                <Th borderBottom="1px solid" borderColor="gray.200" color="gray.700" fontSize="sm" fontWeight="600" textTransform="none" letterSpacing="normal" py={4}>
                  <Flex align="center" gap={2}>Unsubscribe <UpDownIcon boxSize={3} color="gray.400" /></Flex>
                </Th>
                <Th borderBottom="1px solid" borderColor="gray.200" color="gray.700" fontSize="sm" fontWeight="600" textTransform="none" letterSpacing="normal" py={4}>
                  <Flex align="center" gap={2}>Category <UpDownIcon boxSize={3} color="gray.400" /></Flex>
                </Th>
                <Th borderBottom="1px solid" borderColor="gray.200" color="gray.700" fontSize="sm" fontWeight="600" textTransform="none" letterSpacing="normal" py={4}>
                  <Flex align="center" gap={2}>Latest subject <UpDownIcon boxSize={3} color="gray.400" /></Flex>
                </Th>
            </Tr>
          </Thead>
          <Tbody>
            {pageRows.map((s) => {
              const chip = METHOD_CHIPS[s.method]
              const suggestion = suggestions.get(s.email)
              const catColor = suggestion ? (CATEGORY_COLORS[suggestion.category] ?? '#AEAEB2') : undefined
              const isProtected = protectedSet.has(s.email.toLowerCase())
              return (
                <Tr
                  key={s.email}
                  bg="transparent"
                  _hover={{ bg: 'gray.50' }}
                  onClick={() => onDrillDown ? onDrillDown(s) : toggle(s.email)}
                  cursor="pointer"
                  borderBottom="1px solid"
                  borderColor="gray.100"
                  boxShadow={selected.has(s.email) ? 'inset 3px 0 0 0 var(--chakra-colors-brand-500)' : 'none'}
                >
                  <Td px={4} onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      isChecked={selected.has(s.email)}
                      onChange={() => toggle(s.email)}
                      colorScheme="brand"
                    />
                  </Td>
                  <Td py={4} maxW="280px">
                    <Flex align="center" gap={3}>
                      <Avatar size="sm" name={s.name || s.email} src="" bg="brand.100" color="brand.800" fontWeight="bold" />
                      <Box overflow="hidden">
                        <HStack spacing={2} align="center">
                          <Text fontSize="sm" fontWeight={700} color="text.primary" isTruncated>
                            {s.name || s.email}
                          </Text>
                          {isProtected && (
                            <Tooltip label="Protected — excluded from bulk unsubscribe and trash">
                              <CheckCircleIcon color="green.500" boxSize={3} flexShrink={0} />
                            </Tooltip>
                          )}
                        </HStack>
                        <Text fontSize="xs" color="neutral.500" isTruncated>
                          {s.email}
                        </Text>
                      </Box>
                    </Flex>
                  </Td>
                  <Td py={4}>
                    <Tooltip label={`${s.messageCount.toLocaleString()} emails`} placement="top">
                      <Flex align="center" gap={3}>
                        <Box w="80px" h="8px" bg="blackAlpha.100" borderRadius="full" overflow="hidden">
                          <Box h="100%" bg="brand.500" w={`${Math.max(2, (s.messageCount / maxCount) * 100)}%`} borderRadius="full" />
                        </Box>
                        <Text fontSize="xs" fontWeight="700" color="neutral.500">{s.messageCount}</Text>
                      </Flex>
                    </Tooltip>
                  </Td>
                  <Td py={4}>
                    {!chip.plain ? (
                      <Tag size="sm" bg={chip.bg} color="white" fontWeight={700} borderRadius="full" px={3}>
                        {chip.label}
                      </Tag>
                    ) : (
                      <Text fontSize="sm" color="neutral.500">None</Text>
                    )}
                  </Td>
                  <Td py={4}>
                    {suggestion && (
                      <Tag
                        size="sm"
                        borderRadius="full"
                        px={3}
                        bg={catColor ? `${catColor}20` : 'blackAlpha.50'}
                        color={catColor ?? 'neutral.600'}
                        fontWeight={700}
                        fontStyle={suggestion.confidence === 'low' ? 'italic' : 'normal'}
                        opacity={suggestion.confidence === 'low' ? 0.7 : 1}
                        title={suggestion.reason}
                        border="none"
                      >
                        {suggestion.category}
                      </Tag>
                    )}
                  </Td>
                  <Td py={4} maxW="280px">
                    <Text fontSize="sm" color="neutral.500" isTruncated>
                      {s.latestSubject}
                    </Text>
                  </Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      </TableContainer>
      {paginate && (
        <Flex
          align="center" justify="flex-end" px={4} py={2}
          borderTop="1px" borderColor="border.subtle" bg="bg.card"
        >
          <HStack spacing={4}>
            <HStack>
              <Text fontSize="sm" color="text.secondary">Rows per page:</Text>
              <Select
                size="sm"
                w="80px"
                value={rowsPerPage}
                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0) }}
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </Select>
            </HStack>
            <Text fontSize="sm" color="text.secondary">
              {start + 1}-{Math.min(start + rowsPerPage, senders.length)} of {senders.length}
            </Text>
            <HStack spacing={1}>
              <IconButton
                aria-label="Previous page"
                icon={<ChevronLeftIcon />}
                size="sm"
                variant="ghost"
                isDisabled={safePage === 0}
                onClick={() => setPage(p => p - 1)}
              />
              <IconButton
                aria-label="Next page"
                icon={<ChevronRightIcon />}
                size="sm"
                variant="ghost"
                isDisabled={safePage >= pageCount - 1}
                onClick={() => setPage(p => p + 1)}
              />
            </HStack>
          </HStack>
        </Flex>
      )}
    </Flex>
  )
}
