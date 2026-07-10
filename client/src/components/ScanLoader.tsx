import { Flex, Text, Box, VStack } from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { EmailIcon } from '@chakra-ui/icons'

const MotionBox = motion(Box)
const MotionIcon = motion(EmailIcon)

export default function ScanLoader({ progress }: { progress?: { phase?: string; listed?: number; fetched?: number; total?: number } | null }) {
  const percent = progress?.total && progress?.fetched ? Math.round((progress.fetched / progress.total) * 100) : 0

  return (
    <Flex direction="column" align="center" justify="center" h="400px" w="100%">
      <MotionBox
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        position="relative"
      >
        <Flex w="100px" h="100px" borderRadius="3xl" bg="brand.500" align="center" justify="center" boxShadow="0 20px 40px rgba(0,0,0,0.2)">
          <MotionIcon
            color="white"
            boxSize={12}
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
          animate={{ y: [0, 100, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          borderRadius="full"
          zIndex={2}
        />
      </MotionBox>

      <VStack mt={8} spacing={2}>
        <Text fontSize="2xl" fontWeight={800} color="text.primary">
          {progress?.phase === 'listing' && 'Finding messages...'}
          {progress?.phase === 'fetching' && 'Analyzing headers...'}
          {progress?.phase === 'grouping' && 'Organizing senders...'}
          {!progress?.phase && 'Starting scan...'}
        </Text>
        
        <Text fontSize="md" color="neutral.500" fontWeight={500}>
          {progress?.phase === 'listing' && `Discovered ${progress.listed ?? 0} emails so far`}
          {progress?.phase === 'fetching' && `Read ${progress.fetched ?? 0} of ${progress.total ?? '?'} (${percent}%)`}
          {progress?.phase === 'grouping' && 'Almost ready'}
        </Text>
      </VStack>
      
      {progress?.phase === 'fetching' && (
        <Box w="240px" h="6px" bg="bg.glass" borderRadius="full" mt={6} overflow="hidden">
          <MotionBox h="100%" bg="brand.500" animate={{ width: `${percent}%` }} transition={{ ease: 'linear', duration: 0.2 }} />
        </Box>
      )}
    </Flex>
  )
}
