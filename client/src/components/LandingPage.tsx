import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
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
  Collapse,
  IconButton,
  Link,
} from '@chakra-ui/react'
import {
  Sparkles,
  HardDrive,
  ShieldCheck,
  Zap,
  MailCheck,
  ArrowRight,
  Lock,
  EyeOff,
  Star,
  Trash2,
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Mail,
  ArrowUpRight,
  Shield,
  CheckCircle,
} from 'lucide-react'

// Features list
const FEATURES = [
  {
    title: 'Bulk One-Click Unsubscribe',
    description:
      'Instantly unsubscribe from dozens of newsletters using standard RFC 8058 one-click headers. Block list managers and marketing spam in bulk.',
    icon: Zap,
    badge: 'Lightning Fast',
    color: '#22C55E',
  },
  {
    title: 'Smart Storage Reclaimer',
    description:
      'Visualize and clean up heavy attachments (>10MB) and old promotional blasts eating into your 15GB Google storage quota.',
    icon: HardDrive,
    badge: 'Space Optimization',
    color: '#3B82F6',
  },
  {
    title: 'Keep-Latest Retention Rules',
    description:
      'Retain only the newest updates or weekly digests from high-volume senders, auto-trashing historical clutter.',
    icon: MailCheck,
    badge: 'Smart Automation',
    color: '#EC4899',
  },
  {
    title: 'Safe & 100% Recoverable',
    description:
      'Never permanently deletes emails without explicit confirmation. Cleaned items go to Gmail Trash, allowing 30 days recovery.',
    icon: ShieldCheck,
    badge: 'Zero Risk',
    color: '#8B5CF6',
  },
]

// Testimonials data
const TESTIMONIALS = [
  {
    quote: "EmailDiet cleaned 14,000 marketing blasts from my Gmail in less than 3 minutes. I reclaimed 6GB of Google Drive space without losing single personal mail. Best utility of 2026.",
    author: "Sarah Jenkins",
    role: "Lead Designer at Vercel",
    avatar: "SJ",
  },
  {
    quote: "Finally a Gmail tool that doesn't read my emails! The metadata-only scanning is brilliant, and the keep-latest-N rule keeps my subscriptions organized automatically.",
    author: "Michael Chen",
    role: "Senior Engineering Manager",
    avatar: "MC",
  },
  {
    quote: "I was paying for Google One storage upgrades just because of my bloated inbox. EmailDiet saved me storage and money instantly. The UI feels like Stripe.",
    author: "Elena Rostova",
    role: "SaaS Founder",
    avatar: "ER",
  },
]

// Pricing plans
const PRICING = [
  {
    name: 'Free Trial',
    price: '$0',
    period: 'no credit card required',
    desc: 'Perfect to scan your mailbox and perform initial cleanup.',
    features: [
      'Scan up to 5,000 emails',
      'Unsubscribe from up to 10 senders',
      'Identify largest attachments',
      'Gmail Trash safety protection',
      'Secure AES-256 OAuth authentication',
    ],
    cta: 'Connect Gmail',
    popular: false,
  },
  {
    name: 'Premium Lifetime',
    price: '$29',
    period: 'one-time purchase',
    desc: 'Unlimited power for high-volume email users.',
    features: [
      'Unlimited scans & cleaning',
      'Unlimited bulk unsubscribes',
      'Full Storage Reclaimer drill-down',
      'Automated Keep-Latest retention rules',
      'Priority Weekly Digest scheduler',
      'Dedicated Protected Senders registry',
    ],
    cta: 'Upgrade to Premium',
    popular: true,
  },
]

