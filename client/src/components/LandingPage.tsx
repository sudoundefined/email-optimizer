import {
  Box,
  Flex,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  SimpleGrid,
  Icon,
  Badge,
  Container,
  Card,
  CardBody,
  Divider,
  Image,
} from '@chakra-ui/react'
import { useColorMode } from '@chakra-ui/color-mode'
import {
  Sparkles,
  HardDrive,
  ShieldCheck,
  Zap,
  Moon,
  Sun,
  MailCheck,
  ArrowRight,
} from 'lucide-react'

const FEATURES = [
  {
    title: 'Bulk One-Click Unsubscribe',
    description:
      'Instantly unsubscribe from dozens of newsletters and promotional senders using standard RFC 8058 one-click headers.',
    icon: Zap,
    badge: 'Instant',
  },
  {
    title: 'Smart Storage Reclaimer',
    description:
      'Identify large attachments (>10MB) and old promotional blasts eating into your 15GB Google account storage quota.',
    icon: HardDrive,
    badge: 'Space Saver',
  },
  {
    title: 'Keep-Latest Retention Rules',
    description:
      'Automatically retain only the newest updates or weekly digests from high-volume senders and archive or trash the rest.',
    icon: MailCheck,
    badge: 'Automated',
  },
  {
    title: '100% Safe & Recoverable',
    description:
      'Never permanently deletes your emails. All removed messages are placed in standard Gmail Trash for 30 days.',
    icon: ShieldCheck,
    badge: 'Risk-Free',
  },
]

const STEPS = [
  {
    number: '01',
    title: 'Connect Securely',
    desc: 'Sign in with Google OAuth. Your tokens are encrypted at rest with AES-256-GCM.',
  },
  {
    number: '02',
    title: 'Scan Mailbox Metadata',
    desc: 'EmailDiet scans headers and sender frequencies locally—never reading private email bodies.',
  },
  {
    number: '03',
    title: 'Clean & Optimize',
    desc: 'Unsubscribe, categorize, and free up gigabytes of Google Drive storage in seconds.',
  },
]

