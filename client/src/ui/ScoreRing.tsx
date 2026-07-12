import { Box, Flex, Text } from '@chakra-ui/react'

/**
 * Health-score ring (spec §3.1). Pure SVG so it themes cleanly and animates via
 * a CSS stroke-dashoffset transition. Score 0–100 drives both the arc sweep and
 * the arc color (red → amber → emerald).
 */
export default function ScoreRing({
  score,
  size = 120,
  label = '/ 100',
}: {
  score: number
  size?: number
  label?: string
}) {
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, score))
  const offset = c * (1 - clamped / 100)
  const color = clamped >= 75 ? 'var(--chakra-colors-brand-500)'
    : clamped >= 50 ? 'var(--chakra-colors-warning)'
    : 'var(--chakra-colors-danger)'
  const rating = clamped >= 75 ? 'Good' : clamped >= 50 ? 'Fair' : 'Needs work'

  return (
    <Box position="relative" w={`${size}px`} h={`${size}px`} flexShrink={0}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--chakra-colors-border-subtle)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <Flex
        position="absolute" inset={0} direction="column" align="center" justify="center"
      >
        <Text fontSize={`${size * 0.28}px`} fontWeight={700} lineHeight={1} color="text.primary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(clamped)}
        </Text>
        <Text fontSize="11px" fontWeight={600} color="text.tertiary" mt={0.5}>{label}</Text>
      </Flex>
      <Text
        position="absolute" bottom="-20px" left="50%" transform="translateX(-50%)"
        fontSize="11px" fontWeight={600} color="text.secondary" whiteSpace="nowrap"
      >
        {rating}
      </Text>
    </Box>
  )
}
