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
  useColorModeValue,
  Container,
  Card,
  CardBody,
  Divider,
  Image,
} from '@chakra-ui/react'
import {
  LockIcon,
  StarIcon,
  RepeatIcon,
  SunIcon,
  MoonIcon,
} from '@chakra-ui/icons'
import { useColorMode } from '@chakra-ui/color-mode'

const StorageSvgIcon = (props: any) => (
  <Icon viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </Icon>
)

const FEATURES = [
  {
    title: 'Bulk One-Click Unsubscribe',
    description:
      'Instantly unsubscribe from dozens of newsletters and promotional senders using standard RFC 8058 one-click headers.',
    icon: StarIcon,
    badge: 'Instant',
  },
  {
    title: 'Smart Storage Reclaimer',
    description:
      'Identify large attachments (>10MB) and old promotional blasts eating into your 15GB Google account storage quota.',
    icon: StorageSvgIcon,
    badge: 'Space Saver',
  },
  {
    title: 'Keep-Latest Retention Rules',
    description:
      'Automatically retain only the 5 newest shipping updates or weekly coupons from high-volume senders and archive the rest.',
    icon: RepeatIcon,
    badge: 'Automated',
  },
  {
    title: '100% Safe & Recoverable',
    description:
      'Never permanently deletes your emails. All removed messages are placed in your standard Gmail Trash for 30 days.',
    icon: LockIcon,
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
  const bg = useColorModeValue('gray.50', 'gray.900')
  const cardBg = useColorModeValue('white', 'gray.800')
  const textColor = useColorModeValue('gray.600', 'gray.300')
  const headingColor = useColorModeValue('gray.900', 'white')
  const borderCol = useColorModeValue('gray.200', 'gray.700')

  return (
    <Box bg={bg} minH="100vh" transition="background 0.2s">
      {/* Top Navbar */}
      <Box
        as="nav"
        borderBottom="1px solid"
        borderColor={borderCol}
        bg={cardBg}
        py={4}
        px={{ base: 4, md: 8 }}
        position="sticky"
        top={0}
        zIndex={10}
        boxShadow="sm"
      >
        <Flex maxW="1200px" mx="auto" align="center" justify="space-between">
          <HStack spacing={3}>
            <Flex
              w="36px"
              h="36px"
              borderRadius="xl"
              bg="white"
              align="center"
              justify="center"
              boxShadow="sm"
              overflow="hidden"
            >
              <Image src="/logo.png" alt="EmailDiet Logo" w="100%" h="100%" objectFit="cover" />
            </Flex>
            <Heading size="md" color={headingColor} fontWeight={700} letterSpacing="-0.02em">
              EmailDiet
            </Heading>
          </HStack>

          <HStack spacing={4}>
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleColorMode}
              aria-label="Toggle Color Mode"
            >
              {colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
            </Button>
            <Button
              as="a"
              href="/api/auth/login"
              colorScheme="brand"
              size="sm"
              px={6}
              borderRadius="full"
              fontWeight={600}
            >
              Sign in with Google
            </Button>
          </HStack>
        </Flex>
      </Box>

      {/* Hero Section */}
      <Container maxW="1100px" pt={{ base: 12, md: 20 }} pb={16} textAlign="center">
        <VStack spacing={6}>
          <Badge
            colorScheme="brand"
            px={3}
            py={1}
            borderRadius="full"
            fontSize="xs"
            fontWeight="bold"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            ✨ The Smart Multi-User Gmail Optimizer
          </Badge>

          <Heading
            as="h1"
            fontSize={{ base: '3xl', md: '5xl', lg: '6xl' }}
            fontWeight={800}
            color={headingColor}
            lineHeight="1.15"
            maxW="850px"
          >
            Put Your Gmail Inbox on a{' '}
            <Text as="span" color="blue.500">
              High-Performance Diet
            </Text>
          </Heading>

          <Text fontSize={{ base: 'md', md: 'xl' }} color={textColor} maxW="680px">
            Unsubscribe from newsletters in bulk, reclaim gigabytes of storage from bloated emails,
            and keep your inbox organized without ever risking accidental permanent deletions.
          </Text>

          <HStack spacing={4} pt={4}>
            <Button
              as="a"
              href="/api/auth/login"
              colorScheme="brand"
              size="lg"
              px={8}
              py={7}
              borderRadius="full"
              fontSize="md"
              fontWeight={700}
              boxShadow="0 10px 25px -5px rgba(49, 130, 206, 0.4)"
              _hover={{ transform: 'translateY(-2px)', boxShadow: '0 15px 30px -5px rgba(49, 130, 206, 0.5)' }}
            >
              Connect Gmail — Free
            </Button>
          </HStack>

          <Text fontSize="xs" color={textColor}>
            Official Google OAuth • AES-256 Encrypted • Zero Permanent Deletion
          </Text>
        </VStack>
      </Container>

      {/* Stats Ribbon */}
      <Box bg={cardBg} borderY="1px solid" borderColor={borderCol} py={8}>
        <Container maxW="1000px">
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8} textAlign="center">
            <Box>
              <Heading size="lg" color="blue.500">
                100%
              </Heading>
              <Text fontSize="sm" color={textColor} fontWeight={500} mt={1}>
                Recoverable via Gmail Trash
              </Text>
            </Box>
            <Box>
              <Heading size="lg" color="blue.500">
                AES-256
              </Heading>
              <Text fontSize="sm" color={textColor} fontWeight={500} mt={1}>
                Authenticated At-Rest Token Encryption
              </Text>
            </Box>
            <Box>
              <Heading size="lg" color="blue.500">
                0 bytes
              </Heading>
              <Text fontSize="sm" color={textColor} fontWeight={500} mt={1}>
                Email Body Content Ever Read or Stored
              </Text>
            </Box>
          </SimpleGrid>
        </Container>
      </Box>

      {/* Features Grid */}
      <Container maxW="1100px" py={16}>
        <VStack spacing={3} textAlign="center" mb={12}>
          <Heading size="xl" color={headingColor}>
            Everything You Need for a Clean Inbox
          </Heading>
          <Text color={textColor}>
            Designed for privacy, speed, and safety.
          </Text>
        </VStack>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8}>
          {FEATURES.map((feat) => (
            <Card
              key={feat.title}
              bg={cardBg}
              borderRadius="2xl"
              border="1px solid"
              borderColor={borderCol}
              boxShadow="sm"
              _hover={{ boxShadow: 'md', borderColor: 'blue.400' }}
              transition="all 0.2s"
            >
              <CardBody p={8}>
                <Flex justify="space-between" align="start" mb={4}>
                  <Flex
                    w="48px"
                    h="48px"
                    borderRadius="xl"
                    bg="blue.50"
                    color="blue.500"
                    align="center"
                    justify="center"
                  >
                    <Icon as={feat.icon} boxSize={6} />
                  </Flex>
                  <Badge colorScheme="brand" borderRadius="full" px={3} py={1}>
                    {feat.badge}
                  </Badge>
                </Flex>

                <Heading size="md" mb={2} color={headingColor}>
                  {feat.title}
                </Heading>
                <Text color={textColor} fontSize="sm" lineHeight="tall">
                  {feat.description}
                </Text>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      </Container>

      {/* How It Works Section */}
      <Box bg={cardBg} py={16} borderY="1px solid" borderColor={borderCol}>
        <Container maxW="1000px">
          <VStack spacing={3} textAlign="center" mb={12}>
            <Heading size="xl" color={headingColor}>
              How EmailDiet Works
            </Heading>
            <Text color={textColor}>Three simple steps to take back control.</Text>
          </VStack>

          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8}>
            {STEPS.map((s) => (
              <Box key={s.number} textAlign="left" p={4}>
                <Text fontSize="4xl" fontWeight={900} color="blue.500" mb={2}>
                  {s.number}
                </Text>
                <Heading size="md" mb={2} color={headingColor}>
                  {s.title}
                </Heading>
                <Text fontSize="sm" color={textColor}>
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
          <Divider mb={8} borderColor={borderCol} />
          <Flex
            direction={{ base: 'column', md: 'row' }}
            justify="space-between"
            align="center"
            fontSize="xs"
            color={textColor}
          >
            <Text>&copy; {new Date().getFullYear()} EmailDiet. All rights reserved.</Text>
            <HStack spacing={6} mt={{ base: 4, md: 0 }}>
              <Box as="a" href="/privacy" _hover={{ color: 'blue.500' }}>
                Privacy Policy
              </Box>
              <Box as="a" href="/terms" _hover={{ color: 'blue.500' }}>
                Terms of Service
              </Box>
            </HStack>
          </Flex>
        </Container>
      </Box>
    </Box>
  )
}
