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

interface AccountBadgeProps {
  email: string
  onLogout: () => void
  onOpenProfile?: () => void
}

export default function AccountBadge({ email, onLogout, onOpenProfile }: AccountBadgeProps) {
  const bg = avatarColor(email)

  return (
    <Flex align="center" gap={3} ml="auto">
      <Tooltip label="Click to view Account & Preferences" placement="bottom">
        <Flex
          align="center"
          gap={2}
          cursor={onOpenProfile ? 'pointer' : 'default'}
          onClick={onOpenProfile}
          _hover={{ opacity: 0.8 }}
        >
          <Avatar
            size="sm"
            bg={bg}
            color="white"
            name={email}
            getInitials={() => initials(email)}
          />
          <Text
            color="text.primary"
            fontWeight={500}
            display={{ base: 'none', lg: 'block' }}
            maxW="160px"
            isTruncated
            fontSize="sm"
          >
            {email}
          </Text>
        </Flex>
      </Tooltip>
      <Button
        size="sm"
        variant="outline"
        onClick={onLogout}
        color="text.secondary"
        borderColor="border.subtle"
        _hover={{ color: 'brand.500', borderColor: 'brand.400', bg: 'bg.hover' }}
      >
        Sign out
      </Button>
    </Flex>
  )
}
