import { useState, useEffect, type ReactNode } from 'react'
import {
  Button, Select, HStack, Flex, Card, CardBody, Text, IconButton, Tooltip, Spacer
} from '@chakra-ui/react'
import { SearchIcon, RepeatIcon } from '@chakra-ui/icons'
import type { ScanResult } from '../types'

const RANGES = [
  { value: '1m',  label: 'Last month' },
  { value: '3m',  label: 'Last 3 months' },
  { value: '6m',  label: 'Last 6 months' },
  { value: '1y',  label: 'Last year' },
  { value: 'all', label: 'All time' },
]

export default function ScanControls({
  onScan, onCancel, running, scan, leftSlot, rightSlot,
}: {
  onScan: (range: string) => void
  onCancel?: () => void
  running: boolean
  scan: ScanResult | null
  leftSlot?: ReactNode
  rightSlot?: ReactNode
}) {
  const [range, setRange] = useState(scan?.range || RANGES[2].value)

  // Revert back to the last successful scan range if a scan is cancelled or completes
  useEffect(() => {
    if (!running && scan?.range) {
      setRange(scan.range)
    }
  }, [running, scan?.range])

  // After a scan completes, controls collapse to a slim inline row — the big
  // card is the primary CTA only until there's data to show. leftSlot/rightSlot
  // let the parent share this line (nav toggle on the left, view controls right).
  if (scan && !running) {
    return (
      <Flex align="center" gap={3} mb={3} wrap="wrap">
        {leftSlot}
        <Select
          w="150px"
          size="sm"
          value={range}
          onChange={(e) => { setRange(e.target.value); onScan(e.target.value) }}
          bg="bg.input"
          borderColor="border.subtle"
        >
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </Select>
        <Tooltip label="Re-scan mailbox" hasArrow>
          <IconButton
            aria-label="Re-scan mailbox"
            icon={<RepeatIcon />}
            size="sm"
            variant="outline"
            colorScheme="brand"
            onClick={() => onScan(range)}
          />
        </Tooltip>
        <Text fontSize="xs" color="text.secondary" ml={1}>
          <Text as="span" fontWeight={700} color="text.primary">{scan.senders.length.toLocaleString()}</Text> senders ·{' '}
          <Text as="span" fontWeight={700} color="text.primary">{scan.messageCount.toLocaleString()}</Text> emails ·{' '}
          scanned {new Date(scan.scannedAt).toLocaleString()}
        </Text>
        {rightSlot && <Spacer />}
        {rightSlot}
      </Flex>
    )
  }

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
        </Flex>
      </CardBody>
    </Card>
  )
}
