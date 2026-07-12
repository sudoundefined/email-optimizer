import React, { useState, useEffect } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  Box,
  Flex,
  Text,
  Button,
  Icon,
  HStack,
  VStack,
  Progress,
  Grid,
} from '@chakra-ui/react'
import {
  CheckCircle2,
  StopCircle,
  Lightbulb,
  Clock,
  Trash2,
  Sparkles,
} from 'lucide-react'

export interface SmartCleanupModalProps {
  isOpen: boolean
  onClose: () => void
  jobId?: string | null
  initialFound?: number
  onStopJob?: () => void
}

export const SmartCleanupModal: React.FC<SmartCleanupModalProps> = ({
  isOpen,
  onClose,
  initialFound = 824,
  onStopJob,
}) => {
  const [progress, setProgress] = useState(72)
  const [emailsCleaned, setEmailsCleaned] = useState(593)
  const [elapsedSeconds, setElapsedSeconds] = useState(108) // 01:48

  useEffect(() => {
    if (!isOpen) return
    const timer = setInterval(() => {
      setProgress((prev) => (prev < 98 ? prev + 1 : prev))
      setEmailsCleaned((prev) => prev + 3)
      setElapsedSeconds((prev) => prev + 1)
    }, 2000)
    return () => clearInterval(timer)
  }, [isOpen])

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const steps = [
    { label: 'Scanning mailbox headers', status: 'done' },
    { label: 'Identifying safe promotional emails', status: 'done' },
    { label: 'Reviewing protected senders list', status: 'done' },
    { label: 'Cleaning unsubscribe & trash items', status: 'active' },
    { label: 'Finalizing space optimization', status: 'pending' },
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" isCentered>
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(8px)" />
      <ModalContent
        borderRadius="card"
        bg="bg.card"
        border="1px solid"
        borderColor="border.subtle"
        boxShadow="2xl"
        p={2}
      >
        <ModalHeader pb={3}>
          <Flex justify="space-between" align="center">
            <Box>
              <HStack spacing={2}>
                <Icon as={Sparkles} boxSize={5} color="brand.500" />
                <Text fontSize="18px" fontWeight={700} color="text.primary">
                  Smart Cleanup
                </Text>
              </HStack>
              <Text fontSize="13px" fontWeight={400} color="text.secondary" mt={0.5}>
                Removing unnecessary emails safely into Gmail Trash
              </Text>
            </Box>
            <Button
              size="sm"
              variant="outline"
              borderColor="danger.500"
              color="danger.500"
              leftIcon={<Icon as={StopCircle} boxSize={4} />}
              onClick={onStopJob || onClose}
              _hover={{ bg: 'red.50' }}
            >
              Stop
            </Button>
          </Flex>
        </ModalHeader>

        <ModalBody pb={6}>
          <Grid templateColumns={{ base: '1fr', md: '1.2fr 1fr' }} gap={6} my={4}>
            {/* Left: Progress Ring + Checklist */}
            <Box
              p={5}
              borderRadius="xl"
              bg="bg.app"
              border="1px solid"
              borderColor="border.subtle"
            >
              <Flex align="center" justify="center" direction="column" mb={6}>
                <Box position="relative" w="130px" h="130px">
                  <Flex
                    position="absolute"
                    inset={0}
                    align="center"
                    justify="center"
                    direction="column"
                  >
                    <Text fontSize="28px" fontWeight={700} color="text.primary" letterSpacing="-0.03em">
                      {progress}%
                    </Text>
                    <Text fontSize="12px" fontWeight={600} color="brand.500">
                      In Progress
                    </Text>
                  </Flex>
                </Box>
              </Flex>

              <VStack spacing={3} align="stretch">
                {steps.map((step, idx) => (
                  <HStack key={idx} spacing={3}>
                    <Icon
                      as={CheckCircle2}
                      boxSize={4}
                      color={
                        step.status === 'done'
                          ? 'brand.500'
                          : step.status === 'active'
                          ? 'highlight.500'
                          : 'text.tertiary'
                      }
                    />
                    <Text
                      fontSize="13px"
                      fontWeight={step.status === 'active' ? 600 : 400}
                      color={step.status === 'pending' ? 'text.tertiary' : 'text.primary'}
                    >
                      {step.label}
                    </Text>
                  </HStack>
                ))}
              </VStack>
            </Box>

            {/* Right: Stats Column */}
            <VStack spacing={4} align="stretch" justify="center">
              <Box p={4} borderRadius="xl" bg="bg.app" border="1px solid" borderColor="border.subtle">
                <Text fontSize="11px" fontWeight={700} color="text.tertiary" textTransform="uppercase">
                  Emails Found
                </Text>
                <Text fontSize="24px" fontWeight={700} color="text.primary" mt={1}>
                  {initialFound}
                </Text>
              </Box>

              <Box p={4} borderRadius="xl" bg="bg.app" border="1px solid" borderColor="border.subtle">
                <Text fontSize="11px" fontWeight={700} color="text.tertiary" textTransform="uppercase">
                  Emails Cleaned
                </Text>
                <Text fontSize="24px" fontWeight={700} color="brand.500" mt={1}>
                  {emailsCleaned}
                </Text>
              </Box>

              <Grid templateColumns="1fr 1fr" gap={3}>
                <Box p={3} borderRadius="lg" bg="bg.app" border="1px solid" borderColor="border.subtle">
                  <Text fontSize="11px" color="text.tertiary">Space Saved</Text>
                  <Text fontSize="18px" fontWeight={700} color="text.primary">1.2 GB</Text>
                </Box>
                <Box p={3} borderRadius="lg" bg="bg.app" border="1px solid" borderColor="border.subtle">
                  <HStack spacing={1} color="text.tertiary">
                    <Icon as={Clock} boxSize={3.5} />
                    <Text fontSize="11px">Elapsed</Text>
                  </HStack>
                  <Text fontSize="18px" fontWeight={700} color="text.primary">
                    {formatElapsed(elapsedSeconds)}
                  </Text>
                </Box>
              </Grid>
            </VStack>
          </Grid>

          {/* Live Action Progress Bar */}
          <Box p={4} borderRadius="xl" bg="bg.app" border="1px solid" borderColor="border.subtle" mb={4}>
            <Flex justify="space-between" align="center" mb={2}>
              <HStack spacing={2}>
                <Icon as={Trash2} boxSize={4} color="brand.500" />
                <Text fontSize="13px" fontWeight={600} color="text.primary">
                  Currently Cleaning: Promotional emails
                </Text>
              </HStack>
              <Text fontSize="12px" color="text.secondary" fontWeight={600}>
                {emailsCleaned} / {initialFound}
              </Text>
            </Flex>
            <Progress value={progress} colorScheme="green" size="sm" borderRadius="full" />
          </Box>

          {/* Background Tip Banner */}
          <Flex
            p={3.5}
            borderRadius="lg"
            bg="bg.muted"
            border="1px solid"
            borderColor="border.subtle"
            align="center"
            gap={3}
          >
            <Icon as={Lightbulb} boxSize={4} color="warning.500" flexShrink={0} />
            <Text fontSize="12px" color="text.secondary">
              <Text as="span" fontWeight={600} color="text.primary">Tip: </Text>
              You can close this tab. We&apos;ll continue in the background and notify you when done.
            </Text>
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
