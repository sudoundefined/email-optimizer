import { useMemo, useRef, useState } from 'react'
import {
  Box, Button, Flex, HStack, Input, List, ListItem,
  Tag, TagCloseButton, TagLabel, Text, Tooltip,
} from '@chakra-ui/react'
import { SearchIcon } from '@chakra-ui/icons'
import { getSuggestions, parseToken } from '../utils/searchQuery'
import type { Chip } from '../utils/searchQuery'

/**
 * Horizontal tags input for multi-filter search. Controlled: the parent owns `chips`.
 * onSearch fires ONLY on Search click / Enter-on-empty-input (spec: explicit trigger).
 * The suggestion dropdown must not be rendered inside an overflow:auto/hidden
 * ancestor — it positions absolutely below the field (MailboxTab renders this
 * component in the full-width top bar for that reason).
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
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = useMemo(
    () => (focused ? getSuggestions(text, categories).slice(0, 8) : []),
    [focused, text, categories]
  )
  const hasInvalid = chips.some((c) => !c.valid)

  const refocus = () => inputRef.current?.focus()

  const addChip = (raw: string): Chip[] => {
    const trimmed = raw.trim()
    if (!trimmed) return chips
    const next = [...chips, parseToken(trimmed, categories)]
    onChipsChange(next)
    setText('')
    setActiveIndex(-1)
    refocus()
    return next
  }

  const pickSuggestion = (s: string) => {
    if (s.endsWith(':')) {
      setText(s)
      setActiveIndex(-1)
      refocus()
    } else {
      addChip(s)
    }
  }

  const handleSearchClick = () => {
    const next = text.trim() ? addChip(text) : chips
    if (next.length > 0 && !next.some((c) => !c.valid)) onSearch(next)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Escape') {
      setFocused(false)
      setActiveIndex(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        pickSuggestion(suggestions[activeIndex])
      } else if (text.trim()) {
        addChip(text)
      } else if (chips.length > 0 && !hasInvalid) {
        onSearch(chips)
      }
    } else if (e.key === 'Backspace' && !text && chips.length > 0) {
      onChipsChange(chips.slice(0, -1))
    }
  }

  return (
    <Flex gap={2} align="flex-start">
      <Box position="relative" flex={1} minW={0}>
        <Flex
          wrap="wrap"
          align="center"
          gap={1.5}
          px={3}
          py={1.5}
          minH="40px"
          bg="bg.card"
          border="1px solid"
          borderColor="border.subtle"
          borderRadius="xl"
          cursor="text"
          transition="border-color 0.15s, box-shadow 0.15s"
          _focusWithin={{ borderColor: 'brand.500', boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' }}
          onClick={refocus}
        >
          <SearchIcon color="gray.400" boxSize={3.5} flexShrink={0} />
          {chips.map((chip, i) => (
            <Tooltip
              key={`${chip.field}:${chip.value}:${i}`}
              label={chip.error ?? chip.note}
              isDisabled={!chip.error && !chip.note}
              hasArrow
            >
              <Tag
                size="sm"
                borderRadius="full"
                fontWeight={600}
                flexShrink={0}
                colorScheme={chip.valid ? 'brand' : 'red'}
                variant={chip.valid ? 'subtle' : 'solid'}
              >
                <TagLabel>{chip.field === 'text' ? chip.value : `${chip.field}:${chip.value}`}</TagLabel>
                <TagCloseButton
                  aria-label={`Remove ${chip.value}`}
                  onClick={(e) => { e.stopPropagation(); onChipsChange(chips.filter((_, j) => j !== i)) }}
                />
              </Tag>
            </Tooltip>
          ))}
          <Input
            ref={inputRef}
            variant="unstyled"
            size="sm"
            flex={1}
            minW="160px"
            placeholder="tag:Promotions, from:amazon, is:unread…"
            value={text}
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls="tag-search-suggestions"
            aria-activedescendant={activeIndex >= 0 ? `tag-search-option-${activeIndex}` : undefined}
            onChange={(e) => { setText(e.target.value); setActiveIndex(-1) }}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
          />
        </Flex>
        {suggestions.length > 0 && (
          <List
            id="tag-search-suggestions"
            role="listbox"
            position="absolute"
            top="100%"
            left={0}
            zIndex="dropdown"
            mt={1}
            w="100%"
            bg="bg.card"
            borderRadius="md"
            boxShadow="md"
            border="1px solid"
            borderColor="border.subtle"
            maxH="260px"
            overflowY="auto"
          >
            {suggestions.map((s, i) => (
              <ListItem
                key={s}
                id={`tag-search-option-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                px={3}
                py={1.5}
                fontSize="sm"
                cursor="pointer"
                bg={i === activeIndex ? 'bg.hover' : 'transparent'}
                _hover={{ bg: 'bg.hover' }}
                onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s) }}
              >
                {s}
              </ListItem>
            ))}
          </List>
        )}
        {hasInvalid && (
          <Text fontSize="xs" color="red.400" mt={1}>Fix or remove red filters to search</Text>
        )}
      </Box>
      <HStack spacing={2} pt="2px">
        <Button
          size="sm"
          colorScheme="brand"
          borderRadius="full"
          fontWeight={600}
          isDisabled={(chips.length === 0 && !text.trim()) || hasInvalid}
          isLoading={isSearching}
          onClick={handleSearchClick}
        >
          Search
        </Button>
        <Button
          size="sm"
          variant="ghost"
          borderRadius="full"
          fontWeight={600}
          isDisabled={chips.length === 0 && !text}
          onClick={() => { setText(''); onClear() }}
        >
          Clear
        </Button>
      </HStack>
    </Flex>
  )
}
