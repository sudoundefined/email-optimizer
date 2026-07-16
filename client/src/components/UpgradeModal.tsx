import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, Text, Box, Flex, VStack, HStack, Icon, Badge
} from '@chakra-ui/react'
import { Check, Sparkles, X, Zap } from 'lucide-react'

export default function UpgradeModal({
  isOpen,
  onClose
}: {
  isOpen: boolean
  onClose: () => void
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(8px)" />
      <ModalContent
        borderRadius="card"
        bg="bg.card"
        border="1px solid"
        borderColor="border.subtle"
        boxShadow="e3"
        p={4}
      >
        <ModalHeader display="flex" justifyContent="space-between" alignItems="center" pb={2}>
          <HStack spacing={2}>
            <Icon as={Sparkles} color="brand.500" boxSize={5} />
            <Text fontSize="lg" fontWeight={700} color="text.primary">Upgrade to Premium</Text>
          </HStack>
          <Button size="sm" variant="ghost" onClick={onClose} borderRadius="full" p={0} minW="32px" h="32px">
            <Icon as={X} boxSize={4} color="text.secondary" />
          </Button>
        </ModalHeader>

        <ModalBody py={4}>
          <VStack spacing={5} align="stretch">
            <Box
              p={5}
              borderRadius="xl"
              bg="bg.muted"
              border="1px solid"
              borderColor="border.subtle"
              textAlign="center"
              position="relative"
              overflow="hidden"
            >
              <Badge
                colorScheme="green"
                position="absolute"
                top="12px"
                right="12px"
                borderRadius="full"
                px={2.5}
                py={0.5}
                fontSize="10px"
              >
                POPULAR
              </Badge>
              <Text fontSize="xs" fontWeight={700} color="brand.500" textTransform="uppercase" letterSpacing="wider">
                EmailDiet Pro
              </Text>
              <HStack justify="center" align="baseline" my={3}>
                <Text fontSize="42px" fontWeight={800} color="text.primary" letterSpacing="-0.03em">$9</Text>
                <Text fontSize="sm" color="text.secondary" fontWeight={500}>/month</Text>
              </HStack>
              <Text fontSize="13px" color="text.secondary">
                For power users who want a clean, organized mailbox automatically.
              </Text>
            </Box>

            <VStack spacing={3} align="stretch" px={1}>
              {[
                { title: 'Unlimited Scan & Cleanup', desc: 'Scan and process up to 100k+ emails monthly.' },
                { title: 'Real-time Syncing', desc: 'Background synchronization keeps lists fresh.' },
                { title: 'Advanced Whitelisting', desc: 'Custom rules for absolute safety control.' },
                { title: 'Priority API Rate Limits', desc: 'Faster batch processing without Gmail backoff.' },
              ].map((feat, i) => (
                <HStack key={i} spacing={3.5} align="start">
                  <Flex
                    w="20px"
                    h="20px"
                    borderRadius="full"
                    bg="bg.accent"
                    align="center"
                    justify="center"
                    flexShrink={0}
                    mt={0.5}
                  >
                    <Icon as={Check} color="brand.500" boxSize={3.5} strokeWidth={3} />
                  </Flex>
                  <Box>
                    <Text fontSize="13px" fontWeight={600} color="text.primary">{feat.title}</Text>
                    <Text fontSize="11px" color="text.secondary">{feat.desc}</Text>
                  </Box>
                </HStack>
              ))}
            </VStack>
          </VStack>
        </ModalBody>

        <ModalFooter pt={4} borderTop="1px solid" borderColor="border.subtle">
          <Button
            w="full"
            colorScheme="brand"
            size="md"
            borderRadius="lg"
            fontWeight={600}
            leftIcon={<Icon as={Zap} boxSize={4} />}
            onClick={() => {
              alert('Premium checkout logic integration would be here!')
              onClose()
            }}
          >
            Upgrade Now
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
