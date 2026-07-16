import { useState } from 'react'
import { Flex, Card, VStack, HStack, Heading, Text, Button, Box, Image, Link } from '@chakra-ui/react'
import { StarIcon } from '@chakra-ui/icons'
import { api } from '../api'

const FEATURES = [
  { icon: '🧹', label: 'Bulk unsubscribe from marketing mail' },
  { icon: '🏷️', label: 'Auto-label senders by category' },
  { icon: '🛡️', label: 'Protect important senders from actions' },
  { icon: '💾', label: 'Reclaim storage from large emails' },
]

export default function ConnectScreen() {
  const [demoLoading, setDemoLoading] = useState(false)

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

  return (
    <Flex minH="100vh" align="center" justify="center" p={{ base: 4, sm: 8 }} bg="bg.muted">
      <Card maxW="480px" w="100%" p={{ base: 6, sm: 8 }} textAlign="center" borderRadius="xl" boxShadow="sm">
        <VStack spacing={6}>
          <Flex w="64px" h="64px" borderRadius="16px" bg="white" align="center" justify="center" boxShadow="md" overflow="hidden">
            <Image src="/logo.png" alt="EmailDiet Logo" w="100%" h="100%" objectFit="cover" />
          </Flex>

          <Box>
            <Heading size="lg" mb={2} color="text.primary">EmailDiet</Heading>
            <Text color="text.secondary">
              Take back control of your Gmail inbox. Unsubscribe in bulk, organise with labels, and free up storage.
            </Text>
          </Box>

          <VStack spacing={4} align="stretch" w="full" textAlign="left">
            {FEATURES.map(f => (
              <HStack key={f.label} spacing={4}>
                <Text fontSize="xl">{f.icon}</Text>
                <Text color="text.primary" fontWeight={500}>{f.label}</Text>
              </HStack>
            ))}
          </VStack>

          <Link href="/api/auth/login" width="full" _hover={{ textDecoration: 'none' }}>
            <Button
              colorScheme="brand"
              size="lg"
              width="full"
              leftIcon={<StarIcon />}
              py={6}
            >
              Sign in with Google
            </Button>
          </Link>

          <Button
            variant="outline"
            colorScheme="teal"
            size="lg"
            width="full"
            py={6}
            isLoading={demoLoading}
            onClick={handleDemoLogin}
          >
            ⚡ Enter Demo / Sandbox Mode
          </Button>

          <Text fontSize="xs" color="text.secondary">
            While in Google Testing mode, sessions expire after ~7 days.<br />
            Nothing is deleted permanently — Trash is always recoverable.
          </Text>
        </VStack>
      </Card>
      
      <Flex position="absolute" bottom={4} w="full" justify="center">
        <Text fontSize="sm" color="text.tertiary">
          &copy; {new Date().getFullYear()} EmailDiet. All rights reserved.
        </Text>
      </Flex>
    </Flex>
  )
}
