import { useState, useEffect } from 'react'
import {
  Box, Flex, VStack, Icon, Text, Spacer, useDisclosure, Drawer,
  DrawerOverlay, DrawerContent, DrawerBody,
  IconButton, Heading, Spinner, Tooltip, HStack, useColorMode, Button, Image
} from '@chakra-ui/react'
import {
  EmailIcon, SettingsIcon, HamburgerIcon, SunIcon, MoonIcon, RepeatIcon
} from '@chakra-ui/icons'

import { useAuth } from './hooks/useAuth'
import ConnectScreen from './components/ConnectScreen'
import AccountBadge from './components/AccountBadge'
import MailboxTab from './components/MailboxTab'
import StorageTab from './components/StorageTab'
import LabelManager from './components/LabelManager'
import DigestSettingsDialog from './components/DigestSettingsDialog'
import { useAppTheme } from './theme/ThemeContext'

const StorageIcon = (props: any) => (
  <Icon viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
    <line x1="12" y1="22.08" x2="12" y2="12"></line>
  </Icon>
)

const LabelIcon = (props: any) => (
  <Icon viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
    <circle cx="7" cy="7" r="2"></circle>
  </Icon>
)

const TABS = [
  { value: 'mailbox', label: 'Mailbox', icon: EmailIcon, blurb: 'Clean up senders and messages' },
  { value: 'storage', label: 'Storage', icon: StorageIcon, blurb: 'Reclaim space from large emails' },
  { value: 'labels',  label: 'Labels',  icon: LabelIcon, blurb: 'Manage your app-created labels' },
] as const

type TabValue = (typeof TABS)[number]['value']

