import { useEffect, useRef } from 'react'
import { Box, BoxProps, useTheme, useColorMode } from '@chakra-ui/react'
import ProgressBar from 'progressbar.js'

type ShapeType = 'Line' | 'Circle' | 'SemiCircle'

interface AnimatedProgressProps extends BoxProps {
  shape?: ShapeType
  progress?: number // 0 to 1
  indeterminate?: boolean
  strokeColorToken?: string
  trailColorToken?: string
  textColorToken?: string
  strokeWidth?: number
  trailWidth?: number
  duration?: number
  text?: string
}

function resolveToken(theme: any, colorMode: 'light' | 'dark', tokenPath: string): string {
  // Simple resolution logic for our custom semantic tokens or normal theme colors
  if (theme.semanticTokens?.colors?.[tokenPath]) {
    const semantic = theme.semanticTokens.colors[tokenPath]
    return colorMode === 'dark' ? semantic._dark : semantic.default
  }
  
  // Try normal colors (e.g. brand.500)
  const parts = tokenPath.split('.')
  let current = theme.colors
  for (const part of parts) {
    if (!current[part]) return tokenPath // fallback to the string if not found
    current = current[part]
  }
  return current as unknown as string
}

export default function AnimatedProgress({
  shape = 'Circle',
  progress = 0,
  indeterminate = false,
  strokeColorToken = 'brand.500',
  trailColorToken = 'border.glass',
  textColorToken = 'text.primary',
  strokeWidth = 4,
  trailWidth = 4,
  duration = 800,
  text,
  ...boxProps
}: AnimatedProgressProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<any>(null)
  const theme = useTheme()
  const { colorMode } = useColorMode()

  const strokeColor = resolveToken(theme, colorMode, strokeColorToken)
  const trailColor = resolveToken(theme, colorMode, trailColorToken)
  const textColor = resolveToken(theme, colorMode, textColorToken)

  useEffect(() => {
    if (!containerRef.current) return

    const Shape = ProgressBar[shape]
    
    const instance = new Shape(containerRef.current, {
      color: strokeColor,
      strokeWidth,
      trailColor,
      trailWidth,
      easing: 'easeInOut',
      duration,
      text: {
        style: {
          color: textColor,
          position: 'absolute',
          left: '50%',
          top: shape === 'SemiCircle' ? 'auto' : '50%',
          bottom: shape === 'SemiCircle' ? '0' : 'auto',
          padding: 0,
          margin: 0,
          transform: shape === 'SemiCircle' ? 'translate(-50%, 0)' : 'translate(-50%, -50%)',
          fontWeight: 'bold',
          fontSize: '1rem',
        },
      }
    })

    barRef.current = instance
    let isCancelled = false

    // If indeterminate, run a continuous looping animation
    if (indeterminate) {
      const loop = () => {
        if (isCancelled) return
        instance.set(0)
        instance.animate(1, { duration: 1500, easing: 'linear' }, () => {
          if (!isCancelled) loop()
        })
      }
      loop()
    }

    return () => {
      isCancelled = true
      instance.destroy()
      if (barRef.current === instance) {
        barRef.current = null
      }
    }
  }, [shape, strokeColor, trailColor, textColor, strokeWidth, trailWidth, duration, indeterminate])

  useEffect(() => {
    if (barRef.current) {
      if (!indeterminate) {
        barRef.current.animate(progress)
      }
      if (text !== undefined) {
        barRef.current.setText(text)
      }
    }
  }, [progress, indeterminate, text])

  return (
    <Box ref={containerRef} position="relative" {...boxProps} />
  )
}