// FAQs data
const FAQS = [
  {
    q: 'Does EmailDiet read the content of my emails?',
    a: 'Absolutely not. EmailDiet is built with strict privacy invariants. We scan only email metadata headers (Sender, Subject, Date, Size, and Unsubscribe links) locally in memory. We never read, process, or store your email body content.',
  },
  {
    q: 'Are my cleaning actions permanent?',
    a: 'No. By default, all cleaning actions (bulk unsubscribe, trash heavy senders, keep-latest-N) move messages to the standard Gmail TRASH folder. They remain recoverable for 30 days. The only exception is if you explicitly run the "Empty Trash" command inside the Storage tab.',
  },
  {
    q: 'How does the Keep-Latest retention rule work?',
    a: 'You can configure rules (e.g. Keep Latest 1 or 3) for specific newsletter domains. Our automated engine keeps only the newest received emails and cleanses older versions into the Trash, ensuring you only see current updates.',
  },
  {
    q: 'Is my Google Account token secure?',
    a: 'Yes, your OAuth credentials and access tokens are encrypted at-rest using authenticated AES-256-GCM encryption. We use secure HTTP-only cookies for session isolation.',
  },
]

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeTestimonial, setActiveTestimonial] = useState(0)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const [demoLoading, setDemoLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const handleDemoLogin = async () => {
    try {
      setDemoLoading(true)
      await api.demoLogin()
      window.location.reload()
    } catch (err) {
      console.error('Demo login failed:', err)
      setDemoLoading(false)
    }
  }

  // Autoplay testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % TESTIMONIALS.length)
    }, 4500)
    return () => clearInterval(interval)
  }, [])

  // Mouse Parallax Effect
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    setCoords({ x: x * 20, y: y * -20 })
  }

  const handleMouseLeave = () => {
    setCoords({ x: 0, y: 0 })
  }

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  return (
    <Box bg="#0B1320" minH="100vh" color="white" overflowX="hidden" fontFamily="Inter, sans-serif">
      
      {/* Background Gradient Glows */}
      <Box
        position="absolute"
        top="-10%"
        left="10%"
        w="50vw"
        h="50vw"
        borderRadius="full"
        bg="radial-gradient(circle, rgba(22, 163, 74, 0.08) 0%, rgba(59, 130, 246, 0.03) 70%, transparent 100%)"
        filter="blur(80px)"
        zIndex={0}
        pointerEvents="none"
      />
      <Box
        position="absolute"
        top="40%"
        right="-10%"
        w="40vw"
        h="40vw"
        borderRadius="full"
        bg="radial-gradient(circle, rgba(139, 92, 246, 0.06) 0%, rgba(236, 72, 153, 0.02) 60%, transparent 100%)"
        filter="blur(100px)"
        zIndex={0}
        pointerEvents="none"
      />

      {/* 1. Sticky Navigation */}
      <Box
        as="nav"
        position="sticky"
        top={0}
        zIndex={100}
        backdropFilter="blur(16px)"
        borderBottom="1px solid"
        borderColor="rgba(255, 255, 255, 0.08)"
        bg="rgba(11, 19, 32, 0.75)"
        py={4}
        transition="all 0.3s"
      >
        <Container maxW="1200px">
          <Flex align="center" justify="space-between">
            {/* Logo */}
            <HStack spacing={3} cursor="pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <Flex
                w="38px"
                h="38px"
                borderRadius="xl"
                bg="linear-gradient(135deg, #16A34A 0%, #22C55E 100%)"
                align="center"
                justify="center"
                boxShadow="0 4px 12px rgba(22, 163, 74, 0.3)"
              >
                <Icon as={Mail} boxSize={5} color="white" />
              </Flex>
              <Heading size="md" fontWeight={800} letterSpacing="-0.03em" bgGradient="linear(to-r, white, gray.300)" bgClip="text">
                EmailDiet
              </Heading>
            </HStack>

            {/* Links (Desktop) */}
            <HStack spacing={8} display={{ base: 'none', md: 'flex' }}>
              <Link href="#features" fontSize="14px" fontWeight={500} color="gray.400" _hover={{ color: 'white' }} transition="color 0.2s">Features</Link>
              <Link href="#how-it-works" fontSize="14px" fontWeight={500} color="gray.400" _hover={{ color: 'white' }} transition="color 0.2s">How it Works</Link>
              <Link href="#pricing" fontSize="14px" fontWeight={500} color="gray.400" _hover={{ color: 'white' }} transition="color 0.2s">Pricing</Link>
              <Link href="#security" fontSize="14px" fontWeight={500} color="gray.400" _hover={{ color: 'white' }} transition="color 0.2s">Security</Link>
              <Link href="#faq" fontSize="14px" fontWeight={500} color="gray.400" _hover={{ color: 'white' }} transition="color 0.2s">FAQ</Link>
            </HStack>

            {/* CTAs (Desktop) */}
            <HStack spacing={4} display={{ base: 'none', md: 'flex' }}>
              <Link href="/api/auth/login" fontSize="14px" fontWeight={600} color="gray.300" _hover={{ color: 'white' }}>
                Sign In
              </Link>
              <Link href="/api/auth/login" _hover={{ textDecoration: 'none' }}>
                <Button
                  size="sm"
                  px={5}
                  py={5}
                  bg="#16A34A"
                  color="white"
                  borderRadius="full"
                  fontWeight={600}
                  _hover={{ bg: '#22C55E', transform: 'translateY(-1px)', boxShadow: '0 4px 15px rgba(22, 197, 94, 0.4)' }}
                  transition="all 0.2s"
                >
                  Connect Gmail — Free
                </Button>
              </Link>
            </HStack>

            {/* Mobile Menu Toggle */}
            <IconButton
              display={{ base: 'flex', md: 'none' }}
              aria-label="Toggle Menu"
              icon={<Icon as={mobileMenuOpen ? X : Menu} boxSize={5} />}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              variant="ghost"
              color="white"
              _hover={{ bg: 'whiteAlpha.100' }}
            />
          </Flex>

          {/* Mobile Dropdown Menu */}
          <Collapse in={mobileMenuOpen} animateOpacity>
            <VStack spacing={4} align="stretch" mt={4} p={4} bg="rgba(11, 19, 32, 0.95)" borderRadius="xl" border="1px solid rgba(255,255,255,0.08)">
              <Link href="#features" onClick={() => setMobileMenuOpen(false)} py={1} color="gray.300">Features</Link>
              <Link href="#how-it-works" onClick={() => setMobileMenuOpen(false)} py={1} color="gray.300">How it Works</Link>
              <Link href="#pricing" onClick={() => setMobileMenuOpen(false)} py={1} color="gray.300">Pricing</Link>
              <Link href="#security" onClick={() => setMobileMenuOpen(false)} py={1} color="gray.300">Security</Link>
              <Link href="#faq" onClick={() => setMobileMenuOpen(false)} py={1} color="gray.300">FAQ</Link>
              <Divider borderColor="whiteAlpha.150" />
              <Flex justify="space-between" align="center" pt={2}>
                <Link href="/api/auth/login" fontWeight={600} color="gray.300">Sign In</Link>
                <Link href="/api/auth/login" _hover={{ textDecoration: 'none' }}>
                  <Button
                    size="sm"
                    bg="#16A34A"
                    color="white"
                    borderRadius="full"
                  >
                    Connect Gmail
                  </Button>
                </Link>
              </Flex>
            </VStack>
          </Collapse>
        </Container>
      </Box>

      {/* 2. Hero Section */}
      <Container maxW="1200px" pt={{ base: 12, md: 24 }} pb={{ base: 16, md: 28 }} position="relative" zIndex={1}>
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={{ base: 12, lg: 8 }} alignItems="center">
          
          {/* Hero Left Content */}
          <VStack align="flex-start" spacing={7} maxW={{ base: '100%', lg: '560px' }}>
            <Badge
              bg="rgba(22, 163, 74, 0.15)"
              color="#22C55E"
              border="1px solid rgba(34, 197, 94, 0.3)"
              px={3.5}
              py={1.5}
              borderRadius="full"
              fontSize="11px"
              fontWeight={700}
              letterSpacing="wider"
              textTransform="uppercase"
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
              lineHeight="1.1"
              letterSpacing="-0.04em"
              bgGradient="linear(to-r, white 60%, gray.400)"
              bgClip="text"
            >
              Put Your Gmail Inbox on a{' '}
              <Text as="span" bgGradient="linear(to-r, #22C55E, #3B82F6)" bgClip="text">
                High-Performance Diet
              </Text>
            </Heading>

            <Text fontSize={{ base: 'md', md: 'lg' }} color="gray.400" lineHeight="1.6" fontWeight={400}>
              Unsubscribe from newsletters in bulk, reclaim storage, organize your inbox, and stay safe—without reading email content or permanently deleting messages.
            </Text>

            <VStack align="stretch" w="100%" spacing={4}>
              <Flex direction={{ base: 'column', sm: 'row' }} gap={4}>
                <Link href="/api/auth/login" _hover={{ textDecoration: 'none' }}>
                  <Button
                    bg="linear-gradient(135deg, #16A34A 0%, #22C55E 100%)"
                    color="white"
                    size="lg"
                    h="60px"
                    px={8}
                    borderRadius="full"
                    fontSize="16px"
                    fontWeight={700}
                    boxShadow="0 8px 24px rgba(22, 163, 74, 0.35)"
                    rightIcon={<Icon as={ArrowRight} boxSize={5} />}
                    _hover={{ bg: '#22C55E', transform: 'translateY(-2px)', boxShadow: '0 12px 30px rgba(22, 197, 94, 0.5)' }}
                    transition="all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
                  >
                    <HStack spacing={3}>
                      <Box w={3} h={3} borderRadius="full" bg="white" position="relative" display="flex" alignItems="center" justifyContent="center">
                        <Box w={3} h={3} borderRadius="full" bg="white" position="absolute" opacity={0.6} />
                      </Box>
                      <Text>Connect Gmail — Free</Text>
                    </HStack>
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  borderColor="rgba(34, 197, 94, 0.4)"
                  color="#22C55E"
                  size="lg"
                  h="60px"
                  px={8}
                  borderRadius="full"
                  fontSize="16px"
                  fontWeight={700}
                  isLoading={demoLoading}
                  onClick={handleDemoLogin}
                  _hover={{ bg: 'rgba(34, 197, 94, 0.1)', borderColor: '#22C55E', transform: 'translateY(-2px)' }}
                  transition="all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
                >
                  ⚡ Enter Demo / Sandbox Mode
                </Button>
              </Flex>

              <HStack spacing={4} wrap="wrap" pt={1}>
                <HStack spacing={1.5} fontSize="12px" color="gray.500" fontWeight={600}>
                  <Icon as={CheckCircle} color="#22C55E" boxSize={3.5} />
                  <Text>Official Google OAuth</Text>
                </HStack>
                <HStack spacing={1.5} fontSize="12px" color="gray.500" fontWeight={600}>
                  <Icon as={Lock} color="#3B82F6" boxSize={3.5} />
                  <Text>AES-256 Encryption</Text>
                </HStack>
                <HStack spacing={1.5} fontSize="12px" color="gray.500" fontWeight={600}>
                  <Icon as={Trash2} color="#EC4899" boxSize={3.5} />
                  <Text>Zero Permanent Deletion</Text>
                </HStack>
              </HStack>
            </VStack>
          </VStack>

          {/* Hero Right Content: 3D Parallax Glass Dashboard */}
          <Flex
            justify="center"
            align="center"
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ perspective: '1000px' }}
          >
            <Box
              w="100%"
              maxW="480px"
              bg="rgba(15, 23, 42, 0.45)"
              border="1px solid"
              borderColor="rgba(255, 255, 255, 0.08)"
              borderRadius="24px"
              boxShadow="0 30px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
              backdropFilter="blur(16px)"
              p={6}
              transform={`rotateY(${coords.x}deg) rotateX(${coords.y}deg)`}
              transition="transform 0.15s ease-out"
              position="relative"
            >
              {/* Floating Gmail Icon */}
              <Flex
                position="absolute"
                top="-15px"
                right="-15px"
                w="50px"
                h="50px"
                bg="rgba(30, 41, 59, 0.8)"
                borderRadius="14px"
                border="1px solid rgba(255,255,255,0.1)"
                align="center"
                justify="center"
                boxShadow="lg"
              >
                <Icon as={Mail} boxSize={6} color="#EF4444" />
              </Flex>

              {/* Header Window Buttons */}
              <HStack justify="space-between" mb={6}>
                <HStack spacing={2}>
                  <Box w={3} h={3} borderRadius="full" bg="#EF4444" />
                  <Box w={3} h={3} borderRadius="full" bg="#F59E0B" />
                  <Box w={3} h={3} borderRadius="full" bg="#22C55E" />
                  <Text fontSize="11px" color="gray.500" fontWeight={600} ml={2}>EmailDiet v2.0</Text>
                </HStack>
                <Badge bg="rgba(34, 197, 94, 0.15)" color="#22C55E" fontSize="10px" borderRadius="full" px={2.5} py={0.5}>
                  Scanning Complete
                </Badge>
              </HStack>

              {/* Core Metrics */}
              <SimpleGrid columns={2} spacing={4} mb={6}>
                <Box bg="rgba(255,255,255,0.02)" p={4} borderRadius="16px" border="1px solid rgba(255,255,255,0.04)">
                  <Text fontSize="10px" color="gray.500" fontWeight={700} letterSpacing="wider" textTransform="uppercase">Mailbox Health</Text>
                  <Heading size="md" color="white" mt={1}>98.4%</Heading>
                  <Text fontSize="9px" color="#22C55E" mt={0.5} fontWeight={600}>Excellent Score</Text>
                </Box>
                <Box bg="rgba(255,255,255,0.02)" p={4} borderRadius="16px" border="1px solid rgba(255,255,255,0.04)">
                  <Text fontSize="10px" color="gray.500" fontWeight={700} letterSpacing="wider" textTransform="uppercase">Space Saved</Text>
                  <Heading size="md" color="white" mt={1}>4.2 GB</Heading>
                  <Text fontSize="9px" color="#3B82F6" mt={0.5} fontWeight={600}>1,840 large emails</Text>
                </Box>
              </SimpleGrid>

              {/* Custom Storage Segment Bar */}
              <Box bg="rgba(255,255,255,0.02)" p={4} borderRadius="16px" border="1px solid rgba(255,255,255,0.04)" mb={5}>
                <Flex justify="space-between" align="center" mb={2}>
                  <Text fontSize="10px" color="gray.500" fontWeight={700} letterSpacing="wider" textTransform="uppercase">Storage Breakdown</Text>
                  <Text fontSize="10px" color="gray.400" fontWeight={600}>15 GB total</Text>
                </Flex>
                {/* Horizontal Bar */}
                <Flex h="8px" bg="rgba(255,255,255,0.08)" borderRadius="full" overflow="hidden" mb={2}>
                  <Box w="30%" bg="#EF4444" />
                  <Box w="25%" bg="#3B82F6" />
                  <Box w="15%" bg="#EC4899" />
                  <Box w="10%" bg="#8B5CF6" />
                </Flex>
                <HStack spacing={3} wrap="wrap" fontSize="9px" color="gray.400">
                  <HStack spacing={1}><Box w={1.5} h={1.5} borderRadius="full" bg="#EF4444" /><Text>Large Files (30%)</Text></HStack>
                  <HStack spacing={1}><Box w={1.5} h={1.5} borderRadius="full" bg="#3B82F6" /><Text>Promos (25%)</Text></HStack>
                  <HStack spacing={1}><Box w={1.5} h={1.5} borderRadius="full" bg="#EC4899" /><Text>Updates (15%)</Text></HStack>
                </HStack>
              </Box>

              {/* Simulated Notification Row */}
              <Flex
                align="center"
                justify="space-between"
                bg="rgba(22, 163, 74, 0.08)"
                border="1px solid rgba(34, 197, 94, 0.2)"
                p={3.5}
                borderRadius="14px"
              >
                <HStack spacing={2.5}>
                  <Flex w={7} h={7} borderRadius="full" bg="#16A34A" align="center" justify="center">
                    <Icon as={ShieldCheck} boxSize={4} color="white" />
                  </Flex>
                  <Box>
                    <Text fontSize="11px" fontWeight={700} color="white">Secure Scan Baseline Set</Text>
                    <Text fontSize="9px" color="gray.400">128 newsletters mapped safely</Text>
                  </Box>
                </HStack>
                <Icon as={ArrowUpRight} boxSize={4} color="gray.400" />
              </Flex>

            </Box>
          </Flex>

        </SimpleGrid>
      </Container>

      {/* 3. Trust & Security Bar */}
      <Box
        borderY="1px solid"
        borderColor="rgba(255, 255, 255, 0.08)"
        bg="rgba(255,255,255,0.01)"
        py={10}
        position="relative"
        zIndex={1}
      >
        <Container maxW="1100px">
          <SimpleGrid columns={{ base: 2, lg: 4 }} spacing={{ base: 6, lg: 4 }} textAlign="center">
            
            <Box p={3} transition="transform 0.2s" _hover={{ transform: 'translateY(-2px)' }} role="group">
              <Icon as={Trash2} color="#22C55E" boxSize={6} mb={2.5} transition="all 0.2s" _groupHover={{ transform: 'scale(1.1)' }} />
              <Heading size="xs" color="white" fontWeight={700}>100% Recoverable</Heading>
              <Text fontSize="11px" color="gray.400" mt={1}>Items sit safely in Gmail Trash</Text>
            </Box>

            <Box p={3} transition="transform 0.2s" _hover={{ transform: 'translateY(-2px)' }} role="group">
              <Icon as={Lock} color="#3B82F6" boxSize={6} mb={2.5} transition="all 0.2s" _groupHover={{ transform: 'scale(1.1)' }} />
              <Heading size="xs" color="white" fontWeight={700}>AES-256 Encryption</Heading>
              <Text fontSize="11px" color="gray.400" mt={1}>OAuth tokens encrypted at rest</Text>
            </Box>

            <Box p={3} transition="transform 0.2s" _hover={{ transform: 'translateY(-2px)' }} role="group">
              <Icon as={EyeOff} color="#EC4899" boxSize={6} mb={2.5} transition="all 0.2s" _groupHover={{ transform: 'scale(1.1)' }} />
              <Heading size="xs" color="white" fontWeight={700}>Zero Body Stored</Heading>
              <Text fontSize="11px" color="gray.400" mt={1}>Metadata-only scanning logic</Text>
            </Box>

            <Box p={3} transition="transform 0.2s" _hover={{ transform: 'translateY(-2px)' }} role="group">
              <Icon as={Shield} color="#8B5CF6" boxSize={6} mb={2.5} transition="all 0.2s" _groupHover={{ transform: 'scale(1.1)' }} />
              <Heading size="xs" color="white" fontWeight={700}>Official Google OAuth</Heading>
              <Text fontSize="11px" color="gray.400" mt={1}>Secure authentication scopes</Text>
            </Box>

          </SimpleGrid>
        </Container>
      </Box>

      {/* 4. Features Grid */}
      <Container maxW="1200px" py={{ base: 16, md: 24 }} id="features" position="relative" zIndex={1}>
        <VStack spacing={3} textAlign="center" mb={14}>
          <Badge bg="rgba(59, 130, 246, 0.15)" color="#3B82F6" px={3} py={1} borderRadius="full" fontSize="10px" fontWeight={700} letterSpacing="wider" textTransform="uppercase">
            Built for Power Users
          </Badge>
          <Heading as="h2" size="xl" fontWeight={800} letterSpacing="-0.03em" bgGradient="linear(to-r, white, gray.300)" bgClip="text">
            Everything You Need for a Clean Inbox
          </Heading>
          <Text color="gray.400" maxW="580px" fontSize="15px">
            Reclaim storage, unsubscribe from unwanted senders, and configure automatic retention filters under a single dashboard.
          </Text>
        </VStack>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          {FEATURES.map((feat) => (
            <Card
              key={feat.title}
              bg="rgba(15, 23, 42, 0.35)"
              border="1px solid"
              borderColor="rgba(255, 255, 255, 0.06)"
              borderRadius="24px"
              boxShadow="0 10px 30px rgba(0, 0, 0, 0.2)"
              backdropFilter="blur(12px)"
              transition="all 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
              _hover={{
                transform: 'translateY(-4px)',
                borderColor: `${feat.color}40`,
                boxShadow: `0 20px 40px rgba(0, 0, 0, 0.3), 0 0 20px ${feat.color}15`,
              }}
            >
              <CardBody p={8}>
                <Flex justify="space-between" align="center" mb={6}>
                  <Flex
                    w="48px"
                    h="48px"
                    borderRadius="16px"
                    bg={`rgba(${feat.color === '#22C55E' ? '34, 197, 94' : feat.color === '#3B82F6' ? '59, 130, 246' : feat.color === '#EC4899' ? '236, 72, 153' : '139, 92, 246'}, 0.12)`}
                    color={feat.color}
                    align="center"
                    justify="center"
                  >
                    <Icon as={feat.icon} boxSize={6} />
                  </Flex>
                  <Badge
                    bg={`rgba(${feat.color === '#22C55E' ? '34, 197, 94' : feat.color === '#3B82F6' ? '59, 130, 246' : feat.color === '#EC4899' ? '236, 72, 153' : '139, 92, 246'}, 0.15)`}
                    color={feat.color}
                    borderRadius="full"
                    px={3.5}
                    py={1}
                    fontSize="10px"
                    fontWeight={700}
                  >
                    {feat.badge}
                  </Badge>
                </Flex>
                <Heading size="md" mb={2.5} color="white" fontWeight={700} letterSpacing="-0.02em">
                  {feat.title}
                </Heading>
                <Text color="gray.400" fontSize="14px" lineHeight="1.6">
                  {feat.description}
                </Text>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      </Container>

      {/* 5. How It Works (Timeline) */}
      <Box
        bg="rgba(11, 19, 32, 0.4)"
        borderY="1px solid"
        borderColor="rgba(255, 255, 255, 0.08)"
        py={{ base: 16, md: 24 }}
        id="how-it-works"
        position="relative"
        zIndex={1}
      >
        <Container maxW="1000px">
          <VStack spacing={3} textAlign="center" mb={16}>
            <Badge bg="rgba(139, 92, 246, 0.15)" color="#8B5CF6" px={3} py={1} borderRadius="full" fontSize="10px" fontWeight={700} letterSpacing="wider" textTransform="uppercase">
              Simple Setup
            </Badge>
            <Heading as="h2" size="xl" fontWeight={800} letterSpacing="-0.03em" color="white">
              Unclutter in Under 60 Seconds
            </Heading>
            <Text color="gray.400" maxW="500px" fontSize="14px">
              Three simple steps to optimize your mailbox storage and reclaim focus.
            </Text>
          </VStack>

          {/* Stepper Timeline Grid */}
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={{ base: 8, md: 10 }} position="relative">
            
            {/* Step 1 */}
            <Box position="relative">
              <VStack align="flex-start" spacing={4} bg="rgba(255,255,255,0.01)" p={6} borderRadius="20px" border="1px solid rgba(255,255,255,0.05)" h="100%">
                <Flex w="40px" h="40px" bg="#16A34A" color="white" align="center" justify="center" borderRadius="full" fontWeight={800} fontSize="sm">
                  1
                </Flex>
                <Heading size="sm" color="white" fontWeight={700}>Connect Securely</Heading>
                <Text fontSize="13px" color="gray.400" lineHeight="1.6">
                  Sign in with standard Google OAuth. Your tokens are fully encrypted at rest with AES-256-GCM.
                </Text>
              </VStack>
            </Box>

            {/* Step 2 */}
            <Box position="relative">
              <VStack align="flex-start" spacing={4} bg="rgba(255,255,255,0.01)" p={6} borderRadius="20px" border="1px solid rgba(255,255,255,0.05)" h="100%">
                <Flex w="40px" h="40px" bg="#3B82F6" color="white" align="center" justify="center" borderRadius="full" fontWeight={800} fontSize="sm">
                  2
                </Flex>
                <Heading size="sm" color="white" fontWeight={700}>Scan Mailbox Metadata</Heading>
                <Text fontSize="13px" color="gray.400" lineHeight="1.6">
                  EmailDiet scans metadata headers locally in-memory. We never read or store your email body content.
                </Text>
              </VStack>
            </Box>

            {/* Step 3 */}
            <Box position="relative">
              <VStack align="flex-start" spacing={4} bg="rgba(255,255,255,0.01)" p={6} borderRadius="20px" border="1px solid rgba(255,255,255,0.05)" h="100%">
                <Flex w="40px" h="40px" bg="#EC4899" color="white" align="center" justify="center" borderRadius="full" fontWeight={800} fontSize="sm">
                  3
                </Flex>
                <Heading size="sm" color="white" fontWeight={700}>Clean & Optimize</Heading>
                <Text fontSize="13px" color="gray.400" lineHeight="1.6">
                  Bulk unsubscribe from junk, reclaim gigabytes of bloated files, and set auto-cleaning rules.
                </Text>
              </VStack>
            </Box>

          </SimpleGrid>
        </Container>
      </Box>

      {/* 6. Social Proof & Testimonial Carousel */}
      <Container maxW="1100px" py={{ base: 16, md: 24 }} position="relative" zIndex={1}>
        <SimpleGrid columns={{ base: 2, lg: 4 }} spacing={6} mb={16}>
          <Box p={6} bg="rgba(255,255,255,0.01)" borderRadius="20px" border="1px solid rgba(255,255,255,0.04)" textAlign="center">
            <Heading size="lg" color="#22C55E" fontWeight={900}>1M+</Heading>
            <Text fontSize="12px" color="gray.500" fontWeight={600} mt={1}>Emails Cleaned</Text>
          </Box>
          <Box p={6} bg="rgba(255,255,255,0.01)" borderRadius="20px" border="1px solid rgba(255,255,255,0.04)" textAlign="center">
            <Heading size="lg" color="#3B82F6" fontWeight={900}>20K+</Heading>
            <Text fontSize="12px" color="gray.500" fontWeight={600} mt={1}>Happy Users</Text>
          </Box>
          <Box p={6} bg="rgba(255,255,255,0.01)" borderRadius="20px" border="1px solid rgba(255,255,255,0.04)" textAlign="center">
            <Heading size="lg" color="#EC4899" fontWeight={900}>4.8/5</Heading>
            <Text fontSize="12px" color="gray.500" fontWeight={600} mt={1}>User Rating</Text>
          </Box>
          <Box p={6} bg="rgba(255,255,255,0.01)" borderRadius="20px" border="1px solid rgba(255,255,255,0.04)" textAlign="center">
            <Heading size="lg" color="#8B5CF6" fontWeight={900}>12TB+</Heading>
            <Text fontSize="12px" color="gray.500" fontWeight={600} mt={1}>Storage Reclaimed</Text>
          </Box>
        </SimpleGrid>

        {/* Testimonials Carousel Slider */}
        <Flex justify="center">
          <Box
            w="100%"
            maxW="650px"
            bg="rgba(15, 23, 42, 0.4)"
            border="1px solid rgba(255, 255, 255, 0.08)"
            borderRadius="24px"
            p={{ base: 6, md: 8 }}
            boxShadow="xl"
            textAlign="center"
            position="relative"
            minH="220px"
            display="flex"
            flexDir="column"
            justifyContent="center"
          >
            <HStack justify="center" spacing={1} mb={4}>
              {[...Array(5)].map((_, i) => (
                <Icon key={i} as={Star} color="#F59E0B" fill="#F59E0B" boxSize={4} />
              ))}
            </HStack>
            
            {/* Quote content with animation trigger */}
            <Text fontSize={{ base: '14px', md: '16px' }} color="gray.200" fontStyle="italic" lineHeight="1.6" mb={6}>
              "{TESTIMONIALS[activeTestimonial].quote}"
            </Text>

            <HStack spacing={3} justify="center">
              <Flex w={9} h={9} borderRadius="full" bg="brand.500" align="center" justify="center" fontWeight={800} fontSize="xs" color="white">
                {TESTIMONIALS[activeTestimonial].avatar}
              </Flex>
              <Box textAlign="left">
                <Text fontSize="13px" fontWeight={700} color="white">{TESTIMONIALS[activeTestimonial].author}</Text>
                <Text fontSize="11px" color="gray.500" fontWeight={500}>{TESTIMONIALS[activeTestimonial].role}</Text>
              </Box>
            </HStack>

            {/* Dots */}
            <HStack spacing={2} justify="center" mt={6}>
              {TESTIMONIALS.map((_, idx) => (
                <Box
                  key={idx}
                  w={1.5}
                  h={1.5}
                  borderRadius="full"
                  bg={activeTestimonial === idx ? '#22C55E' : 'rgba(255,255,255,0.2)'}
                  cursor="pointer"
                  onClick={() => setActiveTestimonial(idx)}
                  transition="all 0.2s"
                />
              ))}
            </HStack>
          </Box>
        </Flex>
      </Container>

      {/* 7. Pricing Section */}
      <Box
        bg="rgba(11, 19, 32, 0.4)"
        borderY="1px solid"
        borderColor="rgba(255, 255, 255, 0.08)"
        py={{ base: 16, md: 24 }}
        id="pricing"
        position="relative"
        zIndex={1}
      >
        <Container maxW="1000px">
          <VStack spacing={3} textAlign="center" mb={14}>
            <Badge bg="rgba(34, 197, 94, 0.15)" color="#22C55E" px={3} py={1} borderRadius="full" fontSize="10px" fontWeight={700} letterSpacing="wider" textTransform="uppercase">
              Transparent Pricing
            </Badge>
            <Heading as="h2" size="xl" fontWeight={800} color="white">
              Flexible Plans for Every Mailbox
            </Heading>
            <Text color="gray.400" maxW="450px" fontSize="14px">
              Start reclaiming your Gmail storage completely free, upgrade only when you need full automation.
            </Text>
          </VStack>

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8} maxW="800px" mx="auto">
            {PRICING.map((plan) => (
              <Box
                key={plan.name}
                bg={plan.popular ? 'rgba(22, 163, 74, 0.05)' : 'rgba(15, 23, 42, 0.4)'}
                border="1px solid"
                borderColor={plan.popular ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.08)'}
                borderRadius="24px"
                p={8}
                position="relative"
                boxShadow={plan.popular ? '0 15px 35px rgba(22, 163, 74, 0.1)' : 'lg'}
              >
                {plan.popular && (
                  <Badge
                    position="absolute"
                    top="-12px"
                    right="24px"
                    bg="#16A34A"
                    color="white"
                    borderRadius="full"
                    px={3}
                    py={0.5}
                    fontSize="9px"
                    fontWeight={800}
                  >
                    POPULAR Choice
                  </Badge>
                )}
                <Text fontSize="15px" fontWeight={800} color={plan.popular ? '#22C55E' : 'white'}>{plan.name}</Text>
                <Flex align="baseline" mt={4} mb={1}>
                  <Text fontSize="36px" fontWeight={900} color="white">{plan.price}</Text>
                  <Text fontSize="12px" color="gray.500" ml={2} fontWeight={600}>{plan.period}</Text>
                </Flex>
                <Text fontSize="13px" color="gray.400" mb={6}>{plan.desc}</Text>
                <Divider borderColor="rgba(255,255,255,0.08)" mb={6} />
                <VStack align="stretch" spacing={3.5} mb={8}>
                  {plan.features.map((feat) => (
                    <HStack key={feat} spacing={2.5}>
                      <Icon as={CheckCircle} color={plan.popular ? '#22C55E' : 'gray.400'} boxSize={4} />
                      <Text fontSize="13px" color="gray.300">{feat}</Text>
                    </HStack>
                  ))}
                </VStack>
                <Link href="/api/auth/login" w="100%" _hover={{ textDecoration: 'none' }}>
                  <Button
                    w="100%"
                    size="lg"
                    bg={plan.popular ? '#16A34A' : 'rgba(255, 255, 255, 0.06)'}
                    color="white"
                    borderRadius="full"
                    fontSize="14px"
                    fontWeight={700}
                    _hover={{ bg: plan.popular ? '#22C55E' : 'rgba(255, 255, 255, 0.12)' }}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </Box>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* 8. FAQ Section */}
      <Container maxW="800px" py={{ base: 16, md: 24 }} id="faq" position="relative" zIndex={1}>
        <VStack spacing={3} textAlign="center" mb={14}>
          <Badge bg="rgba(59, 130, 246, 0.15)" color="#3B82F6" px={3} py={1} borderRadius="full" fontSize="10px" fontWeight={700} letterSpacing="wider" textTransform="uppercase">
            Common Inquiries
          </Badge>
          <Heading as="h2" size="xl" fontWeight={800} color="white">
            Frequently Asked Questions
          </Heading>
          <Text color="gray.400" fontSize="14px">
            Have questions about security, privacy, or functionality? We have answers.
          </Text>
        </VStack>

        <VStack spacing={4} align="stretch">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx
            return (
              <Box
                key={idx}
                bg="rgba(15, 23, 42, 0.3)"
                border="1px solid"
                borderColor={isOpen ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.06)'}
                borderRadius="18px"
                p={5}
                cursor="pointer"
                onClick={() => toggleFaq(idx)}
                transition="all 0.25s"
                _hover={{ borderColor: isOpen ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.15)' }}
              >
                <Flex justify="space-between" align="center">
                  <HStack spacing={3}>
                    <Icon as={HelpCircle} color={isOpen ? '#22C55E' : 'gray.500'} boxSize={4.5} />
                    <Text fontSize="14px" fontWeight={700} color="white">{faq.q}</Text>
                  </HStack>
                  <Icon as={isOpen ? ChevronUp : ChevronDown} color="gray.500" boxSize={4} />
                </Flex>
                <Collapse in={isOpen} animateOpacity>
                  <Text fontSize="13px" color="gray.400" mt={3.5} lineHeight="1.6" pl="30px">
                    {faq.a}
                  </Text>
                </Collapse>
              </Box>
            )
          })}
        </VStack>
      </Container>

      {/* 9. Security Section */}
      <Box
        bg="rgba(11, 19, 32, 0.4)"
        borderY="1px solid"
        borderColor="rgba(255, 255, 255, 0.08)"
        py={{ base: 16, md: 24 }}
        id="security"
        position="relative"
        zIndex={1}
      >
        <Container maxW="900px">
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={12} alignItems="center">
            <VStack align="flex-start" spacing={5}>
              <Badge bg="rgba(236, 72, 153, 0.15)" color="#EC4899" px={3} py={1} borderRadius="full" fontSize="10px" fontWeight={700} letterSpacing="wider" textTransform="uppercase">
                Security-First Design
              </Badge>
              <Heading size="lg" fontWeight={800} color="white">
                Your Email Data Never Leaves Gmail
              </Heading>
              <Text fontSize="14px" color="gray.400" lineHeight="1.6">
                Unlike traditional unsubscribers that ingest, store, and monetize your mailbox content, EmailDiet operates strictly on metadata headers.
              </Text>
              <VStack align="stretch" spacing={3} pt={2}>
                <HStack spacing={3}>
                  <Icon as={ShieldCheck} color="#22C55E" boxSize={5} />
                  <Text fontSize="13px" color="gray.200" fontWeight={600}>No Email Bodies Read or Cached</Text>
                </HStack>
                <HStack spacing={3}>
                  <Icon as={ShieldCheck} color="#22C55E" boxSize={5} />
                  <Text fontSize="13px" color="gray.200" fontWeight={600}>Encrypted Token Storage (AES-256-GCM)</Text>
                </HStack>
                <HStack spacing={3}>
                  <Icon as={ShieldCheck} color="#22C55E" boxSize={5} />
                  <Text fontSize="13px" color="gray.200" fontWeight={600}>SSRF loopback protection rules active</Text>
                </HStack>
              </VStack>
            </VStack>
            <Flex justify="center" align="center">
              <Box position="relative" p={8} bg="rgba(15, 23, 42, 0.4)" border="1px solid rgba(255,255,255,0.06)" borderRadius="24px" boxShadow="lg" textAlign="center" w="100%" maxW="340px">
                <Flex w={16} h={16} bg="rgba(34, 197, 94, 0.1)" borderRadius="full" align="center" justify="center" mx="auto" mb={4}>
                  <Icon as={Lock} color="#22C55E" boxSize={8} />
                </Flex>
                <Heading size="sm" color="white" mb={1} fontWeight={700}>AES-256-GCM</Heading>
                <Text fontSize="11px" color="gray.500" mb={4} fontWeight={600}>NIST SP 800-38D Compliant</Text>
                <Badge variant="subtle" colorScheme="green" borderRadius="full" px={3} py={1} fontSize="10px">
                  Verified At-Rest Security
                </Badge>
              </Box>
            </Flex>
          </SimpleGrid>
        </Container>
      </Box>

      {/* 10. Final CTA Panel */}
      <Container maxW="1000px" py={{ base: 16, md: 24 }} position="relative" zIndex={1}>
        <Box
          bg="linear-gradient(135deg, rgba(22, 163, 74, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)"
          border="1px solid"
          borderColor="rgba(255,255,255,0.08)"
          borderRadius="32px"
          p={{ base: 8, md: 16 }}
          textAlign="center"
          position="relative"
          overflow="hidden"
          boxShadow="2xl"
        >
          {/* Inner Glowing Orb */}
          <Box
            position="absolute"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            w="250px"
            h="250px"
            borderRadius="full"
            bg="radial-gradient(circle, rgba(34, 197, 94, 0.15) 0%, transparent 70%)"
            filter="blur(30px)"
            zIndex={0}
            pointerEvents="none"
          />

          <VStack spacing={6} position="relative" zIndex={1}>
            <Flex w={14} h={14} bg="rgba(34,197,94,0.15)" border="1px solid rgba(34,197,94,0.3)" borderRadius="full" align="center" justify="center" mb={2}>
              <Icon as={ShieldCheck} color="#22C55E" boxSize={7} />
            </Flex>

            <Heading as="h2" fontSize={{ base: '2xl', md: '4xl' }} fontWeight={800} letterSpacing="-0.03em" color="white" maxW="600px">
              Ready to Transform Your Inbox?
            </Heading>

            <Text color="gray.400" fontSize="15px" maxW="480px">
              Join thousands of users keeping Gmail clean, organized, and protected without losing storage or peace of mind.
            </Text>

            <Link href="/api/auth/login" _hover={{ textDecoration: 'none' }}>
              <Button
                bg="linear-gradient(135deg, #16A34A 0%, #22C55E 100%)"
                color="white"
                size="lg"
                h="54px"
                px={8}
                borderRadius="full"
                fontSize="15px"
                fontWeight={700}
                boxShadow="0 6px 20px rgba(22, 163, 74, 0.3)"
                rightIcon={<Icon as={ArrowRight} boxSize={4} />}
                _hover={{ bg: '#22C55E', transform: 'translateY(-1px)', boxShadow: '0 10px 25px rgba(22, 197, 94, 0.4)' }}
              >
                Connect Gmail — Free
              </Button>
            </Link>
          </VStack>
        </Box>
      </Container>

      {/* 11. Footer */}
      <Box
        borderTop="1px solid"
        borderColor="rgba(255, 255, 255, 0.08)"
        bg="rgba(11,19,32,0.8)"
        py={16}
        position="relative"
        zIndex={1}
      >
        <Container maxW="1100px">
          <SimpleGrid columns={{ base: 2, md: 5 }} spacing={8} mb={12}>
            
            {/* Brand Column */}
            <VStack align="flex-start" spacing={4}>
              <HStack spacing={2.5}>
                <Flex w="30px" h="30px" borderRadius="lg" bg="#16A34A" align="center" justify="center">
                  <Icon as={Mail} boxSize={4} color="white" />
                </Flex>
                <Heading size="xs" fontWeight={800} color="white">EmailDiet</Heading>
              </HStack>
              <Text fontSize="12px" color="gray.500" maxW="200px" lineHeight="1.6">
                Put your Gmail inbox on a high-performance diet. Clean spam, restore storage, stay private.
              </Text>
            </VStack>

            {/* Product Column */}
            <VStack align="flex-start" spacing={3}>
              <Text fontSize="11px" fontWeight={800} color="white" letterSpacing="wider" textTransform="uppercase">Product</Text>
              <Link href="#features" fontSize="12px" color="gray.500" _hover={{ color: 'white' }}>Unsubscriber</Link>
              <Link href="#features" fontSize="12px" color="gray.500" _hover={{ color: 'white' }}>Storage Reclaimer</Link>
              <Link href="#pricing" fontSize="12px" color="gray.500" _hover={{ color: 'white' }}>Pricing Plans</Link>
            </VStack>

            {/* Resources Column */}
            <VStack align="flex-start" spacing={3}>
              <Text fontSize="11px" fontWeight={800} color="white" letterSpacing="wider" textTransform="uppercase">Resources</Text>
              <Link href="#faq" fontSize="12px" color="gray.500" _hover={{ color: 'white' }}>Help Center</Link>
              <Link href="#faq" fontSize="12px" color="gray.500" _hover={{ color: 'white' }}>Security Center</Link>
              <Link href="#faq" fontSize="12px" color="gray.500" _hover={{ color: 'white' }}>FAQ Documentation</Link>
            </VStack>

            {/* Company Column */}
            <VStack align="flex-start" spacing={3}>
              <Text fontSize="11px" fontWeight={800} color="white" letterSpacing="wider" textTransform="uppercase">Company</Text>
              <Link href="#features" fontSize="12px" color="gray.500" _hover={{ color: 'white' }}>About Us</Link>
              <Link href="#features" fontSize="12px" color="gray.500" _hover={{ color: 'white' }}>Privacy Practices</Link>
              <Link href="#features" fontSize="12px" color="gray.500" _hover={{ color: 'white' }}>Contact Support</Link>
            </VStack>

          </SimpleGrid>

          <Divider borderColor="rgba(255,255,255,0.06)" mb={8} />

          <Flex direction={{ base: 'column', md: 'row' }} justify="space-between" align="center" fontSize="11px" color="gray.500">
            <Text>&copy; {new Date().getFullYear()} EmailDiet. All rights reserved.</Text>
            <HStack spacing={6} mt={{ base: 4, md: 0 }}>
              <Link href="/privacy" _hover={{ color: 'white' }}>Privacy Policy</Link>
              <Link href="/terms" _hover={{ color: 'white' }}>Terms of Service</Link>
              <Link href="/security" _hover={{ color: 'white' }}>Security Standard</Link>
            </HStack>
          </Flex>
        </Container>
      </Box>

    </Box>
  )
}