export default function App() {
  const auth = useAuth()
  const [tab, setTab] = useState<TabValue>('mailbox')
  const [digestOpen, setDigestOpen] = useState(false)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { colorMode, toggleColorMode } = useColorMode()
  const { theme: activeThemeName, setTheme } = useAppTheme()
  const [cacheInfo, setCacheInfo] = useState<{
    timestamp: number | null
    secondsUntilRefresh: number
    onRefresh: () => void
    stats?: { totalMB: number; messageCount: number }
  } | null>(null)

  useEffect(() => {
    setCacheInfo(null)
  }, [tab])

  if (auth.loading) {
    return (
      <Flex minH="100vh" align="center" justify="center">
        <VStack spacing={4}>
          <Flex w="80px" h="80px" borderRadius="3xl" bg="white" align="center" justify="center" boxShadow="0 20px 40px -10px rgba(10, 45, 46, 0.2)" overflow="hidden">
            <Image src="/logo.png" alt="EmailDiet Logo" w="100%" h="100%" objectFit="cover" />
          </Flex>
          <Spinner color="brand.500" size="xl" thickness="4px" />
        </VStack>
      </Flex>
    )
  }

  if (!auth.status?.connected) return <ConnectScreen />

  const active = TABS.find(t => t.value === tab)!

  const SidebarContent = () => (
    <Flex 
      direction="column" 
      h="full" 
      bg="bg.card" 
      backdropFilter="blur(20px)" 
      borderRadius={{ md: '3xl' }}
      boxShadow={{ md: '0 20px 40px -10px rgba(0,0,0, 0.1)' }}
      border={{ md: '1px solid' }}
      borderColor={{ md: 'border.glass' }}
      py={6}
    >
      {/* Brand */}
      <HStack px={6} mb={10} spacing={3}>
        <Flex w="36px" h="36px" borderRadius="xl" bg="white" align="center" justify="center" boxShadow="sm" overflow="hidden">
          <Image src="/logo.png" alt="EmailDiet Logo" w="100%" h="100%" objectFit="cover" />
        </Flex>
        <Heading size="md" color="text.primary" letterSpacing="-0.02em" fontWeight={700}>
          EmailDiet
        </Heading>
      </HStack>

      {/* Nav Items */}
      <VStack spacing={2} align="stretch" px={4}>
        {TABS.map(t => {
          const isActive = tab === t.value
          return (
            <Flex
              key={t.value}
              as="button"
              onClick={() => {
                setTab(t.value)
                onClose()
              }}
              align="center"
              px={4}
              py={3}
              borderRadius="full"
              bg={isActive ? 'brand.500' : 'transparent'}
              color={isActive ? 'white' : 'text.secondary'}
              fontWeight={isActive ? 600 : 500}
              _hover={{ bg: isActive ? 'brand.600' : 'bg.hover', color: isActive ? 'white' : 'text.primary' }}
              transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
            >
              <Icon as={t.icon} mr={3} boxSize={5} />
              <Text>{t.label}</Text>
            </Flex>
          )
        })}
      </VStack>

      <Spacer />

      {/* Bottom Section */}
      <VStack spacing={2} align="stretch" px={4} pt={6}>
        <Flex
          as="button"
          onClick={() => setDigestOpen(true)}
          align="center"
          px={4}
          py={3}
          borderRadius="full"
          color="text.secondary"
          _hover={{ bg: 'bg.hover', color: 'text.primary' }}
          transition="all 0.2s"
        >
          <Icon as={SettingsIcon} mr={3} boxSize={5} />
          <Text fontWeight={500}>Weekly Digest</Text>
        </Flex>
        <Flex
          as="button"
          onClick={() => setTheme(activeThemeName === 'botanical' ? 'espresso' : 'botanical')}
          align="center"
          px={4}
          py={3}
          borderRadius="full"
          color="text.secondary"
          _hover={{ bg: 'bg.hover', color: 'text.primary' }}
          transition="all 0.2s"
        >
          <Text fontWeight={500}>{activeThemeName === 'botanical' ? '🌿 Botanical Theme' : '☕ Espresso Theme'}</Text>
        </Flex>
      </VStack>

      <Flex mt="auto" w="full" pt={4} justify="center" align="center" direction="column">
        <Text fontSize="xs" color="gray.400">
          &copy; {new Date().getFullYear()} EmailDiet.
        </Text>
      </Flex>
    </Flex>
  )

  return (
    <Flex h="100vh" p={{ base: 0, md: 6 }} gap={6}>
      {/* Desktop Floating Dock */}
      <Box display={{ base: 'none', md: 'block' }} w="260px" flexShrink={0} position="sticky" top={6} h="calc(100vh - 48px)">
        <SidebarContent />
      </Box>

      {/* Mobile Drawer */}
      <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
        <DrawerOverlay backdropFilter="blur(4px)" />
        <DrawerContent maxW="280px" bg="transparent" boxShadow="none">
          <DrawerBody p={4} h="100vh">
             <Box h="full" bg="bg.card" borderRadius="3xl" backdropFilter="blur(20px)" overflow="hidden">
               <SidebarContent />
             </Box>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Main Content Card */}
      <Flex 
        flex={1} 
        direction="column" 
        minW={0} 
        minH={0}
        bg="bg.card"
        backdropFilter="blur(20px)"
        borderRadius={{ base: 0, md: '3xl' }}
        boxShadow={{ md: '0 20px 40px -10px rgba(0,0,0, 0.1)' }}
        border={{ md: '1px solid' }}
        borderColor={{ md: 'border.glass' }}
        overflow="hidden"
      >
        {/* Top bar */}
        <Flex
          h="72px"
          align="center"
          px={6}
          borderBottom="1px"
          borderColor="border.subtle"
          zIndex={10}
        >
          <IconButton
            display={{ base: 'flex', md: 'none' }}
            aria-label="Open menu"
            icon={<HamburgerIcon />}
            onClick={onOpen}
            variant="ghost"
            mr={4}
            color="text.primary"
          />
          <Heading size="lg" fontWeight={700} color="text.primary" display={{ base: 'none', sm: 'block' }} letterSpacing="-0.02em">
            {active.label}
          </Heading>
          <Text fontSize="md" color="text.secondary" ml={4} display={{ base: 'none', lg: 'block' }} fontWeight={500}>
            {active.blurb}
          </Text>
          <Spacer />
          <HStack spacing={4}>
            <Tooltip label="Toggle Dark Mode" hasArrow>
              <IconButton
                aria-label="Toggle dark mode"
                icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
                variant="ghost"
                color="text.secondary"
                borderRadius="full"
                _hover={{ color: 'text.primary', bg: 'bg.hover' }}
                onClick={toggleColorMode}
              />
            </Tooltip>
            <Tooltip label="Weekly digest settings" hasArrow>
              <IconButton
                aria-label="Settings"
                icon={<SettingsIcon />}
                variant="ghost"
                color="text.secondary"
                borderRadius="full"
                _hover={{ color: 'text.primary', bg: 'bg.hover' }}
                onClick={() => setDigestOpen(true)}
              />
            </Tooltip>
            <AccountBadge email={auth.status.email!} onLogout={auth.logout} />
          </HStack>
        </Flex>


        {/* Cache Info Banner */}
        {cacheInfo && (
          <Flex 
            flexShrink={0}
            direction={{ base: 'column', md: 'row' }} 
            justify="space-between" 
            align={{ base: 'stretch', md: 'center' }} 
            mx={6}
            mt={4}
            p={4} 
            bg="brand.100" 
            borderRadius="2xl" 
            border="1px solid" 
            borderColor="brand.300"
          >
            <HStack spacing={3}>
              <Flex 
                w="36px" h="36px" borderRadius="xl" bg="brand.500" align="center" justify="center" boxShadow="sm"
                color="white"
              >
                {tab === 'storage' ? <StorageIcon boxSize={5} /> : <LabelIcon boxSize={5} />}
              </Flex>
              <VStack align="start" spacing={0.5}>
                {cacheInfo.stats ? (
                  <>
                    <Text fontSize="sm" fontWeight={700} color="brand.800">
                      Reclaimable Storage: {cacheInfo.stats.totalMB.toLocaleString()} MB
                    </Text>
                    <Text fontSize="xs" color="brand.700" fontWeight={500}>
                      across {cacheInfo.stats.messageCount.toLocaleString()} large emails (&gt; 250 KB).{' '}
                      {cacheInfo.timestamp 
                        ? `Auto-refreshing in ${Math.floor(cacheInfo.secondsUntilRefresh / 60)}m ${cacheInfo.secondsUntilRefresh % 60}s.`
                        : 'Loading analysis...'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text fontSize="sm" fontWeight={700} color="brand.800">
                      {tab === 'storage' ? 'Storage Analysis (emails > 250 KB)' : 'Gmail Labels Manager'}
                    </Text>
                    <Text fontSize="xs" color="brand.700" fontWeight={500}>
                      {cacheInfo.timestamp 
                        ? `Showing cached data from ${new Date(cacheInfo.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}. Auto-refreshing in ${Math.floor(cacheInfo.secondsUntilRefresh / 60)}m ${cacheInfo.secondsUntilRefresh % 60}s.`
                        : 'Loading analysis...'}
                    </Text>
                  </>
                )}
              </VStack>
            </HStack>
            <Button 
              size="sm" 
              colorScheme="blue" 
              onClick={cacheInfo.onRefresh} 
              leftIcon={<RepeatIcon />}
              px={5}
              borderRadius="full"
            >
              Refresh Cache
            </Button>
          </Flex>
        )}

        {/* Tab Content */}
        <Flex p={{ base: 4, md: 8 }} overflow="hidden" flex={1} direction="column" minH={0}>
          {tab === 'mailbox' && <MailboxTab onDisconnected={auth.markDisconnected} />}
          {tab === 'storage' && <StorageTab onDisconnected={auth.markDisconnected} onCacheInfo={setCacheInfo} />}
          {tab === 'labels'  && <LabelManager onDisconnected={auth.markDisconnected} onCacheInfo={setCacheInfo} />}
        </Flex>
      </Flex>

      <DigestSettingsDialog
        open={digestOpen}
        onClose={() => setDigestOpen(false)}
        onDisconnected={auth.markDisconnected}
        accountEmail={auth.status.email ?? ''}
      />
    </Flex>
  )
}
