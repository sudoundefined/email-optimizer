import { HStack, Tag, Button } from '@chakra-ui/react'
import type { Filter } from '../types'

interface Props {
  filters: Filter[]
  activeKey: string | null
  onSelect: (filter: Filter | null) => void
}

export default function FilterToolbar({ filters, activeKey, onSelect }: Props) {
  return (
    <HStack wrap="wrap" mb={4} spacing={2}>
      {filters.map((f) => {
        const isActive = activeKey === f.key
        return (
          <Tag
            key={f.key}
            size="md"
            borderRadius="full"
            variant={isActive ? 'solid' : 'outline'}
            colorScheme={isActive ? 'blue' : 'gray'}
            cursor="pointer"
            onClick={() => onSelect(isActive ? null : f)}
          >
            {f.label}
          </Tag>
        )
      })}
      {activeKey && (
        <Button size="sm" variant="ghost" onClick={() => onSelect(null)}>
          Clear filter
        </Button>
      )}
    </HStack>
  )
}
