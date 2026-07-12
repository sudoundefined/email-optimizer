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
  Divider,
  FormControl,
  FormLabel,
  Input,
  Select,
  Spinner,
  useToast,
  Icon,
  SimpleGrid,
  InputGroup,
  InputLeftElement,
  Tag,
} from '@chakra-ui/react'
import {
  CheckCircleIcon,
  TimeIcon,
  SearchIcon,
  RepeatIcon,
} from '@chakra-ui/icons'

interface AccountPageProps {
  userEmail?: string
  onLogout: () => void
}

interface UserPreferences {
  scanMaxMessages?: number
  defaultTimeRange?: string
  labelPrefix?: string
}

interface ActivityItem {
  id: number
  action: string
  details: Record<string, unknown> | null
  createdAt: string
  created_at?: string
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (isNaN(diffSec)) return ''
  if (diffSec < 60) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hr ago`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} days ago`
  return date.toLocaleDateString()
}

function formatAbsoluteTime(dateStr: string): string {
  if (!dateStr) return 'Unknown date'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getActionColor(action: string): string {
  switch (action.toLowerCase()) {
    case 'login':
      return 'green'
    case 'logout':
      return 'gray'
    case 'scan':
      return 'blue'
    case 'unsubscribe':
      return 'purple'
    case 'trash':
      return 'red'
    case 'label':
      return 'teal'
    default:
      return 'cyan'
  }
}

export default function AccountPage({ userEmail, onLogout }: AccountPageProps) {
  const toast = useToast()
  const [preferences, setPreferences] = useState<UserPreferences>({
    defaultTimeRange: '3m',
    scanMaxMessages: 5000,
    labelPrefix: 'Unsub/',
  })
  const [savingPrefs, setSavingPrefs] = useState(false)

  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loadingActivities, setLoadingActivities] = useState(true)
  const [filterAction, setFilterAction] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  useEffect(() => {
    fetchPreferences()
    fetchActivities()
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

  const fetchActivities = async () => {
    setLoadingActivities(true)
    try {
      const res = await fetch('/api/user/activity?limit=50', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setActivities(data.items || [])
      }
    } catch {
      // ignore
    } finally {
      setLoadingActivities(false)
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

  const filteredActivities = activities.filter((act) => {
    if (filterAction !== 'all' && act.action.toLowerCase() !== filterAction) return false
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    const matchAction = act.action.toLowerCase().includes(q)
    const matchDetails = act.details ? JSON.stringify(act.details).toLowerCase().includes(q) : false
    return matchAction || matchDetails
  })

  return (
    <Box
      overflowY="auto"
      flex={1}
      maxH="full"
      pr={2}
      sx={{
        '&::-webkit-scrollbar': { width: '8px' },
        '&::-webkit-scrollbar-thumb': { bg: 'border.subtle', borderRadius: 'full' },
      }}
    >
      <VStack spacing={8} align="stretch" pb={12}>
        {/* Top Identity & Google Connection Card */}
      <Box
        p={6}
        bg="bg.card"
        borderRadius="2xl"
        border="1px solid"
        borderColor="border.subtle"
        boxShadow="sm"
      >
        <Flex
          direction={{ base: 'column', md: 'row' }}
          justify="space-between"
          align={{ base: 'start', md: 'center' }}
          gap={4}
        >
          <HStack spacing={4}>
            <Avatar size="lg" name={userEmail || 'User'} bg="brand.500" color="white" />
            <VStack align="start" spacing={1}>
              <Heading size="md" color="text.primary">
                {userEmail}
              </Heading>
              <HStack spacing={2}>
                <Badge colorScheme="green" display="flex" alignItems="center" gap={1} px={2} py={0.5} borderRadius="full">
                  <Icon as={CheckCircleIcon} boxSize={3} /> Connected to Google
                </Badge>
                <Badge colorScheme="blue" variant="subtle" px={2} py={0.5} borderRadius="full">
                  AES-256-GCM Secured
                </Badge>
              </HStack>
            </VStack>
          </HStack>

          <Button
            colorScheme="red"
            variant="outline"
            size="sm"
            onClick={onLogout}
          >
            Sign out & revoke access
          </Button>
        </Flex>
      </Box>

      {/* Account Preferences Section */}
      <Box
        p={6}
        bg="bg.card"
        borderRadius="2xl"
        border="1px solid"
        borderColor="border.subtle"
        boxShadow="sm"
      >
        <Heading size="sm" color="text.primary" mb={4}>
          Scan & Inbox Preferences
        </Heading>
        <Text fontSize="xs" color="text.secondary" mb={6}>
          Configure default scanning parameters applied across your mailbox cleanup tools.
        </Text>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
          <FormControl>
            <FormLabel fontSize="xs" fontWeight="bold" color="text.secondary">
              DEFAULT SCAN TIME RANGE
            </FormLabel>
            <Select
              value={preferences.defaultTimeRange || '3m'}
              onChange={(e) =>
                setPreferences({ ...preferences, defaultTimeRange: e.target.value })
              }
            >
              <option value="1m">Last 1 month</option>
              <option value="3m">Last 3 months</option>
              <option value="6m">Last 6 months</option>
              <option value="1y">Last 1 year</option>
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel fontSize="xs" fontWeight="bold" color="text.secondary">
              MAX MESSAGES CAP
            </FormLabel>
            <Input
              type="number"
              placeholder="5000"
              value={preferences.scanMaxMessages ?? ''}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  scanMaxMessages: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </FormControl>

          <FormControl>
            <FormLabel fontSize="xs" fontWeight="bold" color="text.secondary">
              GMAIL LABEL PREFIX
            </FormLabel>
            <Input
              placeholder="Unsub/"
              value={preferences.labelPrefix || 'Unsub/'}
              onChange={(e) =>
                setPreferences({ ...preferences, labelPrefix: e.target.value })
              }
            />
          </FormControl>
        </SimpleGrid>

        <Flex justify="flex-end" mt={6}>
          <Button
            colorScheme="brand"
            onClick={handleSavePreferences}
            isLoading={savingPrefs}
            px={6}
          >
            Save Preferences
          </Button>
        </Flex>
      </Box>

      {/* Activity Audit Log Section */}
      <Box
        p={6}
        bg="bg.card"
        borderRadius="2xl"
        border="1px solid"
        borderColor="border.subtle"
        boxShadow="sm"
      >
        <Flex
          direction={{ base: 'column', md: 'row' }}
          justify="space-between"
          align={{ base: 'start', md: 'center' }}
          gap={4}
          mb={6}
        >
          <VStack align="start" spacing={1}>
            <Heading size="sm" color="text.primary">
              Activity & Audit Log
            </Heading>
            <Text fontSize="xs" color="text.secondary">
              A transparent history of operations performed on your mailbox.
            </Text>
          </VStack>

          <HStack spacing={3} w={{ base: 'full', md: 'auto' }}>
            <InputGroup size="sm" maxW="220px">
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.400" />
              </InputLeftElement>
              <Input
                placeholder="Search log details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                borderRadius="full"
              />
            </InputGroup>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<RepeatIcon />}
              onClick={fetchActivities}
              isLoading={loadingActivities}
            >
              Refresh
            </Button>
          </HStack>
        </Flex>

        {/* Action Filter Pills */}
        <HStack spacing={2} overflowX="auto" pb={4} mb={2}>
          {['all', 'login', 'scan', 'unsubscribe', 'trash', 'label'].map((act) => {
            const isSelected = filterAction === act
            return (
              <Button
                key={act}
                size="xs"
                variant={isSelected ? 'solid' : 'ghost'}
                colorScheme={isSelected ? 'brand' : 'gray'}
                borderRadius="full"
                px={3}
                textTransform="capitalize"
                onClick={() => setFilterAction(act)}
              >
                {act}
              </Button>
            )
          })}
        </HStack>

        <Divider mb={4} />

        {/* Log List */}
        {loadingActivities ? (
          <Flex justify="center" py={12}>
            <Spinner color="brand.500" size="lg" />
          </Flex>
        ) : filteredActivities.length === 0 ? (
          <Text color="text.secondary" fontSize="sm" textAlign="center" py={12}>
            No matching activity records found.
          </Text>
        ) : (
          <VStack
            spacing={3}
            align="stretch"
            maxH="480px"
            overflowY="auto"
            pr={2}
            sx={{
              '&::-webkit-scrollbar': { width: '6px' },
              '&::-webkit-scrollbar-thumb': { bg: 'border.subtle', borderRadius: 'full' },
            }}
          >
            {filteredActivities.map((act) => {
              const dateStr = act.createdAt || act.created_at || ''
              const absTime = formatAbsoluteTime(dateStr)
              const relTime = dateStr ? formatRelativeTime(new Date(dateStr)) : ''
              const detailsObj = act.details || {}
              const entries = Object.entries(detailsObj)

              return (
                <Box
                  key={act.id}
                  p={4}
                  borderRadius="xl"
                  border="1px solid"
                  borderColor="border.subtle"
                  bg="bg.input"
                  _hover={{ borderColor: 'brand.300' }}
                  transition="all 0.2s"
                >
                  <Flex
                    direction={{ base: 'column', sm: 'row' }}
                    justify="space-between"
                    align={{ base: 'start', sm: 'center' }}
                    gap={2}
                    mb={entries.length > 0 ? 2 : 0}
                  >
                    <HStack spacing={3}>
                      <Badge
                        colorScheme={getActionColor(act.action)}
                        px={2.5}
                        py={0.5}
                        borderRadius="md"
                        textTransform="uppercase"
                        fontWeight="bold"
                        fontSize="xs"
                      >
                        {act.action}
                      </Badge>
                    </HStack>

                    <HStack spacing={2} color="text.secondary" fontSize="xs">
                      <Icon as={TimeIcon} />
                      <Text fontWeight="medium" color="text.primary">
                        {absTime}
                      </Text>
                      {relTime && <Text color="text.secondary">({relTime})</Text>}
                    </HStack>
                  </Flex>

                  {entries.length > 0 && (
                    <Flex wrap="wrap" gap={2} mt={2}>
                      {entries.map(([key, val]) => (
                        <Tag
                          key={key}
                          size="sm"
                          variant="subtle"
                          colorScheme="gray"
                          borderRadius="md"
                        >
                          <Text fontWeight="bold" mr={1}>
                            {key}:
                          </Text>
                          <Text>{typeof val === 'object' ? JSON.stringify(val) : String(val)}</Text>
                        </Tag>
                      ))}
                    </Flex>
                  )}
                </Box>
              )
            })}
          </VStack>
        )}
      </Box>
    </VStack>
    </Box>
  )
}
