import React from 'react'
import {
  Box,
  Flex,
  Text,
  Button,
  Icon,
  HStack,
} from '@chakra-ui/react'
import { Lightbulb } from 'lucide-react'

export interface EmptyStateCardProps {
  icon: React.ElementType
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  tip?: string
}

export const EmptyStateCard: React.FC<EmptyStateCardProps> = ({
  icon: IconComponent,
  title,
  description,
  actionLabel,
  onAction,
  tip,
}) => {
  return (
    <Box
      borderRadius="card"
      bg="bg.card"
      border="1px solid"
      borderColor="border.subtle"
      boxShadow="e1"
      p={{ base: 6, md: 10 }}
      textAlign="center"
      maxW="480px"
      mx="auto"
      my={8}
    >
      <Flex
        w="64px"
        h="64px"
        borderRadius="2xl"
        bg="bg.muted"
        align="center"
        justify="center"
        mx="auto"
        mb={4}
        color="text.secondary"
      >
        <Icon as={IconComponent} boxSize={7} />
      </Flex>

      <Text fontSize="17px" fontWeight={700} color="text.primary" letterSpacing="-0.01em" mb={1.5}>
        {title}
      </Text>

      <Text fontSize="13px" color="text.secondary" lineHeight="1.6" mb={actionLabel ? 5 : 2}>
        {description}
      </Text>

      {actionLabel && onAction && (
        <Button
          size="sm"
          variant="outline"
          borderColor="border.subtle"
          color="text.primary"
          borderRadius="lg"
          px={5}
          onClick={onAction}
          _hover={{ bg: 'bg.hover' }}
          mb={tip ? 5 : 0}
        >
          {actionLabel}
        </Button>
      )}

      {tip && (
        <Box
          mt={4}
          p={3}
          borderRadius="lg"
          bg="bg.app"
          border="1px solid"
          borderColor="border.subtle"
          textAlign="left"
        >
          <HStack spacing={2} align="flex-start" fontSize="12px" color="text.secondary">
            <Icon as={Lightbulb} boxSize={3.5} color="warning.500" mt={0.5} flexShrink={0} />
            <Text>{tip}</Text>
          </HStack>
        </Box>
      )}
    </Box>
  )
}
