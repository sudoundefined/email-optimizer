import { useState, useEffect } from 'react'
import {
  Box, Flex, VStack, Icon, Text, Spacer, useDisclosure, Drawer,
  DrawerOverlay, DrawerContent, DrawerBody,
  IconButton, Heading, Spinner, Tooltip, HStack, useColorMode, Button, Image
} from '@chakra-ui/react'
import { HamburgerIcon, SunIcon, MoonIcon, RepeatIcon } from '@chakra-ui/icons'
import {
  LayoutDashboard, Mail, HardDrive, Tags, User, History, CalendarClock, Palette,
  MailCheck, ShieldCheck, Settings, Zap
} from 'lucide-react'

import { useAuth } from './hooks/useAuth'
import LandingPage from './components/LandingPage'
import AccountBadge from './components/AccountBadge'
import DashboardTab from './components/DashboardTab'
import MailboxTab from './components/MailboxTab'
import StorageTab from './components/StorageTab'
import LabelManager from './components/LabelManager'
import TimelineTab from './components/TimelineTab'
import LogsPage from './components/LogsPage'
import DigestTab from './components/DigestTab'
import ProtectedTab from './components/ProtectedTab'
import SettingsTab from './components/SettingsTab'
import UpgradeModal from './components/UpgradeModal'
import UserProfileModal from './components/UserProfileModal'
import { CommandPaletteModal } from './components/CommandPaletteModal'
import { useAppTheme, type AppTheme } from './theme/ThemeContext'

const TABS = [
  { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, blurb: 'Your mailbox health at a glance' },
  { value: 'mailbox', label: 'Mailbox', icon: Mail, blurb: 'Clean up senders and messages' },
  { value: 'storage', label: 'Storage', icon: HardDrive, blurb: 'Reclaim space from large emails' },
  { value: 'labels',  label: 'Labels',  icon: Tags, blurb: 'Manage your app-created labels' },
  { value: 'timeline', label: 'Timeline', icon: CalendarClock, blurb: 'Relationship and interaction timeline' },
  { value: 'activity', label: 'Activity', icon: History, blurb: 'Immutable audit trail of scans & cleanups' },
  { value: 'digest', label: 'Weekly Digest', icon: MailCheck, blurb: 'Configure your weekly email digest' },
  { value: 'protected', label: 'Protected Senders', icon: ShieldCheck, blurb: 'Manage whitelisted senders' },
  { value: 'settings', label: 'Settings', icon: Settings, blurb: 'System and scan preferences' },
] as const

type TabValue = (typeof TABS)[number]['value']

const THEME_CYCLE: Record<AppTheme, AppTheme> = {
  daylight: 'botanical', botanical: 'sage', sage: 'daylight',
}
const THEME_LABEL: Record<AppTheme, string> = {
  daylight: 'Daylight', botanical: 'Botanical', sage: 'Sage Mint',
}

