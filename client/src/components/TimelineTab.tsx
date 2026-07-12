import { useState, useEffect } from 'react'
import {
  Box, Flex, VStack, HStack, Text, Icon, Badge, SimpleGrid,
  Spinner, Heading
} from '@chakra-ui/react'
import { CalendarClock, ShieldCheck, MailX, History, Scan } from 'lucide-react'

interface TimelineEvent {
  time: string
  title: string
  description: string
  type: 'scan' | 'unsub' | 'trash' | 'protect'
  details: string
}

export default function TimelineTab() {
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<TimelineEvent[]>([])

  useEffect(() => {
    // Generate realistic activity timeline events
    setTimeout(() => {
      setEvents([
        {
          time: '10 mins ago',
          title: 'Mailbox Scan Completed',
          description: 'Analyzed 824 messages across 3 months.',
          type: 'scan',
          details: 'Discovered 14 new promotional senders, potential saving: 450 MB.'
        },
        {
          time: '2 hours ago',
          title: 'Auto-Protection Rule Triggered',
          description: 'Secured banking and service invoices.',
          type: 'protect',
          details: 'Added accounts@chase.com and billing@vercel.com to Protected List.'
        },
        {
          time: 'Yesterday',
          title: 'Batch Unsubscribe Executed',
          description: 'Safely opted-out from marketing lists.',
          type: 'unsub',
          details: 'Successfully sent unsubscribe emails to 12 newsletter senders.'
        },
        {
          time: '3 days ago',
          title: 'Storage Space Reclaimed',
          description: 'Moved heavy promo attachments to Trash.',
          type: 'trash',
          details: 'Cleaned up 8 old messages (> 10MB) saving 142 MB.'
        },
        {
          time: 'Last week',
          title: 'Weekly Digest Sent',
          description: 'Delivered summary of new marketing senders.',
          type: 'unsub',
          details: 'Sent HTML digest to primary account email.'
        }
      ])
      setLoading(false)
    }, 600)
  }, [])

  const getIcon = (type: string) => {
    switch (type) {
      case 'scan': return <Icon as={Scan} color="blue.500" boxSize={4} />
      case 'unsub': return <Icon as={MailX} color="red.500" boxSize={4} />
      case 'trash': return <Icon as={History} color="orange.500" boxSize={4} />
      case 'protect': return <Icon as={ShieldCheck} color="green.500" boxSize={4} />
      default: return <Icon as={CalendarClock} color="brand.500" boxSize={4} />
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'scan': return 'blue'
      case 'unsub': return 'red'
      case 'trash': return 'orange'
      case 'protect': return 'green'
      default: return 'gray'
    }
  };

  if (loading) {
    return (
      <Flex justify="center" align="center" h="400px">
        <Spinner color="brand.500" size="lg" />
      </Flex>
    )
  }

  return (
    <Box flex={1} overflowY="auto" pr={1}>
      <Box mb={6}>
        <Heading size="md" fontWeight={700} color="text.primary" letterSpacing="-0.02em" mb={1}>
          Relationship Timeline
        </Heading>
        <Text fontSize="sm" color="text.secondary">
          Track interactions, automatic rules, and history of your mailbox cleaning operations.
        </Text>
      </Box>

      <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6} mb={8}>
        {/* Metric 1 */}
        <Box p={5} borderRadius="card" bg="bg.card" border="1px solid" borderColor="border.subtle" boxShadow="e1">
          <Text fontSize="12px" fontWeight={600} color="text.secondary" textTransform="uppercase">
            Active Scan Recency
          </Text>
          <Text fontSize="24px" fontWeight={700} color="text.primary" mt={2} mb={1}>
            10 mins ago
          </Text>
          <Text fontSize="12px" color="brand.500" fontWeight={600}>
            Healthy Sync Schedule
          </Text>
        </Box>

        {/* Metric 2 */}
        <Box p={5} borderRadius="card" bg="bg.card" border="1px solid" borderColor="border.subtle" boxShadow="e1">
          <Text fontSize="12px" fontWeight={600} color="text.secondary" textTransform="uppercase">
            Interaction Score
          </Text>
          <Text fontSize="24px" fontWeight={700} color="text.primary" mt={2} mb={1}>
            92% Positive
          </Text>
          <Text fontSize="12px" color="text.secondary" fontWeight={500}>
            Low noise-to-signal ratio
          </Text>
        </Box>

        {/* Metric 3 */}
        <Box p={5} borderRadius="card" bg="bg.card" border="1px solid" borderColor="border.subtle" boxShadow="e1">
          <Text fontSize="12px" fontWeight={600} color="text.secondary" textTransform="uppercase">
            Whitelisted Senders
          </Text>
          <Text fontSize="24px" fontWeight={700} color="text.primary" mt={2} mb={1}>
            42 Contacts
          </Text>
          <Text fontSize="12px" color="green.500" fontWeight={600}>
            Auto-secured from batch trashing
          </Text>
        </Box>
      </SimpleGrid>

      {/* Vertical Timeline Feed */}
      <Box p={6} borderRadius="card" bg="bg.card" border="1px solid" borderColor="border.subtle" boxShadow="e1">
        <Text fontSize="15px" fontWeight={700} color="text.primary" mb={6}>
          Interaction History
        </Text>

        <VStack spacing={0} align="stretch" position="relative" pl={4}>
          {/* Vertical line indicator */}
          <Box
            position="absolute"
            left="27px"
            top="12px"
            bottom="32px"
            w="2px"
            bg="border.subtle"
            zIndex={0}
          />

          {events.map((event, idx) => (
            <Flex key={idx} mb={idx === events.length - 1 ? 0 : 8} position="relative" zIndex={1}>
              {/* Timeline marker bubble */}
              <Flex
                w="28px"
                h="28px"
                borderRadius="full"
                bg="bg.card"
                border="2px solid"
                borderColor="border.subtle"
                align="center"
                justify="center"
                mr={4}
                boxShadow="sm"
                flexShrink={0}
              >
                {getIcon(event.type)}
              </Flex>

              <Box flex={1} pt={0.5}>
                <Flex justify="space-between" align="baseline" wrap="wrap" mb={1}>
                  <HStack spacing={2.5}>
                    <Text fontSize="14px" fontWeight={700} color="text.primary">
                      {event.title}
                    </Text>
                    <Badge size="sm" colorScheme={getBadgeColor(event.type)} borderRadius="full" px={2} py={0.1}>
                      {event.type}
                    </Badge>
                  </HStack>
                  <Text fontSize="12px" color="text.secondary" fontWeight={500}>
                    {event.time}
                  </Text>
                </Flex>

                <Text fontSize="13px" color="text.secondary" mb={2}>
                  {event.description}
                </Text>

                <Box
                  p={3}
                  bg="bg.muted"
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="border.subtle"
                >
                  <Text fontSize="11px" color="text.secondary" fontWeight={500}>
                    {event.details}
                  </Text>
                </Box>
              </Box>
            </Flex>
          ))}
        </VStack>
      </Box>
    </Box>
  )
}
