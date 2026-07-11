import { useMemo, useRef, useState } from 'react'
import {
  Box, Button, HStack, Input, InputGroup, InputLeftElement, List, ListItem,
  Tag, TagCloseButton, TagLabel, Text, Tooltip, Wrap, WrapItem,
} from '@chakra-ui/react'
import { SearchIcon } from '@chakra-ui/icons'
import { getSuggestions, parseToken } from '../utils/searchQuery'
import type { Chip } from '../utils/searchQuery'

/**
 * Tags input for multi-filter search. Controlled: the parent owns `chips`.
 * onSearch fires ONLY on Search click / Enter-on-empty-input (spec: explicit trigger).
 */
export default function TagSearchInput({
  chips, onChipsChange, onSearch, onClear, categories, isSearching = false,
}: {
  chips: Chip[]
  onChipsChange: (next: Chip[]) => void
  onSearch: (chips: Chip[]) => void
  onClear: () => void
  categories: string[]
  isSearching?: boolean
}) {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = useMemo(
    () => (focused ? getSuggestions(text, categories).slice(0, 8) : []),
    [focused, text, categories]
  )
  const hasInvalid = chips.some((c) => !c.valid)

  const addChip = (raw: string): Chip[] => {
    const trimmed = raw.trim()
    if (!trimmed) return chips
    const next = [...chips, parseToken(trimmed, categories)]
    onChipsChange(next)
    setText('')
    return next
  }

  const pickSuggestion = (s: string) => {
    if (s.endsWith(':')) {
      setText(s)
      inputRef.current?.focus()
    } else {
      addChip(s)
    }
  }

  const handleSearchClick = () => {
    const next = text.trim() ? addChip(text) : chips
    if (next.length > 0 && !next.some((c) => !c.valid)) onSearch(next)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (text.trim()) addChip(text)
      else if (chips.length > 0 && !hasInvalid) onSearch(chips)
    } else if (e.key === 'Backspace' && !text && chips.length > 0) {
      onChipsChange(chips.slice(0, -1))
    }
  }

  return (
    <Box position="relative">
      {chips.length > 0 && (
        <Wrap mb={2} spacing={2}>
          {chips.map((chip, i) => (
            <WrapItem key={`${chip.field}:${chip.value}:${i}`}>
              <Tooltip label={chip.error ?? chip.note} isDisabled={!chip.error && !chip.note} hasArrow>
                <Tag
                  size="sm"
                  borderRadius="full"
                  fontWeight={600}
                  colorScheme={chip.valid ? 'brand' : 'red'}
                  variant={chip.valid ? 'subtle' : 'solid'}
                >
                  <TagLabel>{chip.field === 'text' ? chip.value : `${chip.field}:${chip.value}`}</TagLabel>
                  <TagCloseButton
                    aria-label={`Remove ${chip.value}`}
                    onClick={() => onChipsChange(chips.filter((_, j) => j !== i))}
                  />
                </Tag>
              </Tooltip>
            </WrapItem>
          ))}
        </Wrap>
      )}
      <InputGroup size="sm">
        <InputLeftElement pointerEvents="none">
          <SearchIcon color="gray.400" />
        </InputLeftElement>
        <Input
          ref={inputRef}
          placeholder="tag:Promotions, from:amazon, is:unread…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          borderRadius="md"
        />
      </InputGroup>
      {suggestions.length > 0 && (
        <List
          position="absolute"
          zIndex={10}
          mt={1}
          w="100%"
          bg="bg.card"
          borderRadius="md"
          boxShadow="md"
          border="1px solid"
          borderColor="border.subtle"
          maxH="220px"
          overflowY="auto"
        >
          {suggestions.map((s) => (
            <ListItem
              key={s}
              px={3}
              py={1.5}
              fontSize="sm"
              cursor="pointer"
              _hover={{ bg: 'bg.hover' }}
              onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s) }}
            >
              {s}
            </ListItem>
          ))}
        </List>
      )}
      <HStack mt={2} spacing={2}>
        <Button
          size="xs"
          colorScheme="brand"
          borderRadius="full"
          isDisabled={(chips.length === 0 && !text.trim()) || hasInvalid}
          isLoading={isSearching}
          onClick={handleSearchClick}
        >
          Search
        </Button>
        <Button
          size="xs"
          variant="ghost"
          borderRadius="full"
          isDisabled={chips.length === 0 && !text}
          onClick={() => { setText(''); onClear() }}
        >
          Clear
        </Button>
        {hasInvalid && (
          <Text fontSize="xs" color="red.400">Fix or remove red filters to search</Text>
        )}
      </HStack>
    </Box>
  )
}
