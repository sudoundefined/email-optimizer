import { useCallback, useEffect, useState } from 'react'
import {
  Alert, AlertIcon, Box, Button, Tag, Table, Thead, Tbody, Tr, Th, Td,
  TableContainer, Text, Flex, Icon, HStack, Select, IconButton
} from '@chakra-ui/react'
import { WarningTwoIcon, UpDownIcon, ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons'
import { ShieldCheck } from 'lucide-react'
import { api, ApiError } from '../api'
import type { ProtectedSender } from '../types'

export default function ProtectedTab({ onDisconnected }: { onDisconnected: () => void }) {
  const [list, setList] = useState<ProtectedSender[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)

  const paginate = list ? list.length > rowsPerPage : false
  const pageCount = list ? Math.ceil(list.length / rowsPerPage) : 0
  const safePage = Math.min(page, Math.max(0, pageCount - 1))
  const start = safePage * rowsPerPage
  const pageRows = paginate && list ? list.slice(start, start + rowsPerPage) : (list ?? [])

  const load = useCallback(async () => {
    try {
      const res = await api.protectedList()
      setList(res.protected)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    }
  }, [onDisconnected])

  useEffect(() => { load() }, [load])

  const handleUnprotect = async (email: string) => {
    try {
      await api.unprotectSenders([email])
      await load()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (list === null && !error) {
    return <Text fontSize="sm" color="text.secondary">Loading protected senders…</Text>
  }

  return (
    <Box>
      {error && (
        <Alert status="error" mb={4} borderRadius="md">
          <AlertIcon />
          {error}
        </Alert>
      )}
      {list && list.length === 0 && (
        <Flex direction="column" align="center" textAlign="center" py={10} color="text.secondary">
          <Icon as={WarningTwoIcon} boxSize={12} opacity={0.5} mb={4} />
          <Text fontSize="xl" fontWeight={600} color="text.primary" mb={2}>
            No protected senders yet
          </Text>
          <Text fontSize="sm" maxW="420px">
            Protect senders to exclude them from bulk unsubscribe and trash actions.
            Senders matching banks, utilities, and government agencies are auto-protected after each scan.
          </Text>
        </Flex>
      )}
      {list && list.length > 0 && (
        <TableContainer border="1px" borderColor="border.subtle" borderRadius="md" bg="bg.card">
          <Table size="sm">
            <Thead position="sticky" top={0} bg="bg.muted" zIndex={1} boxShadow="0 2px 4px rgba(0,0,0,0.02)">
              <Tr>
                <Th borderBottom="1px solid" borderColor="border.subtle" color="text.secondary" fontSize="sm" fontWeight="600" textTransform="none" letterSpacing="normal" py={4}>
                  <Flex align="center" gap={2}>Email <UpDownIcon boxSize={3} color="text.tertiary" /></Flex>
                </Th>
                <Th borderBottom="1px solid" borderColor="border.subtle" color="text.secondary" fontSize="sm" fontWeight="600" textTransform="none" letterSpacing="normal" py={4}>
                  <Flex align="center" gap={2}>Reason <UpDownIcon boxSize={3} color="text.tertiary" /></Flex>
                </Th>
                <Th borderBottom="1px solid" borderColor="border.subtle" color="text.secondary" fontSize="sm" fontWeight="600" textTransform="none" letterSpacing="normal" py={4}>
                  <Flex align="center" gap={2}>Added <UpDownIcon boxSize={3} color="text.tertiary" /></Flex>
                </Th>
                <Th borderBottom="1px solid" borderColor="border.subtle" py={4}></Th>
              </Tr>
            </Thead>
            <Tbody>
              {pageRows.map((p) => (
                <Tr
                  key={p.email}
                  _hover={{ bg: 'bg.hover' }}
                  borderBottom="1px solid"
                  borderColor="border.subtle"
                >
                  <Td px={4}>
                    <HStack spacing={2.5}>
                      <Icon as={ShieldCheck} boxSize={4} color="brand.500" />
                      <Text fontSize="sm" fontWeight={500}>{p.email}</Text>
                    </HStack>
                  </Td>
                  <Td px={4}>
                    {p.reason.startsWith('auto:') ? (
                      <Tag size="sm" borderRadius="full" px={3} bg="blue.50" color="blue.600" fontWeight={700}>Auto</Tag>
                    ) : (
                      <Tag size="sm" borderRadius="full" px={3} bg="bg.muted" color="text.secondary" fontWeight={700}>Manual</Tag>
                    )}
                  </Td>
                  <Td px={4}>
                    <Text fontSize="xs" color="text.secondary" fontWeight={600}>
                      {new Date(p.addedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </Td>
                  <Td textAlign="right" px={4}>
                    <Button size="sm" variant="ghost" onClick={() => handleUnprotect(p.email)} colorScheme="red">
                      Unprotect
                    </Button>
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
                  {start + 1}-{Math.min(start + rowsPerPage, list?.length || 0)} of {list?.length || 0}
                </Text>
                <HStack spacing={1}>
                  <IconButton aria-label="Previous" icon={<ChevronLeftIcon />} size="sm" variant="ghost" isDisabled={safePage === 0} onClick={() => setPage(p => p - 1)} />
                  <IconButton aria-label="Next" icon={<ChevronRightIcon />} size="sm" variant="ghost" isDisabled={safePage >= pageCount - 1} onClick={() => setPage(p => p + 1)} />
                </HStack>
              </HStack>
            </Flex>
          )}
        </TableContainer>
      )}
    </Box>
  )
}
