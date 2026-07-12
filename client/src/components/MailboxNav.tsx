import { useState } from 'react'
import { Box, Flex, IconButton, Text, Tooltip, VStack } from '@chakra-ui/react'
import {
  CheckCircleIcon, ChevronDownIcon, ChevronUpIcon, EmailIcon,
  NotAllowedIcon, RepeatIcon,
} from '@chakra-ui/icons'
import type { ComponentWithAs, IconProps } from '@chakra-ui/react'
import { CATEGORY_COLORS } from './SenderTable'
import FilterToolbar from './FilterToolbar'
import type { Filter } from '../types'

export type Segment = 'all' | 'unsub' | 'nomethod' | 'subscriptions'

export const SEGMENTS: { key: Segment; label: string; blurb: string; icon: ComponentWithAs<'svg', IconProps> }[] = [
  { key: 'all', label: 'All senders', blurb: 'Everything from your scan', icon: EmailIcon },
  { key: 'unsub', label: 'With unsubscribe', blurb: 'One-click, email, or link', icon: CheckCircleIcon },
  { key: 'nomethod', label: 'No method', blurb: 'No unsubscribe detected', icon: NotAllowedIcon },
  { key: 'subscriptions', label: 'Subscriptions', blurb: 'Recurring paid services', icon: RepeatIcon },
]

const INITIAL_CATEGORIES = 6

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      fontSize="xs" fontWeight="bold" color="text.secondary"
      letterSpacing="wider" textTransform="uppercase"
      px={3} pt={5} pb={1.5}
    >
      {children}
    </Text>
  )
}

function NavRow({
  active, onClick, label, count, dotColor, tooltip,
}: {
  active: boolean
  onClick: () => void
  label: string
  count?: number
  dotColor?: string
  tooltip?: string
}) {
  const row = (
    <Flex
      as="button"
      type="button"
      w="100%"
      textAlign="left"
      onClick={onClick}
      align="center"
      justify="space-between"
      px={3}
      minH={{ base: '44px', md: '38px' }}
      borderRadius="md"
      cursor="pointer"
      aria-current={active || undefined}
      bg={active ? 'bg.accent' : 'transparent'}
      borderLeft="2px solid"
      borderColor={active ? 'brand.icon' : 'transparent'}
      _hover={{ bg: active ? 'bg.accent' : 'bg.hover' }}
      _focusVisible={{ boxShadow: 'outline', outline: 'none' }}
      transition="background 0.15s"
    >
      <Flex align="center" minW={0}>
        {dotColor && <Box w={2} h={2} borderRadius="full" bg={dotColor} mr={2} flexShrink={0} />}
        <Text fontSize="sm" fontWeight={600} color="text.primary" isTruncated>{label}</Text>
      </Flex>
      {count !== undefined && (
        <Text fontSize="sm" fontWeight={700} ml={2} flexShrink={0} color="text.primary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {count.toLocaleString()}
        </Text>
      )}
    </Flex>
  )
  if (!tooltip) return row
  return <Tooltip label={tooltip} placement="right" hasArrow openDelay={400}>{row}</Tooltip>
}

/**
 * Flat merged navigation rail for the Mailbox tab: Categories, Segments, and
 * Smart Filters as one scrollable list — no per-section cards, one elevation
 * layer stays reserved for the content pane. Collapsed mode renders a slim
 * icon rail with segment shortcuts only.
 */
export default function MailboxNav({
  collapsed,
  showCategories,
  categoryCounts,
  category,
  onCategorySelect,
  segment,
  segmentCounts,
  onSegmentSelect,
  isMessageView,
  filters,
  activeFilterKey,
  onFilterSelect,
}: {
  collapsed: boolean
  showCategories: boolean
  categoryCounts: [string, number][]
  category: string | null
  onCategorySelect: (cat: string | null) => void
  segment: Segment
  segmentCounts: Record<Segment, number>
  onSegmentSelect: (seg: Segment) => void
  isMessageView: boolean
  filters: Filter[]
  activeFilterKey: string | null
  onFilterSelect: (filter: Filter | null) => void
}) {
  const [showAllCategories, setShowAllCategories] = useState(false)

  const visibleCategories = showAllCategories ? categoryCounts : categoryCounts.slice(0, INITIAL_CATEGORIES)
  const hiddenCount = categoryCounts.length - INITIAL_CATEGORIES

  // Collapsed applies on md+ only — the icon rail. On base the full nav always
  // renders (the grid is single-column there and collapse makes no sense).
  const iconRail = (
    <VStack spacing={1} align="center" pt={2} display={{ base: 'none', md: 'flex' }}>
      {SEGMENTS.map((seg) => {
        const active = segment === seg.key && !isMessageView
        const SegIcon = seg.icon
        return (
          <Tooltip key={seg.key} label={`${seg.label} · ${segmentCounts[seg.key].toLocaleString()}`} placement="right" hasArrow>
            <IconButton
              aria-label={seg.label}
              aria-current={active || undefined}
              icon={<SegIcon />}
              size="md"
              variant={active ? 'solid' : 'ghost'}
              colorScheme={active ? 'brand' : 'gray'}
              borderRadius="lg"
              onClick={() => onSegmentSelect(seg.key)}
            />
          </Tooltip>
        )
      })}
    </VStack>
  )

  return (
    <>
    {collapsed && iconRail}
    <Box pb={4} display={collapsed ? { base: 'block', md: 'none' } : 'block'}>
      <SectionLabel>Segments</SectionLabel>
      {SEGMENTS.map((seg) => (
        <NavRow
          key={seg.key}
          active={segment === seg.key && !isMessageView}
          onClick={() => onSegmentSelect(seg.key)}
          label={seg.label}
          count={segmentCounts[seg.key]}
          tooltip={seg.blurb}
        />
      ))}

      {showCategories && (
        <>
          <SectionLabel>Categories</SectionLabel>
          <NavRow
            active={category === null && !isMessageView && segment === 'all'}
            onClick={() => onCategorySelect(null)}
            label="All categories"
          />
          {visibleCategories.map(([cat, count]) => {
            const active = category === cat && !isMessageView
            return (
              <NavRow
                key={cat}
                active={active}
                onClick={() => onCategorySelect(active ? null : cat)}
                label={cat}
                count={count}
                dotColor={CATEGORY_COLORS[cat] ?? '#AEAEB2'}
              />
            )
          })}
          {hiddenCount > 0 && (
            <Flex
              as="button"
              type="button"
              w="100%"
              onClick={() => setShowAllCategories((v) => !v)}
              align="center"
              px={3}
              minH="34px"
              borderRadius="md"
              cursor="pointer"
              color="text.secondary"
              _hover={{ bg: 'bg.hover' }}
              _focusVisible={{ boxShadow: 'outline', outline: 'none' }}
            >
              {showAllCategories ? <ChevronUpIcon mr={1.5} /> : <ChevronDownIcon mr={1.5} />}
              <Text fontSize="xs" fontWeight={600}>
                {showAllCategories ? 'Show less' : `Show all (${categoryCounts.length})`}
              </Text>
            </Flex>
          )}
        </>
      )}

      <SectionLabel>Smart Filters</SectionLabel>
      <Box px={3} pt={1}>
        <FilterToolbar filters={filters} activeKey={activeFilterKey} onSelect={onFilterSelect} />
      </Box>
    </Box>
    </>
  )
}
