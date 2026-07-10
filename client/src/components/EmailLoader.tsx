import { Flex, Text, Box } from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { EmailIcon } from '@chakra-ui/icons'

const MotionBox = motion(Box)
const MotionIcon = motion(EmailIcon)

interface EmailLoaderProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function EmailLoader({ message, size = 'md' }: EmailLoaderProps) {
  const boxSizeMap = {
    sm: '60px',
    md: '100px',
    lg: '140px',
  }
  const iconSizeMap = {
    sm: 6,
    md: 12,
    lg: 16,
  }

  const dim = boxSizeMap[size]
  const iconSize = iconSizeMap[size]

  return (
    <Flex direction="column" align="center" justify="center" p={4} w="100%">
      <MotionBox
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        position="relative"
      >
        <Flex w={dim} h={dim} borderRadius="2xl" bg="brand.500" align="center" justify="center" boxShadow="0 20px 40px rgba(0,0,0,0.2)">
          <MotionIcon
            color="white"
            boxSize={iconSize}
            animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </Flex>

        {/* Scanning beam effect */}
        <MotionBox
          position="absolute"
          top={0}
          left={0}
          right={0}
          h="4px"
          bg="cyan.300"
          boxShadow="0 0 10px 2px rgba(0, 255, 255, 0.6)"
          animate={{ y: [0, parseInt(dim, 10), 0], opacity: [0, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          borderRadius="full"
          zIndex={2}
        />
      </MotionBox>

      {message && (
        <Text fontSize="sm" fontWeight={600} color="text.secondary" mt={6}>
          {message}
        </Text>
      )}
    </Flex>
  )
}