export default function App() {
  const auth = useAuth()
  const [tab, setTab] = useState<TabValue>('dashboard')
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const profileModal = useDisclosure()
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (auth.loading) {
    return (
      <Flex minH="100vh" align="center" justify="center">
        <VStack spacing={4}>
          <Flex w="80px" h="80px" borderRadius="20px" bg="bg.card" align="center" justify="center" boxShadow="e2" overflow="hidden">
            <Image src="/logo.png" alt="EmailDiet Logo" w="100%" h="100%" objectFit="cover" />
          </Flex>
          <Spinner color="brand.500" size="xl" thickness="4px" />
        </VStack>
      </Flex>
    )
  }

  if (!auth.status?.connected) return <LandingPage />

  const active = TABS.find(t => t.value === tab)!
  const firstName = auth.status.email?.split('@')[0]?.split(/[._]/)[0]
  const userName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : undefined

  const SidebarContent = () => (
    <Flex
      direction="column"
      h="full"
      bg="bg.card"
      borderRadius={{ md: '20px' }}
      boxShadow={{ md: 'e2' }}
      border="1px solid"
      borderColor="border.subtle"
      py={6}
    >
      {/* Brand */}
      <HStack px={5} mb={8} spacing={3}>
        <Flex w="34px" h="34px" borderRadius="10px" bg="bg.card" align="center" justify="center" boxShadow="e1" border="1px solid" borderColor="border.subtle" overflow="hidden">
          <Image src="/logo.png" alt="EmailDiet Logo" w="100%" h="100%" objectFit="cover" />
        </Flex>
        <Heading size="md" color="text.primary" letterSpacing="-0.02em" fontWeight={700}>
          EmailDiet
        </Heading>
      </HStack>

      {/* Nav Items */}
      <VStack spacing={1} align="stretch" px={3}>
        {TABS.map(t => {
          const isActive = tab === t.value
          return (
            <Flex
              key={t.value}
              as="button"
              onClick={() => { setTab(t.value); onClose() }}
              align="center"
              position="relative"
              px={3}
              h="44px"
              borderRadius="12px"
              bg={isActive ? 'bg.accent' : 'transparent'}
              color={isActive ? 'brand.500' : 'text.secondary'}
              fontWeight={isActive ? 600 : 500}
              _hover={{ bg: isActive ? 'bg.accent' : 'bg.hover', color: isActive ? 'brand.500' : 'text.primary' }}
              transition="all 0.15s ease-out"
            >
              {isActive && (
                <Box position="absolute" left="-12px" top="10px" bottom="10px" w="3px" borderRadius="full" bg="brand.500" />
              )}
              <Icon as={t.icon} mr={3} boxSize={5} strokeWidth={isActive ? 2.25 : 2} />
              <Text fontSize="15px">{t.label}</Text>
            </Flex>
          )
        })}
      </VStack>

      <Spacer />

      {/* Bottom Section */}
      <VStack spacing={1} align="stretch" px={3} pt={6}>
        <Flex
          as="button"
          onClick={() => setTheme(THEME_CYCLE[activeThemeName])}
          align="center"
          px={3}
          h="44px"
          borderRadius="12px"
          color="text.secondary"
          _hover={{ bg: 'bg.hover', color: 'text.primary' }}
          transition="all 0.15s"
        >
          <Icon as={Palette} mr={3} boxSize={5} />
          <Text fontWeight={500} fontSize="15px">{THEME_LABEL[activeThemeName]} theme</Text>
        </Flex>
        <Flex
          as="button"
          onClick={() => setUpgradeOpen(true)}
          align="center"
          px={3}
          h="44px"
          borderRadius="12px"
          color="text.secondary"
          _hover={{ bg: 'bg.hover', color: 'text.primary' }}
          transition="all 0.15s"
        >
          <Icon as={Zap} mr={3} boxSize={5} />
          <Text fontWeight={500} fontSize="15px">Upgrade</Text>
        </Flex>
        <Flex
          as="button"
          onClick={profileModal.onOpen}
          align="center"
          px={3}
          h="44px"
          borderRadius="12px"
          color="text.secondary"
          _hover={{ bg: 'bg.hover', color: 'text.primary' }}
          transition="all 0.15s"
        >
          <Icon as={User} mr={3} boxSize={5} />
          <Text fontWeight={500} fontSize="15px">Profile</Text>
        </Flex>
      </VStack>

      <Flex mt={5} w="full" justify="center" align="center">
        <Text fontSize="xs" color="text.tertiary">
          &copy; {new Date().getFullYear()} EmailDiet.
        </Text>
      </Flex>
    </Flex>
  )

  return (
    <Flex h="100vh" p={{ base: 0, md: 5 }} gap={5} maxW="100%" w="100%">
      {/* Desktop Sidebar */}
      <Box display={{ base: 'none', md: 'block' }} w="240px" flexShrink={0} position="sticky" top={5} h="calc(100vh - 40px)">
        <SidebarContent />
      </Box>

      {/* Mobile Drawer */}
      <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
        <DrawerOverlay backdropFilter="blur(4px)" />
        <DrawerContent maxW="280px" bg="transparent" boxShadow="none">
          <DrawerBody p={4} h="100vh">
             <Box h="full" bg="bg.card" borderRadius="20px" overflow="hidden">
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
        borderRadius={{ base: 0, md: '20px' }}
        boxShadow={{ md: 'e2' }}
        border="1px solid"
        borderColor="border.subtle"
        overflow="hidden"
      >
        {/* Top bar */}
        <Flex
          h="64px"
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
          <Heading size="md" fontWeight={700} color="text.primary" display={{ base: 'none', sm: 'block' }} letterSpacing="-0.02em">
            {active.label}
          </Heading>
          <Text fontSize="sm" color="text.secondary" ml={4} display={{ base: 'none', lg: 'block' }} fontWeight={500}>
            {active.blurb}
          </Text>
          <Spacer />
          <HStack spacing={2}>
            <Tooltip label="Toggle dark mode" hasArrow>
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
            <AccountBadge
              email={auth.status.email!}
              onLogout={auth.logout}
              onOpenProfile={() => setTab('settings')}
            />
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
            bg="bg.accent"
            borderRadius="14px"
            border="1px solid"
            borderColor="border.subtle"
          >
            <HStack spacing={3}>
              <Flex
                w="36px" h="36px" borderRadius="10px" bg="brand.500" align="center" justify="center" boxShadow="e1"
                color="white"
              >
                {tab === 'storage' ? <Icon as={HardDrive} boxSize={5} /> : <Icon as={Tags} boxSize={5} />}
              </Flex>
              <VStack align="start" spacing={0.5}>
                {cacheInfo.stats ? (
                  <>
                    <Text fontSize="sm" fontWeight={700} color="text.primary">
                      Reclaimable Storage: {cacheInfo.stats.totalMB.toLocaleString()} MB
                    </Text>
                    <Text fontSize="xs" color="text.secondary" fontWeight={500}>
                      across {cacheInfo.stats.messageCount.toLocaleString()} large emails (&gt; 250 KB).{' '}
                      {cacheInfo.timestamp
                        ? `Auto-refreshing in ${Math.floor(cacheInfo.secondsUntilRefresh / 60)}m ${cacheInfo.secondsUntilRefresh % 60}s.`
                        : 'Loading analysis...'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text fontSize="sm" fontWeight={700} color="text.primary">
                      {tab === 'storage' ? 'Storage Analysis (emails > 250 KB)' : 'Gmail Labels Manager'}
                    </Text>
                    <Text fontSize="xs" color="text.secondary" fontWeight={500}>
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
              colorScheme="brand"
              onClick={cacheInfo.onRefresh}
              leftIcon={<RepeatIcon />}
              px={5}
              borderRadius="control"
            >
              Refresh Cache
            </Button>
          </Flex>
        )}

        {/* Tab Content */}
        <Flex
          p={tab === 'mailbox' ? { base: 3, md: 5 } : { base: 4, md: 7 }}
          overflowY={tab === 'settings' || tab === 'dashboard' || tab === 'digest' || tab === 'timeline' || tab === 'protected' || tab === 'activity' ? 'auto' : 'hidden'}
          overflowX="hidden"
          flex={1}
          direction="column"
          minH={0}
        >
          {tab === 'dashboard' && <DashboardTab onDisconnected={auth.markDisconnected} onNavigate={(t) => setTab(t as any)} userName={userName} />}
          {tab === 'mailbox' && <MailboxTab onDisconnected={auth.markDisconnected} />}
          {tab === 'storage' && <StorageTab onDisconnected={auth.markDisconnected} onCacheInfo={setCacheInfo} />}
          {tab === 'labels'  && <LabelManager onDisconnected={auth.markDisconnected} onCacheInfo={setCacheInfo} />}
          {tab === 'timeline' && <TimelineTab />}
          {tab === 'activity' && <LogsPage />}
          {tab === 'digest' && <DigestTab onDisconnected={auth.markDisconnected} accountEmail={auth.status.email ?? ''} />}
          {tab === 'protected' && <ProtectedTab onDisconnected={auth.markDisconnected} />}
          {tab === 'settings' && <SettingsTab userEmail={auth.status.email} onLogout={auth.logout} />}
        </Flex>
      </Flex>

      <UpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
      />

      <UserProfileModal
        isOpen={profileModal.isOpen}
        onClose={profileModal.onClose}
        userEmail={auth.status.email}
        onLogout={auth.logout}
      />

      <CommandPaletteModal
        isOpen={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onNavigateTab={(t) => setTab(t as TabValue)}
      />
    </Flex>
  )
}
