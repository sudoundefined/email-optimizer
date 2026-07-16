import { Box, Text, List, ListItem, ListIcon, Button, Link } from '@chakra-ui/react'
import { CheckCircleIcon, WarningIcon, NotAllowedIcon } from '@chakra-ui/icons'
import type { UnsubResult, UnsubSummary } from '../types'

const STATUS_ICONS = {
  success: { icon: CheckCircleIcon, color: 'green.500' },
  manual: { icon: WarningIcon, color: 'orange.500' },
  failed: { icon: NotAllowedIcon, color: 'red.500' },
} as const

function ResultRow({ r }: { r: UnsubResult }) {
  const status = STATUS_ICONS[r.status]
  return (
    <ListItem py={2} borderBottom="1px" borderColor="border.subtle" display="flex" alignItems="center">
      <ListIcon as={status.icon} color={status.color} />
      <Box flex="1" ml={2}>
        <Text fontSize="sm" fontWeight={600}>{r.sender}</Text>
        <Text fontSize="xs" color="text.secondary">{r.detail}</Text>
      </Box>
      {r.manualUrl && /^https?:\/\//i.test(r.manualUrl) && (
        <Link href={r.manualUrl} isExternal>
          <Button size="sm" variant="outline">
            Open
          </Button>
        </Link>
      )}
    </ListItem>
  )
}

export default function UnsubscribePanel({
  summary,
  progress,
  running,
}: {
  summary?: UnsubSummary
  progress?: { done: number; total: number; results: UnsubResult[] }
  running?: boolean
}) {
  const results = summary?.results ?? progress?.results ?? []
  return (
    <Box borderWidth="1px" borderRadius="md" p={4} my={4} bg="bg.card">
      {running && progress && (
        <Text fontSize="sm" fontWeight="bold" mb={2}>
          Unsubscribing… {progress.done} / {progress.total}
        </Text>
      )}
      {summary && (
        <Text fontSize="sm" fontWeight="bold" mb={2}>
          Done: {summary.success} unsubscribed, {summary.manual} need a manual click,{' '}
          {summary.failed} failed
        </Text>
      )}
      <List maxH="320px" overflowY="auto" spacing={0}>
        {results.map((r) => (
          <ResultRow key={r.sender} r={r} />
        ))}
      </List>
    </Box>
  )
}
