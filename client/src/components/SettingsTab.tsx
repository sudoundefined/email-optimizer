import { useState, useEffect } from 'react'
import {
  Box, VStack, HStack, Text, Heading, Button, Badge,
  FormControl, FormLabel, Input, Select, useToast, Icon, SimpleGrid
} from '@chakra-ui/react'
import { ShieldCheck, LogOut, Save, Settings, AlertTriangle } from 'lucide-react'

interface UserPreferences {
  scanMaxMessages?: number
  defaultTimeRange?: string
  labelPrefix?: string
}

export default function SettingsTab({
  userEmail,
  onLogout
}: {
  userEmail?: string
  onLogout: () => void
}) {
  const toast = useToast()
  const [preferences, setPreferences] = useState<UserPreferences>({
    defaultTimeRange: '3m',
    scanMaxMessages: 5000,
    labelPrefix: 'Unsub/',
  })
  const [savingPrefs, setSavingPrefs] = useState(false)

  useEffect(() => {
    fetchPreferences()
  }, [])

  const fetchPreferences = async () => {
    try {
      const res = await fetch('/api/user/preferences', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setPreferences({
          defaultTimeRange: data.defaultTimeRange || '3m',
          scanMaxMessages: data.scanMaxMessages ?? 5000,
          labelPrefix: data.labelPrefix || 'Unsub/',
        })
      }
    } catch {
      // ignore
    }
  }

  const handleSavePreferences = async () => {
    setSavingPrefs(true)
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      })
      if (res.ok) {
        toast({
          title: 'Preferences saved successfully',
          status: 'success',
          duration: 2500,
          isClosable: true,
        })
      }
    } catch {
      toast({
        title: 'Failed to save preferences',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setSavingPrefs(false)
    }
  }

  const handleDisconnect = async () => {
    if (confirm('Are you sure you want to disconnect your Google account and delete all data? This cannot be undone.')) {
      try {
        await fetch('/api/user/delete', { method: 'DELETE', credentials: 'include' })
        onLogout()
      } catch {
        toast({ title: 'Failed to disconnect account', status: 'error' })
      }
    }
  }

  return (
    <Box flex={1} overflowY="auto" pr={1}>
      {/* Header */}
      <Box mb={6}>
        <Heading size="md" fontWeight={700} color="text.primary" letterSpacing="-0.02em" mb={1}>
          System Settings
        </Heading>
        <Text fontSize="sm" color="text.secondary">
          Configure scanning thresholds, custom labels, and account connections.
        </Text>
      </Box>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
        {/* Card 1: Preferences */}
        <Box p={6} borderRadius="card" bg="bg.card" border="1px solid" borderColor="border.subtle" boxShadow="e1">
          <HStack spacing={2} mb={4}>
            <Icon as={Settings} color="brand.500" boxSize={4.5} />
            <Text fontSize="15px" fontWeight={700} color="text.primary">Scanning preferences</Text>
          </HStack>

          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel fontSize="12px" color="text.secondary">Default Scan Range</FormLabel>
              <Select
                size="sm"
                borderRadius="md"
                value={preferences.defaultTimeRange}
                onChange={(e) => setPreferences({ ...preferences, defaultTimeRange: e.target.value })}
              >
                <option value="1m">Last 1 Month</option>
                <option value="3m">Last 3 Months</option>
                <option value="6m">Last 6 Months</option>
                <option value="1y">Last 1 Year</option>
                <option value="all">All-time Mailbox</option>
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel fontSize="12px" color="text.secondary">Scanning limit (Max messages per scan)</FormLabel>
              <Select
                size="sm"
                borderRadius="md"
                value={preferences.scanMaxMessages}
                onChange={(e) => setPreferences({ ...preferences, scanMaxMessages: Number(e.target.value) })}
              >
                <option value={1000}>1,000 messages</option>
                <option value={3000}>3,000 messages</option>
                <option value={5000}>5,000 messages</option>
                <option value={10000}>10,000 messages</option>
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel fontSize="12px" color="text.secondary">Cleanup Label Prefix</FormLabel>
              <Input
                size="sm"
                borderRadius="md"
                value={preferences.labelPrefix}
                onChange={(e) => setPreferences({ ...preferences, labelPrefix: e.target.value })}
                placeholder="Unsub/"
              />
            </FormControl>

            <Button
              size="sm"
              colorScheme="brand"
              leftIcon={<Icon as={Save} boxSize={4} />}
              onClick={handleSavePreferences}
              isLoading={savingPrefs}
              mt={2}
            >
              Save preferences
            </Button>
          </VStack>
        </Box>

        {/* Card 2: Security & Danger Zone */}
        <VStack spacing={6} align="stretch">
          <Box p={6} borderRadius="card" bg="bg.card" border="1px solid" borderColor="border.subtle" boxShadow="e1">
            <HStack spacing={2} mb={3}>
              <Icon as={ShieldCheck} color="green.500" boxSize={4.5} />
              <Text fontSize="15px" fontWeight={700} color="text.primary">Connected Google Account</Text>
            </HStack>

            <VStack align="start" spacing={3} mt={1}>
              <Box>
                <Text fontSize="13px" fontWeight={600} color="text.primary">
                  {userEmail || 'OAuth Session Active'}
                </Text>
                <Text fontSize="11px" color="text.secondary" mt={0.5}>
                  Permissions: Gmail Metadata Scanner &amp; Label Modifier.
                </Text>
              </Box>
              <Badge colorScheme="green" borderRadius="full" px={2.5} py={0.5} fontSize="10px">
                AES-256-GCM Encrypted Token
              </Badge>
            </VStack>
          </Box>

          <Box p={6} borderRadius="card" bg="bg.card" border="1px solid" borderColor="red.200" boxShadow="e1">
            <HStack spacing={2} mb={3}>
              <Icon as={AlertTriangle} color="red.500" boxSize={4.5} />
              <Text fontSize="15px" fontWeight={700} color="red.500">Danger Zone</Text>
            </HStack>
            <Text fontSize="12px" color="text.secondary" mb={4}>
              Once you disconnect, your OAuth tokens and all whitelists/preferences are permanently deleted from our system.
            </Text>
            <HStack spacing={3}>
              <Button
                size="sm"
                colorScheme="red"
                variant="outline"
                leftIcon={<Icon as={LogOut} boxSize={4} />}
                onClick={handleDisconnect}
              >
                Disconnect Gmail
              </Button>
              <Button size="sm" variant="ghost" onClick={onLogout}>
                Logout Session
              </Button>
            </HStack>
          </Box>
        </VStack>
      </SimpleGrid>
    </Box>
  )
}
