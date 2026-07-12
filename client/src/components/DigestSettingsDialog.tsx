import { useCallback, useEffect, useState } from 'react'
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, Alert, AlertIcon, Box, Switch, FormControl, FormLabel,
  Select, Input, HStack, Tag, Spinner, Text, Flex, Grid, VStack, Icon, Badge
} from '@chakra-ui/react'
import { Mail } from 'lucide-react'
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
    <Modal isOpen={open} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(8px)" />
      <ModalContent
        borderRadius="card"
        bg="bg.card"
        border="1px solid"
        borderColor="border.subtle"
        boxShadow="2xl"
      >
        <ModalHeader borderBottom="1px solid" borderColor="border.subtle" pb={4}>
          <HStack spacing={2.5}>
            <Icon as={Mail} boxSize={5} color="brand.500" />
            <Text fontSize="18px" fontWeight={700} color="text.primary">
              Weekly Mailbox Digest
            </Text>
          </HStack>
        </ModalHeader>

        <ModalBody p={6}>
          {error && <Alert status="error" mb={4} borderRadius="md"><AlertIcon />{error}</Alert>}
          {notice && <Alert status="success" mb={4} borderRadius="md"><AlertIcon />{notice}</Alert>}

          {!state ? (
            <Flex justify="center" py={12}>
              <Spinner color="brand.500" size="lg" />
            </Flex>
          ) : (
            <Grid templateColumns={{ base: '1fr', md: '1.1fr 1.3fr' }} gap={8}>
              {/* Left Column: Settings & Schedule */}
              <Box>
                <Text fontSize="14px" fontWeight={600} color="text.primary" mb={3}>
                  Schedule &amp; Delivery
                </Text>
                <Text fontSize="13px" color="text.secondary" mb={5}>
                  Get a weekly summary email listing new marketing senders that started emailing you, each with a safe one-click unsubscribe link.
                </Text>

                <FormControl display="flex" alignItems="center" mb={5}>
                  <Switch
                    id="enable-digest"
                    colorScheme="brand"
                    isChecked={state.settings.enabled}
                    onChange={(e) => patch({ enabled: e.target.checked })}
                  />
                  <FormLabel htmlFor="enable-digest" mb={0} ml={3} fontWeight={600} fontSize="14px">
                    Enable weekly digest
                  </FormLabel>
                </FormControl>

                <HStack spacing={4} mb={5}>
                  <FormControl>
                    <FormLabel fontSize="12px" color="text.secondary">Day of week</FormLabel>
                    <Select
                      size="sm"
                      borderRadius="md"
                      value={state.settings.dayOfWeek}
                      onChange={(e) => patch({ dayOfWeek: Number(e.target.value) })}
                      isDisabled={!state.settings.enabled}
                    >
                      {DAYS.map((name, idx) => (
                        <option key={idx} value={idx}>{name}</option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="12px" color="text.secondary">Hour (UTC)</FormLabel>
                    <Select
                      size="sm"
                      borderRadius="md"
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

                <FormControl mb={5}>
                  <FormLabel fontSize="12px" color="text.secondary">Recipient (blank = your account)</FormLabel>
                  <Input
                    size="sm"
                    borderRadius="md"
                    placeholder={accountEmail}
                    value={state.settings.recipient}
                    onChange={(e) => patch({ recipient: e.target.value })}
                  />
                </FormControl>

                <HStack spacing={3} mb={5}>
                  <Button size="sm" colorScheme="brand" onClick={save} isLoading={saving}>
                    Save settings
                  </Button>
                  <Button size="sm" variant="outline" onClick={runPreview} isDisabled={running}>
                    {running ? 'Working…' : 'Preview'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={sendNow} isDisabled={running}>
                    Send now
                  </Button>
                  {running && <Spinner size="sm" color="brand.500" />}
                </HStack>

                <Box p={3.5} borderRadius="lg" bg="bg.app" border="1px solid" borderColor="border.subtle">
                  <Text fontSize="12px" color="text.secondary">
                    Last run: <Text as="span" fontWeight={600} color="text.primary">{fmtDate(state.lastRunAt)}</Text> · baseline tracks {state.knownSenderCount.toLocaleString()} senders
                  </Text>
                </Box>
              </Box>

              {/* Right Column: Live Email Preview Card (Screen 5) */}
              <Box>
                <Text fontSize="14px" fontWeight={600} color="text.primary" mb={3}>
                  Live Email Preview
                </Text>
                {preview && (
                  <Alert status={preview.seeding ? 'info' : 'success'} borderRadius="md" mb={3} fontSize="12px">
                    <AlertIcon />
                    {preview.seeding
                      ? `Baseline seeded from ${preview.totalScanned.toLocaleString()} messages.`
                      : `${preview.newSenders.length} new sender(s) found in preview.`}
                  </Alert>
                )}
                <Box
                  p={5}
                  borderRadius="xl"
                  bg="bg.app"
                  border="1px solid"
                  borderColor="border.subtle"
                  boxShadow="sm"
                >
                  <Flex justify="space-between" align="center" pb={3} mb={3} borderBottom="1px solid" borderColor="border.subtle">
                    <HStack spacing={2}>
                      <Icon as={Mail} boxSize={4} color="brand.500" />
                      <Text fontSize="13px" fontWeight={700} color="text.primary">
                        EmailDiet Weekly Digest
                      </Text>
                    </HStack>
                    <Badge colorScheme="green" fontSize="10px">PREVIEW</Badge>
                  </Flex>

                  <Text fontSize="13px" color="text.secondary" mb={4}>
                    Here&apos;s what entered your inbox this week. One-click unsubscribe from senders you no longer need:
                  </Text>

                  <VStack spacing={2.5} align="stretch" mb={4}>
                    {[
                      { name: 'Fashion Store Weekly', count: '4 emails', category: 'Shopping' },
                      { name: 'Tech Gadgets Daily', count: '7 emails', category: 'Promotions' },
                      { name: 'Weekend Escape Deals', count: '2 emails', category: 'Travel' },
                    ].map((item, idx) => (
                      <Flex
                        key={idx}
                        justify="space-between"
                        align="center"
                        p={3}
                        borderRadius="lg"
                        bg="bg.card"
                        border="1px solid"
                        borderColor="border.subtle"
                      >
                        <Box>
                          <Text fontSize="13px" fontWeight={600} color="text.primary">
                            {item.name}
                          </Text>
                          <HStack spacing={2} mt={0.5}>
                            <Text fontSize="11px" color="text.secondary">{item.count}</Text>
                            <Tag size="sm" colorScheme="gray" fontSize="10px">{item.category}</Tag>
                          </HStack>
                        </Box>
                        <Button size="xs" colorScheme="red" variant="outline" borderRadius="full">
                          Unsubscribe
                        </Button>
                      </Flex>
                    ))}
                  </VStack>

                  <Text fontSize="11px" color="text.tertiary" textAlign="center">
                    Sent securely from EmailDiet · Powered by your Gmail metadata
                  </Text>
                </Box>
              </Box>
            </Grid>
          )}
        </ModalBody>
        <ModalFooter bg="bg.muted" borderTop="1px solid" borderColor="border.subtle" borderBottomRadius="card">
          <Button onClick={onClose} variant="ghost" size="sm">Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
