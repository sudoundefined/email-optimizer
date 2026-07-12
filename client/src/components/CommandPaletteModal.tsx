import React, { useState, useEffect } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Input,
  Box,
  Flex,
  Text,
  Icon,
  HStack,
  VStack,
  Kbd,
  Badge,
  Grid,
} from '@chakra-ui/react'
import {
  Search,
  Trash2,
  Paperclip,
  Tag,
  Sparkles,
  Clock,
  ArrowRight,
} from 'lucide-react'

export interface CommandPaletteModalProps {
  isOpen: boolean
  onClose: () => void
  onNavigateTab?: (tab: string) => void
  onSearchQuery?: (query: string) => void
}

const INITIAL_RECENT_SEARCHES = [
  'Amazon invoices',
  'Flipkart emails',
  'Travel bookings',
  'Invoices from this year',
  'ICICI Bank statements',
]

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onSearchQuery,
}) => {
  const [query, setQuery] = useState('')
  const [recentSearches, setRecentSearches] = useState<string[]>(INITIAL_RECENT_SEARCHES)

  useEffect(() => {
    if (!isOpen) setQuery('')
  }, [isOpen])

  const handleSelectQuery = (text: string) => {
    onSearchQuery?.(text)
    onClose()
  }

  const handleCommand = (action: string) => {
    if (action === 'storage') {
      onNavigateTab?.('storage')
    } else if (action === 'labels') {
      onNavigateTab?.('labels')
    } else if (action === 'mailbox') {
      onNavigateTab?.('mailbox')
    }
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(8px)" />
      <ModalContent
        borderRadius="card"
        bg="bg.card"
        border="1px solid"
        borderColor="border.subtle"
        boxShadow="2xl"
        overflow="hidden"
        my={{ base: 4, md: 16 }}
      >
        <Box borderBottom="1px solid" borderColor="border.subtle" p={3}>
          <InputGroup size="lg">
            <InputLeftElement pointerEvents="none">
              <Icon as={Search} boxSize={5} color="text.tertiary" />
            </InputLeftElement>
            <Input
              placeholder="Search or type a command..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              variant="unstyled"
              fontSize="16px"
              fontWeight={500}
              color="text.primary"
              autoFocus
            />
            <InputRightElement width="4.5rem">
              <HStack spacing={1}>
                <Kbd fontSize="11px">ESC</Kbd>
              </HStack>
            </InputRightElement>
          </InputGroup>
        </Box>

        <ModalBody p={0}>
          <Grid templateColumns={{ base: '1fr', md: '1fr 1.3fr' }}>
            {/* Left Column: Recent Searches */}
            <Box
              p={4}
              borderRight={{ base: 'none', md: '1px solid' }}
              borderBottom={{ base: '1px solid', md: 'none' }}
              borderColor="border.subtle"
              bg="bg.app"
            >
              <Flex justify="space-between" align="center" mb={3}>
                <Text fontSize="11px" fontWeight={700} color="text.tertiary" textTransform="uppercase" letterSpacing="0.05em">
                  Recent Searches
                </Text>
                {recentSearches.length > 0 && (
                  <Text
                    fontSize="11px"
                    color="text.tertiary"
                    cursor="pointer"
                    _hover={{ color: 'text.primary' }}
                    onClick={() => setRecentSearches([])}
                  >
                    Clear recent
                  </Text>
                )}
              </Flex>

              {recentSearches.length === 0 ? (
                <Text fontSize="12px" color="text.tertiary" py={3}>
                  No recent searches
                </Text>
              ) : (
                <VStack spacing={1} align="stretch">
                  {recentSearches
                    .filter((s) => s.toLowerCase().includes(query.toLowerCase()))
                    .map((item, idx) => (
                      <Flex
                        key={idx}
                        align="center"
                        justify="space-between"
                        p={2.5}
                        borderRadius="md"
                        cursor="pointer"
                        _hover={{ bg: 'bg.hover' }}
                        onClick={() => handleSelectQuery(item)}
                      >
                        <HStack spacing={2.5}>
                          <Icon as={Clock} boxSize={3.5} color="text.tertiary" />
                          <Text fontSize="13px" color="text.primary" fontWeight={500}>
                            {item}
                          </Text>
                        </HStack>
                        <Icon as={ArrowRight} boxSize={3.5} color="text.tertiary" />
                      </Flex>
                    ))}
                </VStack>
              )}
            </Box>

            {/* Right Column: Commands */}
            <Box p={4}>
              <Text fontSize="11px" fontWeight={700} color="text.tertiary" textTransform="uppercase" letterSpacing="0.05em" mb={3}>
                Commands
              </Text>

              <VStack spacing={2} align="stretch">
                <Flex
                  align="center"
                  justify="space-between"
                  p={3}
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="border.subtle"
                  cursor="pointer"
                  _hover={{ bg: 'bg.hover', borderColor: 'brand.500' }}
                  onClick={() => handleCommand('storage')}
                >
                  <HStack spacing={3}>
                    <Flex w="32px" h="32px" borderRadius="md" bg="danger.50" align="center" justify="center" color="danger.500">
                      <Icon as={Trash2} boxSize={4} />
                    </Flex>
                    <Box>
                      <Text fontSize="13px" fontWeight={600} color="text.primary">
                        Delete old emails
                      </Text>
                      <Text fontSize="11px" color="text.secondary">
                        Remove emails older than a specific time
                      </Text>
                    </Box>
                  </HStack>
                  <Badge colorScheme="red" variant="subtle" fontSize="10px">
                    STORAGE
                  </Badge>
                </Flex>

                <Flex
                  align="center"
                  justify="space-between"
                  p={3}
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="border.subtle"
                  cursor="pointer"
                  _hover={{ bg: 'bg.hover', borderColor: 'brand.500' }}
                  onClick={() => handleCommand('storage')}
                >
                  <HStack spacing={3}>
                    <Flex w="32px" h="32px" borderRadius="md" bg="blue.50" align="center" justify="center" color="blue.500">
                      <Icon as={Paperclip} boxSize={4} />
                    </Flex>
                    <Box>
                      <Text fontSize="13px" fontWeight={600} color="text.primary">
                        Find large attachments
                      </Text>
                      <Text fontSize="11px" color="text.secondary">
                        Locate emails with attachments &gt; 5MB
                      </Text>
                    </Box>
                  </HStack>
                  <Badge colorScheme="blue" variant="subtle" fontSize="10px">
                    ATTACHMENTS
                  </Badge>
                </Flex>

                <Flex
                  align="center"
                  justify="space-between"
                  p={3}
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="border.subtle"
                  cursor="pointer"
                  _hover={{ bg: 'bg.hover', borderColor: 'brand.500' }}
                  onClick={() => handleCommand('labels')}
                >
                  <HStack spacing={3}>
                    <Flex w="32px" h="32px" borderRadius="md" bg="purple.50" align="center" justify="center" color="purple.500">
                      <Icon as={Tag} boxSize={4} />
                    </Flex>
                    <Box>
                      <Text fontSize="13px" fontWeight={600} color="text.primary">
                        Move to label
                      </Text>
                      <Text fontSize="11px" color="text.secondary">
                        Move emails to a specific label
                      </Text>
                    </Box>
                  </HStack>
                  <Badge colorScheme="purple" variant="subtle" fontSize="10px">
                    LABELS
                  </Badge>
                </Flex>

                <Flex
                  align="center"
                  justify="space-between"
                  p={3}
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="border.subtle"
                  cursor="pointer"
                  _hover={{ bg: 'bg.hover', borderColor: 'brand.500' }}
                  onClick={() => handleCommand('mailbox')}
                >
                  <HStack spacing={3}>
                    <Flex w="32px" h="32px" borderRadius="md" bg="green.50" align="center" justify="center" color="brand.500">
                      <Icon as={Sparkles} boxSize={4} />
                    </Flex>
                    <Box>
                      <Text fontSize="13px" fontWeight={600} color="text.primary">
                        Show cleanup potential
                      </Text>
                      <Text fontSize="11px" color="text.secondary">
                        See what can be cleaned
                      </Text>
                    </Box>
                  </HStack>
                  <Badge colorScheme="green" variant="subtle" fontSize="10px">
                    CLEANUP
                  </Badge>
                </Flex>
              </VStack>
            </Box>
          </Grid>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
