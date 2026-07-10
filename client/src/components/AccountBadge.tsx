import { Avatar, Button, Tooltip, Text, Flex } from '@chakra-ui/react'

function initials(email: string) {
  const name = email.split('@')[0]
  return name.slice(0, 2).toUpperCase()
}

function avatarColor(email: string) {
  const colors = ['#5856D6', '#FF2D55', '#34C759', '#FF9500', '#007AFF', '#00C7BE']
  let hash = 0
  for (const ch of email) hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function AccountBadge({ email, onLogout }: { email: string; onLogout: () => void }) {
  const bg = avatarColor(email)

  return (
    <Flex align="center" gap={3} ml="auto">
      <Tooltip label={email} placement="bottom">
        <Avatar
          size="sm"
          bg={bg}
          color="white"
          name={email}
          getInitials={() => initials(email)}
          cursor="default"
        />
      </Tooltip>
      <Text
        color="gray.600"
        fontWeight={500}
        display={{ base: 'none', lg: 'block' }}
        maxW="160px"
        isTruncated
        fontSize="sm"
      >
        {email}
      </Text>
      <Button
        size="sm"
        variant="outline"
        onClick={onLogout}
        color="gray.600"
        borderColor="gray.300"
        _hover={{ color: 'blue.500', borderColor: 'blue.400', bg: 'blue.50' }}
      >
        Sign out
      </Button>
    </Flex>
  )
}