export default function LandingPage() {
  const { colorMode, toggleColorMode } = useColorMode()

  return (
    <Box bg="bg.app" minH="100vh" transition="background 0.2s">
      {/* Top Navbar */}
      <Box
        as="nav"
        borderBottom="1px solid"
        borderColor="border.subtle"
        bg="bg.card"
        py={3.5}
        px={{ base: 4, md: 8 }}
        position="sticky"
        top={0}
        zIndex={10}
        boxShadow="e1"
      >
        <Flex maxW="1200px" mx="auto" align="center" justify="space-between">
          <HStack spacing={3}>
            <Flex
              w="36px"
              h="36px"
              borderRadius="lg"
              bg="bg.card"
              align="center"
              justify="center"
              boxShadow="e1"
              border="1px solid"
              borderColor="border.subtle"
              overflow="hidden"
            >
              <Image src="/logo.png" alt="EmailDiet Logo" w="85%" h="85%" objectFit="contain" />
            </Flex>
            <Heading size="md" color="text.primary" fontWeight={700} letterSpacing="-0.02em">
              EmailDiet
            </Heading>
          </HStack>

          <HStack spacing={3}>
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleColorMode}
              aria-label="Toggle Color Mode"
              color="text.secondary"
              _hover={{ bg: 'bg.hover' }}
            >
              <Icon as={colorMode === 'light' ? Moon : Sun} boxSize={4} />
            </Button>
            <Button
              as="a"
              href="/api/auth/login"
              colorScheme="brand"
              size="sm"
              px={5}
              borderRadius="full"
              fontWeight={600}
            >
              <HStack spacing={2}>
                <Box w={2} h={2} borderRadius="full" bg="#22C55E" />
                <Text>Sign in with Google</Text>
              </HStack>
            </Button>
          </HStack>
        </Flex>
      </Box>

      {/* Hero Section */}
      <Container maxW="1100px" pt={{ base: 12, md: 16 }} pb={14} textAlign="center">
        <VStack spacing={6}>
          <Badge
            colorScheme="brand"
            variant="subtle"
            px={3.5}
            py={1}
            borderRadius="full"
            fontSize="xs"
            fontWeight={600}
            textTransform="uppercase"
            letterSpacing="wider"
          >
            <HStack spacing={1.5}>
              <Icon as={Sparkles} boxSize={3.5} />
              <Text>The Smart Multi-User Gmail Optimizer</Text>
            </HStack>
          </Badge>

          <Heading
            as="h1"
            fontSize={{ base: '3xl', md: '5xl', lg: '6xl' }}
            fontWeight={800}
            color="text.primary"
            lineHeight="1.15"
            maxW="850px"
          >
            Put Your Gmail Inbox on a{' '}
            <Text as="span" color="brand.500">
              High-Performance Diet
            </Text>
          </Heading>

          <Text fontSize={{ base: 'md', md: 'lg' }} color="text.secondary" maxW="660px">
            Unsubscribe from newsletters in bulk, reclaim gigabytes of storage from bloated emails,
            and keep your inbox organized without ever risking accidental permanent deletions.
          </Text>

          <HStack spacing={4} pt={2}>
            <Button
              as="a"
              href="/api/auth/login"
              colorScheme="brand"
              size="lg"
              px={8}
              py={7}
              borderRadius="full"
              fontSize="md"
              fontWeight={600}
              rightIcon={<Icon as={ArrowRight} boxSize={5} />}
              boxShadow="e2"
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'e3' }}
            >
              <HStack spacing={2.5}>
                <Box w={2.5} h={2.5} borderRadius="full" bg="#22C55E" />
                <Text>Connect Gmail — Free</Text>
              </HStack>
            </Button>
          </HStack>

          <Text fontSize="xs" color="text.tertiary">
            Official Google OAuth • AES-256 Encrypted • Zero Permanent Deletion
          </Text>

          {/* Interactive Preview Illustration Card (§3.8) */}
          <Card
            w="100%"
            maxW="780px"
            mt={8}
            bg="bg.card"
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="card"
            boxShadow="e2"
            overflow="hidden"
            textAlign="left"
          >
            <Box bg="bg.muted" px={5} py={3} borderBottom="1px solid" borderColor="border.subtle">
              <HStack justify="space-between">
                <HStack spacing={2}>
                  <Box w={3} h={3} borderRadius="full" bg="#EF4444" opacity={0.8} />
                  <Box w={3} h={3} borderRadius="full" bg="#F59E0B" opacity={0.8} />
                  <Box w={3} h={3} borderRadius="full" bg="#22C55E" opacity={0.8} />
                  <Text fontSize="xs" fontWeight={600} color="text.secondary" ml={2}>
                    EmailDiet Workspace Preview
                  </Text>
                </HStack>
                <Badge bg="bg.accent" color="text.primary" fontSize="11px" fontFamily="mono" px={2.5} py={0.5} borderRadius="md">
                  Cleaned 14,230 emails — saved 4.2 GB
                </Badge>
              </HStack>
            </Box>
            <CardBody p={6}>
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                <Box p={4} bg="bg.app" borderRadius="lg" border="1px solid" borderColor="border.subtle">
                  <Text fontSize="xs" color="text.tertiary" fontWeight={600} mb={1}>RECLAIMABLE STORAGE</Text>
                  <Text fontSize="22px" fontWeight={700} color="text.primary">4.2 GB</Text>
                  <Text fontSize="11px" color="text.secondary" mt={0.5}>Across 1,840 heavy attachments</Text>
                </Box>
                <Box p={4} bg="bg.app" borderRadius="lg" border="1px solid" borderColor="border.subtle">
                  <Text fontSize="xs" color="text.tertiary" fontWeight={600} mb={1}>NEWSLETTERS DETECTED</Text>
                  <Text fontSize="22px" fontWeight={700} color="text.primary">128 Senders</Text>
                  <Text fontSize="11px" color="#15803D" fontWeight={600} mt={0.5}>One-click unsubscribe ready</Text>
                </Box>
                <Box p={4} bg="bg.app" borderRadius="lg" border="1px solid" borderColor="border.subtle">
                  <Text fontSize="xs" color="text.tertiary" fontWeight={600} mb={1}>MAILBOX HEALTH</Text>
                  <Text fontSize="22px" fontWeight={700} color="text.primary">98.4%</Text>
                  <Text fontSize="11px" color="text.secondary" mt={0.5}>Protected senders verified</Text>
                </Box>
              </SimpleGrid>
            </CardBody>
          </Card>
        </VStack>
      </Container>

      {/* Stats Ribbon */}
      <Box bg="bg.card" borderY="1px solid" borderColor="border.subtle" py={8}>
        <Container maxW="1000px">
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8} textAlign="center">
            <Box>
              <Heading size="lg" color="brand.500">
                100%
              </Heading>
              <Text fontSize="sm" color="text.secondary" fontWeight={500} mt={1}>
                Recoverable via Gmail Trash
              </Text>
            </Box>
            <Box>
              <Heading size="lg" color="brand.500">
                AES-256
              </Heading>
              <Text fontSize="sm" color="text.secondary" fontWeight={500} mt={1}>
                Authenticated At-Rest Token Encryption
              </Text>
            </Box>
            <Box>
              <Heading size="lg" color="brand.500">
                0 bytes
              </Heading>
              <Text fontSize="sm" color="text.secondary" fontWeight={500} mt={1}>
                Email Body Content Ever Read or Stored
              </Text>
            </Box>
          </SimpleGrid>
        </Container>
      </Box>

      {/* Features Grid */}
      <Container maxW="1100px" py={16}>
        <VStack spacing={3} textAlign="center" mb={12}>
          <Heading size="xl" color="text.primary">
            Everything You Need for a Clean Inbox
          </Heading>
          <Text color="text.secondary">
            Designed for privacy, speed, and safety.
          </Text>
        </VStack>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          {FEATURES.map((feat) => (
            <Card
              key={feat.title}
              bg="bg.card"
              borderRadius="card"
              border="1px solid"
              borderColor="border.subtle"
              boxShadow="e1"
              _hover={{ boxShadow: 'e2', borderColor: 'brand.500' }}
              transition="all 0.2s"
            >
              <CardBody p={7}>
                <Flex justify="space-between" align="start" mb={4}>
                  <Flex
                    w="44px"
                    h="44px"
                    borderRadius="lg"
                    bg="bg.muted"
                    color="brand.500"
                    align="center"
                    justify="center"
                  >
                    <Icon as={feat.icon} boxSize={5} />
                  </Flex>
                  <Badge colorScheme="brand" variant="subtle" borderRadius="full" px={3} py={1}>
                    {feat.badge}
                  </Badge>
                </Flex>

                <Heading size="md" mb={2} color="text.primary">
                  {feat.title}
                </Heading>
                <Text color="text.secondary" fontSize="sm" lineHeight="tall">
                  {feat.description}
                </Text>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      </Container>

      {/* How It Works Section */}
      <Box bg="bg.card" py={16} borderY="1px solid" borderColor="border.subtle">
        <Container maxW="1000px">
          <VStack spacing={3} textAlign="center" mb={12}>
            <Heading size="xl" color="text.primary">
              How EmailDiet Works
            </Heading>
            <Text color="text.secondary">Three simple steps to take back control.</Text>
          </VStack>

          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8}>
            {STEPS.map((s) => (
              <Box key={s.number} textAlign="left" p={4}>
                <Text fontSize="4xl" fontWeight={900} color="brand.500" mb={2}>
                  {s.number}
                </Text>
                <Heading size="md" mb={2} color="text.primary">
                  {s.title}
                </Heading>
                <Text fontSize="sm" color="text.secondary">
                  {s.desc}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* Footer */}
      <Box py={10} textAlign="center">
        <Container maxW="1100px">
          <Divider mb={8} borderColor="border.subtle" />
          <Flex
            direction={{ base: 'column', md: 'row' }}
            justify="space-between"
            align="center"
            fontSize="xs"
            color="text.tertiary"
          >
            <Text>&copy; {new Date().getFullYear()} EmailDiet. All rights reserved.</Text>
            <HStack spacing={6} mt={{ base: 4, md: 0 }}>
              <Box as="a" href="/privacy" _hover={{ color: 'text.primary' }}>
                Privacy Policy
              </Box>
              <Box as="a" href="/terms" _hover={{ color: 'text.primary' }}>
                Terms of Service
              </Box>
            </HStack>
          </Flex>
        </Container>
      </Box>
    </Box>
  )
}
