import { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Flex,
  Text,
  Heading,
  HStack,
  VStack,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Button,
  Badge,
  Card,
  CardBody,
  SimpleGrid,
  Icon,
  Tooltip,
} from '@chakra-ui/react'
import {
  Search,
  RefreshCw,
  Activity,
  ShieldCheck,
  Trash2,
  Tags,
  LogIn,
  LogOut,
  MailCheck,
  SlidersHorizontal,
} from 'lucide-react'
import EmailLoader from './EmailLoader'
import StatCard from '../ui/StatCard'

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

function getActivityIcon(action: string) {
  switch (action.toLowerCase()) {
    case 'login':
      return LogIn
    case 'logout':
      return LogOut
    case 'scan':
      return Activity
    case 'unsubscribe':
      return MailCheck
    case 'trash':
      return Trash2
    case 'label':
      return Tags
    default:
      return ShieldCheck
  }
}

function getActivityBadgeScheme(action: string): { colorScheme: string; variant: string } {
  switch (action.toLowerCase()) {
    case 'login':
      return { colorScheme: 'green', variant: 'subtle' }
    case 'scan':
      return { colorScheme: 'blue', variant: 'subtle' }
    case 'unsubscribe':
      return { colorScheme: 'purple', variant: 'subtle' }
    case 'trash':
      return { colorScheme: 'red', variant: 'subtle' }
    case 'label':
      return { colorScheme: 'teal', variant: 'subtle' }
    default:
      return { colorScheme: 'gray', variant: 'subtle' }
  }
}

