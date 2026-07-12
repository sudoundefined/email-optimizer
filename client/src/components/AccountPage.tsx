import { useState, useEffect } from 'react'
import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Heading,
  Avatar,
  Button,
  Badge,
  FormControl,
  FormLabel,
  Input,
  Select,
  useToast,
  Icon,
  Card,
  CardBody,
  SimpleGrid,
} from '@chakra-ui/react'
import {
  Settings,
  ShieldCheck,
  LogOut,
  Save,
} from 'lucide-react'

interface AccountPageProps {
  userEmail?: string
  onLogout: () => void
}

interface UserPreferences {
  scanMaxMessages?: number
  defaultTimeRange?: string
  labelPrefix?: string
}

export default function AccountPage({ userEmail, onLogout }: AccountPageProps) {
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

  return (
    <Flex direction="column" h="100%" minH={0} pr={1} overflowY="auto">
      {/* Page Header */}
      <Box mb={6}>
        <Heading size="lg" color="text.primary" fontWeight={700} letterSpacing="-0.01em">
          Account & Preferences
        </Heading>
        <Text fontSize="13px" color="text.secondary" mt={0.5}>
          Manage your connected Gmail account, scanning defaults, and security settings
        </Text>
      </Box>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} alignItems="flex-start">
        <VStack spacing={6} align="stretch">
          {/* Profile Overview Card */}
          <Card
            borderRadius="card"
            bg="bg.card"
            border="1px solid"
            borderColor="border.subtle"
            boxShadow="e1"
          >
            <CardBody p={6}>
              <HStack spacing={4} align="center">
                <Avatar size="lg" name={userEmail || 'User'} bg="brand.500" color="white" />
                <Box flex={1} minW={0}>
                  <Text fontSize="18px" fontWeight={700} color="text.primary" isTruncated>
                    {userEmail || 'Connected Gmail Account'}
                  </Text>
                  <HStack spacing={2} mt={1.5}>
                    <Badge colorScheme="green" variant="subtle" borderRadius="full" px={2.5} py={0.5} fontSize="11px">
                      Connected
                    </Badge>
                    <Badge bg="bg.muted" color="text.secondary" borderRadius="full" px={2.5} py={0.5} fontSize="11px">
                      OAuth 2.0
                    </Badge>
                  </HStack>
                </Box>
              </HStack>
            </CardBody>
          </Card>

          {/* Security & Session Card */}
          <Card
            borderRadius="card"
            bg="bg.card"
            border="1px solid"
            borderColor="border.subtle"
            boxShadow="e1"
          >
            <CardBody p={6}>
              <HStack spacing={2.5} mb={3}>
                <Icon as={ShieldCheck} boxSize={5} color="brand.500" />
                <Text fontSize="16px" fontWeight={700} color="text.primary">
                  Security & Token Privacy
                </Text>
              </HStack>
              <Text fontSize="13px" color="text.secondary" lineHeight="tall" mb={5}>
                Your OAuth tokens are encrypted at rest using AES-256-GCM. EmailDiet scans only message headers and metadata (`From`, `Subject`, `List-Unsubscribe`) and never stores private email bodies.
              </Text>
              <Button
                size="sm"
                colorScheme="red"
                variant="outline"
                leftIcon={<Icon as={LogOut} boxSize={4} />}
                onClick={onLogout}
              >
                Sign out & Disconnect Session
              </Button>
            </CardBody>
          </Card>
        </VStack>

        {/* Preferences Card */}
        <Card
          borderRadius="card"
          bg="bg.card"
          border="1px solid"
          borderColor="border.subtle"
          boxShadow="e1"
        >
          <CardBody p={6}>
            <HStack spacing={2.5} mb={4}>
              <Icon as={Settings} boxSize={5} color="brand.500" />
              <Text fontSize="16px" fontWeight={700} color="text.primary">
                Scanning & Labeling Defaults
              </Text>
            </HStack>

            <VStack spacing={5} align="stretch">
              <FormControl>
                <FormLabel fontSize="13px" fontWeight={600} color="text.primary" mb={1}>
                  Default Scan Time Range
                </FormLabel>
                <Select
                  size="sm"
                  borderRadius="md"
                  borderColor="border.subtle"
                  bg="bg.app"
                  value={preferences.defaultTimeRange}
                  onChange={(e) =>
                    setPreferences({ ...preferences, defaultTimeRange: e.target.value })
                  }
                >
                  <option value="1m">Last 1 month</option>
                  <option value="3m">Last 3 months</option>
                  <option value="6m">Last 6 months</option>
                  <option value="1y">Last 1 year</option>
                  <option value="all">All time</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel fontSize="13px" fontWeight={600} color="text.primary" mb={1}>
                  Max Messages per Scan
                </FormLabel>
                <Input
                  size="sm"
                  type="number"
                  borderRadius="md"
                  borderColor="border.subtle"
                  bg="bg.app"
                  value={preferences.scanMaxMessages}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      scanMaxMessages: parseInt(e.target.value, 10) || 1000,
                    })
                  }
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="13px" fontWeight={600} color="text.primary" mb={1}>
                  App Label Prefix
                </FormLabel>
                <Input
                  size="sm"
                  borderRadius="md"
                  borderColor="border.subtle"
                  bg="bg.app"
                  value={preferences.labelPrefix}
                  onChange={(e) =>
                    setPreferences({ ...preferences, labelPrefix: e.target.value })
                  }
                />
              </FormControl>

              <Box pt={2}>
                <Button
                  size="sm"
                  colorScheme="brand"
                  leftIcon={<Icon as={Save} boxSize={4} />}
                  onClick={handleSavePreferences}
                  isLoading={savingPrefs}
                >
                  Save Preferences
                </Button>
              </Box>
            </VStack>
          </CardBody>
        </Card>
      </SimpleGrid>
    </Flex>
  )
}
