import { useMemo, useState } from 'react'
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, Checkbox, Select, Text, Box, Flex, Alert, AlertIcon, Progress
} from '@chakra-ui/react'
import { api, ApiError } from '../api'
import type { Sender, Suggestion } from '../types'
import { CATEGORIES } from '../types'
import { useJob } from '../hooks/useJob'

export default function LabelReview({
  senders,
  suggestions,
  onClose,
  onDisconnected,
}: {
  senders: Sender[]
  suggestions: Map<string, Suggestion>
  onClose: () => void
  onDisconnected: () => void
}) {
  const [assignments, setAssignments] = useState<Map<string, string>>(
    () => new Map(senders.map((s) => [s.email, suggestions.get(s.email)?.category || 'Other']))
  )
  const [error, setError] = useState<string | null>(null)
  const [doneMessage, setDoneMessage] = useState<string | null>(null)
  const [archive, setArchive] = useState(false)
  const applyJob = useJob()

  const byCategory = useMemo(() => {
    const groups = new Map<string, Sender[]>()
    for (const s of senders) {
      const cat = assignments.get(s.email) || 'Other'
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(s)
    }
    return groups
  }, [senders, assignments])

  const setCategory = (email: string, category: string) => {
    setAssignments((prev) => new Map(prev).set(email, category))
  }

  const apply = async () => {
    setError(null)
    try {
      const payload = [...assignments].map(([senderEmail, labelName]) => ({ senderEmail, labelName }))
      const snapshot = await applyJob.start(() => api.applyLabels(payload, { topLevel: true, archive }))
      if (snapshot.state === 'error') setError(snapshot.error || 'Applying labels failed')
      else {
        const result = snapshot.result as { applied: { label: string; messages: number }[]; archived?: boolean }
        setDoneMessage(
          `${result.applied.map((a) => `${a.label}: ${a.messages} emails`).join(' · ')}` +
            (result.archived ? ' — moved out of the inbox (recoverable in All Mail).' : ' — tagged in place, still in your inbox.')
        )
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else setError(err instanceof Error ? err.message : String(err))
    }
  }

  const progress = applyJob.job?.progress as
    | { labeled?: number; total?: number; currentLabel?: string }
    | null

  return (
    <Modal isOpen onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Review labels</ModalHeader>
        <ModalBody>
          <Text fontSize="sm" color="gray.600" mb={4}>
            Each category becomes a Gmail label applied to every scanned email from the sender.
            By default this <Text as="strong">tags in place</Text> — nothing leaves your inbox. Review the
            grouping below, then create the labels.
          </Text>

          {[...byCategory.entries()].map(([category, group]) => (
            <Box key={category} mb={4}>
              <Text fontWeight="bold" fontSize="sm" mb={2}>
                {category}{' '}
                <Text as="span" fontWeight="normal" color="gray.500">
                  ({group.length} senders)
                </Text>
              </Text>
              {group.map((s) => (
                <Flex key={s.email} align="center" gap={3} py={1}>
                  <Text fontSize="sm" fontWeight={600} flex={1} isTruncated>
                    {s.name || s.email}
                  </Text>
                  <Text fontSize="xs" color="gray.500" whiteSpace="nowrap">
                    {s.messageCount} emails
                  </Text>
                  <Select
                    size="sm"
                    w="120px"
                    value={assignments.get(s.email)}
                    onChange={(e) => setCategory(s.email, e.target.value)}
                    isDisabled={applyJob.running}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </Flex>
              ))}
            </Box>
          ))}

          {error && (
            <Alert status="error" mt={3} borderRadius="md">
              <AlertIcon />
              {error}
            </Alert>
          )}
          {applyJob.running && progress && (
            <Box mt={3}>
              <Text fontSize="xs" color="gray.500">
                Labeling {progress.labeled ?? 0} / {progress.total ?? '?'}
                {progress.currentLabel ? ` (${progress.currentLabel})` : ''}
              </Text>
              <Progress size="sm" isIndeterminate={!progress.total} value={progress.total && progress.labeled ? (progress.labeled / progress.total) * 100 : undefined} colorScheme="blue" mt={1} borderRadius="md" />
            </Box>
          )}
          {doneMessage && (
            <Alert status="success" mt={3} borderRadius="md">
              <AlertIcon />
              Labels applied — {doneMessage}
            </Alert>
          )}
        </ModalBody>
        <ModalFooter justifyContent="space-between" bg="gray.50" borderBottomRadius="md">
          {!doneMessage ? (
            <Checkbox
              size="sm"
              isChecked={archive}
              onChange={(e) => setArchive(e.target.checked)}
              isDisabled={applyJob.running}
              colorScheme="blue"
            >
              Also archive tagged emails (move out of inbox)
            </Checkbox>
          ) : <Box />}
          <Flex gap={2}>
            <Button onClick={onClose} isDisabled={applyJob.running} variant="ghost">
              {doneMessage ? 'Close' : 'Cancel'}
            </Button>
            {!doneMessage && (
              <Button colorScheme="blue" onClick={apply} isLoading={applyJob.running}>
                {applyJob.running ? 'Applying…' : archive ? 'Create labels, tag & archive' : 'Create labels & tag'}
              </Button>
            )}
          </Flex>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
