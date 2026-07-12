import { useState, useEffect } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  VStack,
  HStack,
  Text,
  Avatar,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  Box,
  Badge,
  Spinner,
  useToast,
  Divider,
  Flex,
} from '@chakra-ui/react'

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
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
}

export default function UserProfileModal({
  isOpen,
  onClose,
  userEmail,
  onLogout,
}: UserProfileModalProps) {
  const toast = useToast()
  const [preferences, setPreferences] = useState<UserPreferences>({})
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loadingActivities, setLoadingActivities] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchPreferences()
      fetchActivities()
    }
  }, [isOpen])

  const fetchPreferences = async () => {
    try {
      const res = await fetch('/api/user/preferences', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setPreferences(data)
      }
    } catch {
      // ignore
    }
  }

  const fetchActivities = async () => {
    setLoadingActivities(true)
    try {
      const res = await fetch('/api/user/activity?limit=25', { credentials: 'include' })
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
          title: 'Preferences saved',
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
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent borderRadius="2xl" overflow="hidden">
        <ModalHeader bg="bg.card" pb={2}>
          Account & Preferences
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody p={6}>
          <Tabs variant="soft-rounded" colorScheme="brand">
            <TabList mb={4}>
              <Tab>Profile</Tab>
              <Tab>Preferences</Tab>
              <Tab>Activity Log</Tab>
            </TabList>

            <TabPanels>
              {/* Profile Panel */}
              <TabPanel px={0}>
                <VStack spacing={6} align="stretch">
                  <HStack spacing={4}>
                    <Avatar size="lg" name={userEmail || 'User'} bg="brand.500" color="white" />
                    <Box>
                      <Text fontWeight="bold" fontSize="lg">
                        {userEmail}
                      </Text>
                      <Badge colorScheme="green" mt={1}>
                        Connected via Google OAuth
                      </Badge>
                    </Box>
                  </HStack>

                  <Divider />

                  <Box>
                    <Text fontSize="sm" color="text.secondary" mb={4}>
                      Your Google OAuth tokens are securely encrypted at rest (AES-256-GCM) and
                      isolated to your user account.
                    </Text>

                    <Button
                      colorScheme="red"
                      variant="outline"
                      w="full"
                      onClick={() => {
                        onClose()
                        onLogout()
                      }}
                    >
                      Sign out & revoke tokens
                    </Button>
                  </Box>
                </VStack>
              </TabPanel>

              {/* Preferences Panel */}
              <TabPanel px={0}>
                <VStack spacing={4} align="stretch">
                  <FormControl>
                    <FormLabel fontSize="sm">Default Scan Time Range</FormLabel>
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
                    <FormLabel fontSize="sm">Max Messages to Scan</FormLabel>
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
                    <FormLabel fontSize="sm">Default Gmail Label Prefix</FormLabel>
                    <Input
                      placeholder="Unsub/"
                      value={preferences.labelPrefix || 'Unsub/'}
                      onChange={(e) =>
                        setPreferences({ ...preferences, labelPrefix: e.target.value })
                      }
                    />
                  </FormControl>

                  <Button
                    colorScheme="brand"
                    onClick={handleSavePreferences}
                    isLoading={savingPrefs}
                    mt={2}
                  >
                    Save Preferences
                  </Button>
                </VStack>
              </TabPanel>

              {/* Activity Log Panel */}
              <TabPanel px={0}>
                {loadingActivities ? (
                  <Flex justify="center" py={8}>
                    <Spinner color="brand.500" />
                  </Flex>
                ) : activities.length === 0 ? (
                  <Text color="text.secondary" fontSize="sm" textAlign="center" py={8}>
                    No recent activity recorded.
                  </Text>
                ) : (
                  <VStack spacing={3} align="stretch" maxH="320px" overflowY="auto" pr={2}>
                    {activities.map((act) => (
                      <Box
                        key={act.id}
                        p={3}
                        borderRadius="xl"
                        border="1px solid"
                        borderColor="border.subtle"
                        bg="bg.input"
                      >
                        <Flex justify="space-between" align="center">
                          <HStack spacing={2}>
                            <Badge colorScheme="blue" textTransform="uppercase">
                              {act.action}
                            </Badge>
                          </HStack>
                          <Text fontSize="xs" color="text.secondary">
                            {new Date(act.createdAt).toLocaleString()}
                          </Text>
                        </Flex>
                        {act.details && (
                          <Text fontSize="xs" color="text.secondary" mt={1} noOfLines={2}>
                            {JSON.stringify(act.details)}
                          </Text>
                        )}
                      </Box>
                    ))}
                  </VStack>
                )}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
