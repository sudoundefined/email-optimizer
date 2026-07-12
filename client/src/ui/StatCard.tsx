import { Box, Flex, Text, type BoxProps } from '@chakra-ui/react'
import { useCountUp } from '../hooks/useCountUp'

/**
 * Dashboard metric card (spec §4). Label + big count-up number + optional unit
 * and delta. Neutral by default; pass `accent` to tint the number. Opaque card,
 * e1 elevation, lifts on hover.
 */
export default function StatCard({
  label,
  value,
  unit,
  suffix,
  hint,
  accent = 'text.primary',
  icon,
  animate = true,
  ...rest
}: {
  label: string
  value: number
  unit?: string
  suffix?: string
  hint?: string
  accent?: string
  icon?: React.ReactNode
  animate?: boolean
} & BoxProps) {
  const shown = useCountUp(animate ? value : 0, animate ? 800 : 0)
  const display = animate ? Math.round(shown).toLocaleString() : value.toLocaleString()

  return (
    <Box
      bg="bg.card"
      border="1px solid"
      borderColor="border.subtle"
      borderRadius="card"
      boxShadow="e1"
      p={5}
      transition="box-shadow 0.2s, transform 0.2s"
      _hover={{ boxShadow: 'e2', transform: 'translateY(-2px)' }}
      {...rest}
    >
      <Flex align="center" justify="space-between" mb={3}>
        <Text fontSize="13px" fontWeight={500} color="text.secondary">{label}</Text>
        {icon && <Box color="text.tertiary">{icon}</Box>}
      </Flex>
      <Flex align="baseline" gap={1.5}>
        <Text fontSize="32px" lineHeight="36px" fontWeight={700} color={accent} sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {display}{suffix}
        </Text>
        {unit && <Text fontSize="sm" fontWeight={600} color="text.secondary">{unit}</Text>}
      </Flex>
      {hint && <Text fontSize="13px" color="text.tertiary" mt={1}>{hint}</Text>}
    </Box>
  )
}