export default function LogsPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const fetchActivities = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/user/activity?limit=100', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setActivities(data.items || [])
      }
    } catch {
      // ignore errors quietly
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActivities()
  }, [])

  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      if (filterAction !== 'all' && act.action.toLowerCase() !== filterAction) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const inAction = act.action.toLowerCase().includes(q)
      const inDetails = act.details ? JSON.stringify(act.details).toLowerCase().includes(q) : false
      return inAction || inDetails
    })
  }, [activities, filterAction, searchQuery])

  const statsCount = useMemo(() => {
    const total = activities.length
    const scans = activities.filter(a => a.action.toLowerCase() === 'scan').length
    const unsubs = activities.filter(a => a.action.toLowerCase() === 'unsubscribe').length
    return { total, scans, unsubs }
  }, [activities])

  return (
    <Flex direction="column" h="100%" minH={0} pr={1}>
      {/* Page Header */}
      <Flex justify="space-between" align="center" mb={6} wrap="wrap" gap={4} flexShrink={0}>
        <Box>
          <Heading size="lg" color="text.primary" fontWeight={700} letterSpacing="-0.01em">
            Activity Audit Log
          </Heading>
          <Text fontSize="13px" color="text.secondary" mt={0.5}>
            Immutable audit trail of all mailbox scans, automated cleanups, and account events
          </Text>
        </Box>
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Icon as={RefreshCw} boxSize={3.5} />}
          onClick={fetchActivities}
          isLoading={loading}
          borderColor="border.subtle"
          color="text.secondary"
          _hover={{ bg: 'bg.hover', color: 'text.primary' }}
        >
          Refresh Logs
        </Button>
      </Flex>

      {/* Hero Summary Cards */}
      <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={4} mb={6} flexShrink={0}>
        <StatCard
          label="Total logged events"
          value={statsCount.total}
          accent="text.primary"
          icon={<Icon as={Activity} boxSize={4} />}
        />
        <StatCard
          label="Mailbox scans"
          value={statsCount.scans}
          accent="brand.500"
        />
        <StatCard
          label="Unsubscribes executed"
          value={statsCount.unsubs}
          accent="highlight.500"
        />
      </SimpleGrid>

      {/* Filter Toolbar */}
      <Card
        borderRadius="card"
        bg="bg.card"
        border="1px solid"
        borderColor="border.subtle"
        boxShadow="e1"
        mb={5}
        flexShrink={0}
      >
        <CardBody p={4}>
          <Flex direction={{ base: 'column', sm: 'row' }} gap={3} align="center" justify="space-between">
            <InputGroup size="sm" maxW={{ base: '100%', sm: '320px' }}>
              <InputLeftElement pointerEvents="none">
                <Icon as={Search} boxSize={3.5} color="text.tertiary" />
              </InputLeftElement>
              <Input
                placeholder="Search action or details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                borderRadius="md"
                borderColor="border.subtle"
                bg="bg.app"
              />
            </InputGroup>

            <HStack spacing={3} w={{ base: '100%', sm: 'auto' }}>
              <HStack spacing={1.5} color="text.tertiary" fontSize="13px">
                <Icon as={SlidersHorizontal} boxSize={3.5} />
                <Text>Filter:</Text>
              </HStack>
              <Select
                size="sm"
                w="160px"
                borderRadius="md"
                borderColor="border.subtle"
                bg="bg.app"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
              >
                <option value="all">All Actions</option>
                <option value="scan">Mailbox Scans</option>
                <option value="unsubscribe">Unsubscribes</option>
                <option value="trash">Trash Events</option>
                <option value="label">Labeling</option>
                <option value="login">Logins</option>
              </Select>
            </HStack>
          </Flex>
        </CardBody>
      </Card>

      {/* Activities List */}
      <Card
        borderRadius="card"
        bg="bg.card"
        border="1px solid"
        borderColor="border.subtle"
        boxShadow="e1"
        flex={1}
        minH={0}
        display="flex"
        flexDirection="column"
        overflow="hidden"
      >
        <Box flex={1} minH={0} overflowY="auto">
          {loading ? (
            <Flex align="center" justify="center" py={16}>
              <EmailLoader size="md" message="Loading audit trail..." />
          </Flex>
        ) : filteredActivities.length === 0 ? (
          <Flex align="center" justify="center" direction="column" py={14}>
            <Icon as={Activity} boxSize={8} color="text.tertiary" mb={3} />
            <Text fontSize="14px" fontWeight={600} color="text.secondary">
              No audit log entries found
            </Text>
            <Text fontSize="12px" color="text.tertiary" mt={1}>
              {searchQuery || filterAction !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Account actions and cleanup events will appear here automatically.'}
            </Text>
          </Flex>
        ) : (
          <VStack spacing={0} align="stretch" divider={<Box borderBottom="1px solid" borderColor="border.subtle" />}>
            {filteredActivities.map((act) => {
              const dt = act.createdAt || act.created_at || ''
              const dObj = dt ? new Date(dt) : new Date()
              const IconComponent = getActivityIcon(act.action)
              const badgeStyle = getActivityBadgeScheme(act.action)

              return (
                <Flex
                  key={act.id}
                  p={4}
                  align="flex-start"
                  justify="space-between"
                  _hover={{ bg: 'bg.hover' }}
                  transition="background 0.15s"
                  gap={4}
                >
                  <HStack spacing={3.5} align="flex-start" flex={1} minW={0}>
                    <Flex
                      w="36px"
                      h="36px"
                      borderRadius="lg"
                      bg="bg.muted"
                      align="center"
                      justify="center"
                      flexShrink={0}
                      color="text.primary"
                    >
                      <Icon as={IconComponent} boxSize={4} />
                    </Flex>
                    <Box flex={1} minW={0}>
                      <HStack spacing={2.5} mb={1}>
                        <Badge
                          colorScheme={badgeStyle.colorScheme}
                          variant={badgeStyle.variant}
                          borderRadius="full"
                          px={2.5}
                          py={0.5}
                          fontSize="11px"
                          fontWeight={600}
                        >
                          {act.action.toUpperCase()}
                        </Badge>
                      </HStack>
                      {act.details && Object.keys(act.details).length > 0 && (
                        <Box
                          mt={1.5}
                          p={2.5}
                          borderRadius="md"
                          bg="bg.app"
                          border="1px solid"
                          borderColor="border.subtle"
                          fontSize="12px"
                          fontFamily="mono"
                          color="text.secondary"
                          overflowX="auto"
                        >
                          {JSON.stringify(act.details, null, 2)}
                        </Box>
                      )}
                    </Box>
                  </HStack>

                  <Tooltip label={formatAbsoluteTime(dt)} placement="left">
                    <Text fontSize="12px" color="text.tertiary" flexShrink={0} cursor="default">
                      {formatRelativeTime(dObj)}
                    </Text>
                  </Tooltip>
                </Flex>
              )
            })}
          </VStack>
        )}
        </Box>
      </Card>
    </Flex>
  )
}
