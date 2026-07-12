import { useCallback, useEffect, useState } from 'react'
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, Alert, AlertIcon, Box, Switch, FormControl, FormLabel,
  Select, Input, Divider, HStack, Tag, Spinner, Text, Flex
} from '@chakra-ui/react'
import { api, ApiError } from '../api'
import type { DigestState, DigestRunResult } from '../types'
import { useJob } from '../hooks/useJob'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function fmtDate(iso: string | null): string {
  if (!iso) return 'never'
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function DigestSettingsDialog({
  open,
  onClose,
  onDisconnected,
  accountEmail,
}: {
  open: boolean
  onClose: () => void
  onDisconnected: () => void
  accountEmail: string
}) {
  const [state, setState] = useState<DigestState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<DigestRunResult | null>(null)
  const job = useJob()

  const handleApiError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onDisconnected()
      else if (err instanceof ApiError && err.code === 'digest_already_running')
        setError('A digest run is already in progress. Please wait for it to finish.')
      else setError(err instanceof Error ? err.message : String(err))
    },
    [onDisconnected]
  )

  const load = useCallback(async () => {
    setError(null)
    try {
      setState(await api.digest())
    } catch (err) {
      handleApiError(err)
    }
  }, [handleApiError])

  useEffect(() => {
    if (open) {
      setNotice(null)
      setPreview(null)
      load()
    }
  }, [open, load])

  const patch = (p: Partial<DigestState['settings']>) =>
    setState((prev) => (prev ? { ...prev, settings: { ...prev.settings, ...p } } : prev))

  const save = async () => {
    if (!state) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const { settings } = await api.saveDigestSettings(state.settings)
      setState((prev) => (prev ? { ...prev, settings } : prev))
      setNotice('Settings saved.')
    } catch (err) {
      handleApiError(err)
    } finally {
      setSaving(false)
    }
  }

  const runPreview = async () => {
    setError(null)
    setNotice(null)
    setPreview(null)
    try {
      const snap = await job.start(() => api.previewDigest())
      if (snap.state === 'error') return setError(snap.error || 'Preview failed')
      setPreview(snap.result as DigestRunResult)
    } catch (err) {
      handleApiError(err)
    }
  }

  const sendNow = async () => {
    setError(null)
    setNotice(null)
    setPreview(null)
    try {
      const snap = await job.start(() => api.runDigest())
      if (snap.state === 'error') return setError(snap.error || 'Send failed')
      const r = snap.result as DigestRunResult
      setNotice(
        r.seeding
          ? 'First run complete — baseline seeded. Future digests will list only senders that appear from now on.'
          : r.sent
          ? `Digest sent to ${r.recipient} with ${r.newSenders.length} new sender${r.newSenders.length === 1 ? '' : 's'}.`
          : 'No new marketing senders since the last run — nothing to send.'
      )
      await load()
    } catch (err) {
      handleApiError(err)
    }
  }

  const running = job.running || Boolean(state?.running)

  return (
    <Modal isOpen={open} onClose={onClose} size="md" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Weekly digest</ModalHeader>
        <ModalBody>
          <Text fontSize="sm" color="text.secondary" mb={4}>
            Get a weekly email listing new marketing senders that started emailing you, each with an
            unsubscribe link. The digest is sent from your own Gmail to{' '}
            <Text as="strong">{state?.settings.recipient || accountEmail || 'your account'}</Text>.
          </Text>

          {error && <Alert status="error" mb={4} borderRadius="md"><AlertIcon />{error}</Alert>}
          {notice && <Alert status="success" mb={4} borderRadius="md"><AlertIcon />{notice}</Alert>}

          <Alert status="info" mb={4} borderRadius="md" alignItems="flex-start">
            <AlertIcon mt={1} />
            <Text fontSize="sm">
              Scheduled runs require the app to be running and a valid Google sign-in. In Testing-mode
              OAuth, sign-in expires about every 7 days — production verification removes that limit.
            </Text>
          </Alert>

          {!state ? (
            <Flex justify="center" py={6}>
              <Spinner color="blue.500" />
            </Flex>
          ) : (
            <>
              <FormControl display="flex" alignItems="center" mb={4}>
                <Switch
                  id="enable-digest"
                  colorScheme="brand"
                  isChecked={state.settings.enabled}
                  onChange={(e) => patch({ enabled: e.target.checked })}
                />
                <FormLabel htmlFor="enable-digest" mb={0} ml={3} fontWeight={500}>
                  Enable weekly digest
                </FormLabel>
              </FormControl>

              <HStack spacing={4} mb={4}>
                <FormControl w="140px">
                  <FormLabel fontSize="sm" color="text.secondary">Day</FormLabel>
                  <Select
                    size="sm"
                    value={state.settings.dayOfWeek}
                    onChange={(e) => patch({ dayOfWeek: Number(e.target.value) })}
                    isDisabled={!state.settings.enabled}
                  >
                    {DAYS.map((d, i) => (
                      <option key={i} value={i}>{d}</option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl w="110px">
                  <FormLabel fontSize="sm" color="text.secondary">Hour</FormLabel>
                  <Select
                    size="sm"
                    value={state.settings.hour}
                    onChange={(e) => patch({ hour: Number(e.target.value) })}
                    isDisabled={!state.settings.enabled}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                    ))}
                  </Select>
                </FormControl>
              </HStack>

              <FormControl mb={4}>
                <FormLabel fontSize="sm" color="text.secondary">Recipient (blank = your account)</FormLabel>
                <Input
                  size="sm"
                  placeholder={accountEmail}
                  value={state.settings.recipient}
                  onChange={(e) => patch({ recipient: e.target.value })}
                />
              </FormControl>

              <Button size="sm" colorScheme="brand" onClick={save} isLoading={saving} mb={4}>
                Save settings
              </Button>

              <Divider my={4} />

              <HStack spacing={3} mb={4}>
                <Button size="sm" variant="outline" onClick={runPreview} isDisabled={running}>
                  {running ? 'Working…' : 'Preview'}
                </Button>
                <Button size="sm" variant="outline" onClick={sendNow} isDisabled={running}>
                  Send now
                </Button>
                {running && <Spinner size="sm" color="blue.500" />}
              </HStack>

              {preview && (
                <Alert status={preview.seeding ? 'info' : 'success'} variant="subtle" flexDirection="column" alignItems="flex-start" borderRadius="md" mb={4}>
                  <Flex align="center" mb={2}>
                    <AlertIcon />
                    <Text fontSize="sm" fontWeight={600}>
                      {preview.seeding
                        ? `First run will seed a baseline from ${preview.totalScanned.toLocaleString()} scanned messages. No email is sent on the first run.`
                        : preview.newSenders.length === 0
                        ? 'No new marketing senders since the last run.'
                        : `${preview.newSenders.length} new sender${preview.newSenders.length === 1 ? '' : 's'} would be included:`}
                    </Text>
                  </Flex>
                  {!preview.seeding && preview.newSenders.length > 0 && (
                    <Flex wrap="wrap" gap={2} mt={2}>
                      {preview.newSenders.slice(0, 12).map((s) => (
                        <Tag key={s.email} size="sm" colorScheme="brand" variant="solid">
                          {s.name} ({s.messageCount})
                        </Tag>
                      ))}
                      {preview.newSenders.length > 12 && (
                        <Tag size="sm" variant="outline">
                          +{preview.newSenders.length - 12} more
                        </Tag>
                      )}
                    </Flex>
                  )}
                </Alert>
              )}

              <Box>
                <Text fontSize="xs" color="text.secondary" mb={1}>
                  Last run: {fmtDate(state.lastRunAt)} · baseline tracks {state.knownSenderCount.toLocaleString()} senders
                </Text>
                {state.history.length > 0 && (
                  <Box>
                    {state.history.slice(0, 5).map((h, i) => (
                      <Text key={i} fontSize="xs" color="text.secondary">
                        {fmtDate(h.at)} — {h.error ? `error: ${h.error}` : h.sent ? `sent (${h.newSenders} new)` : `${h.newSenders} new, not sent`}
                      </Text>
                    ))}
                  </Box>
                )}
              </Box>
            </>
          )}
        </ModalBody>
        <ModalFooter bg="bg.muted" borderBottomRadius="md">
          <Button onClick={onClose} variant="ghost">Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
