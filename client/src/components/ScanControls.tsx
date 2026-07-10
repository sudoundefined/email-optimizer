import { useState, useEffect } from 'react'
import {
  Button, Select, HStack, Flex, Card, CardBody, Text
} from '@chakra-ui/react'
import { SearchIcon } from '@chakra-ui/icons'
import type { ScanResult } from '../types'

const RANGES = [
  { value: '1m',  label: 'Last month' },
  { value: '3m',  label: 'Last 3 months' },
  { value: '6m',  label: 'Last 6 months' },
  { value: '1y',  label: 'Last year' },
  { value: 'all', label: 'All time' },
]

export default function ScanControls({
  onScan, onCancel, running, scan,
}: {
  onScan: (range: string) => void
  onCancel?: () => void
  running: boolean
  scan: ScanResult | null
}) {
  const [range, setRange] = useState(scan?.range || RANGES[2].value)

  // Revert back to the last successful scan range if a scan is cancelled or completes
  useEffect(() => {
    if (!running && scan?.range) {
      setRange(scan.range)
    }
  }, [running, scan?.range])

  return (
    <Card mb={6} bg="brand.100" overflow="visible" boxShadow="none" border="none">
      <CardBody p={{ base: 4, sm: 6 }}>
        <Flex align="center" gap={4} wrap="wrap">
          <HStack spacing={4} flex={1}>
            <Select
              w="180px"
              size="md"
              value={range}
              onChange={(e) => {
                const newRange = e.target.value;
                setRange(newRange);
                onScan(newRange);
              }}
              isDisabled={running}
              bg="white"
              borderColor="brand.300"
              _hover={{ borderColor: 'brand.400' }}
            >
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>

            <Button
              colorScheme="blue"
              leftIcon={<SearchIcon />}
              onClick={() => onScan(range)}
              isDisabled={running}
              px={6}
            >
              {running ? 'Scanning…' : 'Scan mailbox'}
            </Button>

            {running && onCancel && (
              <Button
                variant="outline"
                colorScheme="red"
                onClick={onCancel}
                px={6}
              >
                Cancel
              </Button>
            )}
          </HStack>

          {!running && scan && (
            <HStack spacing={4} ml="auto" wrap="wrap" align="center">
              <HStack bg="blue.500" borderRadius="xl" px={3} py={2} spacing={2}>
                <Text color="white" fontWeight={700} fontSize="md" lineHeight={1}>
                  {scan.senders.length.toLocaleString()}
                </Text>
                <Text color="blue.100" fontSize="xs" fontWeight={600} lineHeight={1}>
                  senders
                </Text>
              </HStack>
              <HStack bg="blue.500" borderRadius="xl" px={3} py={2} spacing={2}>
                <Text color="white" fontWeight={700} fontSize="md" lineHeight={1}>
                  {scan.messageCount.toLocaleString()}
                </Text>
                <Text color="blue.100" fontSize="xs" fontWeight={600} lineHeight={1}>
                  emails scanned
                </Text>
              </HStack>
              
              <Text fontSize="xs" color="brand.700" alignSelf="center">
                scanned {new Date(scan.scannedAt).toLocaleString()}
              </Text>
            </HStack>
          )}
        </Flex>
      </CardBody>
    </Card>
  )
}
