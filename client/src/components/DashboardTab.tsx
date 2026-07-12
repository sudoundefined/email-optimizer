import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box, Flex, Grid, GridItem, Text, Button, HStack, VStack, Icon, Spinner,
  SimpleGrid, useColorModeValue,
} from '@chakra-ui/react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from 'recharts'
import {
  Sparkles, ScanLine, Trash2, MailX, Tags, HardDrive, RefreshCw, ArrowRight,
  Inbox, AlertTriangle,
} from 'lucide-react'
import { api, ApiError } from '../api'
import type { ScanResult, Suggestion, Subscription, StorageStats } from '../types'
import { CATEGORY_COLORS } from './SenderTable'
import StatCard from '../ui/StatCard'
import ScoreRing from '../ui/ScoreRing'

type TabValue = 'dashboard' | 'mailbox' | 'storage' | 'labels' | 'account'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const NOISE_CATEGORIES = new Set(['Promotions', 'Social', 'Newsletters', 'Updates'])

export default function DashboardTab({
  onDisconnected,
  onNavigate,
  userName,
}: {
  onDisconnected: () => void
  onNavigate: (tab: TabValue) => void
  userName?: string
}) {
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [storage, setStorage] = useState<StorageStats | null>(null)
  const [loading, setLoading] = useState(true)

  const handleApiError = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.status === 401) onDisconnected()
  }, [onDisconnected])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [scanRes, sugRes, subRes, storeRes] = await Promise.all([
        api.senders().catch((e) => { if (e instanceof ApiError && (e.status === 404 || e.status === 409)) return null; throw e }),
        api.suggestions().catch(() => [] as Suggestion[]),
        api.subscriptions().catch(() => [] as Subscription[]),
        api.storageStats().catch(() => null),
      ])
      setScan(scanRes)
      setSuggestions(sugRes || [])
      setSubscriptions(subRes || [])
      setStorage(storeRes)
    } catch (err) {
      handleApiError(err)
    } finally {
      setLoading(false)
    }
  }, [handleApiError])

  useEffect(() => { load() }, [load])

  const catByEmail = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of suggestions) m.set(s.senderEmail, s.category)
    return m
  }, [suggestions])

  const metrics = useMemo(() => {
    const senders = scan?.senders ?? []
    const totalEmails = scan?.messageCount ?? 0
    const totalSenders = senders.length
    const unsubable = senders.filter((s) => s.method !== 'none')
    const unsubableEmails = unsubable.reduce((n, s) => n + s.messageCount, 0)

    // Category volume (emails per category, from AI suggestions joined to senders)
    const catVol = new Map<string, number>()
    let noiseEmails = 0
    for (const s of senders) {
      const cat = catByEmail.get(s.email)
      if (!cat) continue
      catVol.set(cat, (catVol.get(cat) || 0) + s.messageCount)
      if (NOISE_CATEGORIES.has(cat)) noiseEmails += s.messageCount
    }
    const socialEmails = senders
      .filter((s) => catByEmail.get(s.email) === 'Social')
      .reduce((n, s) => n + s.messageCount, 0)
    const promoSenders = senders.filter((s) => catByEmail.get(s.email) === 'Promotions')
    const promoEmails = promoSenders.reduce((n, s) => n + s.messageCount, 0)
    const newsletterSenders = senders.filter(
      (s) => catByEmail.get(s.email) === 'Newsletters' && s.method !== 'none'
    )

    const storageMB = storage?.totalMB ?? 0
    const noiseRatio = totalEmails > 0 ? noiseEmails / totalEmails : 0
    const storagePressure = Math.min(1, storageMB / 1000)
    const score = totalSenders === 0
      ? 0
      : Math.max(20, Math.min(99, Math.round(100 - 42 * noiseRatio - 24 * storagePressure)))

    // Volume trend: bucket sender email counts by month of latest activity.
    const buckets = new Map<string, number>()
    for (const s of senders) {
      const d = new Date(s.latestDate)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      buckets.set(key, (buckets.get(key) || 0) + s.messageCount)
    }
    const trend = [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8)
      .map(([k, v]) => {
        const [, mm] = k.split('-')
        const label = new Date(2000, Number(mm) - 1).toLocaleString(undefined, { month: 'short' })
        return { label, emails: v }
      })

    const donut = [...catVol.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }))

    return {
      totalEmails, totalSenders, unsubableCount: unsubable.length, unsubableEmails,
      socialEmails, promoSenders: promoSenders.length, promoEmails,
      newsletterCount: newsletterSenders.length, subscriptionsCount: subscriptions.length,
      storageMB, score, trend, donut,
    }
  }, [scan, catByEmail, storage, subscriptions])

  const gridStroke = useColorModeValue('#EEF0F2', 'rgba(255,255,255,0.06)')

  if (loading) {
    return (
      <Flex flex={1} align="center" justify="center" py={20}>
        <VStack spacing={4}>
          <Spinner color="brand.500" size="lg" thickness="3px" />
          <Text fontSize="sm" color="text.secondary">Loading your mailbox health…</Text>
        </VStack>
      </Flex>
    )
  }

  if (!scan) {
    return (
      <Flex flex={1} align="center" justify="center" py={16}>
        <VStack spacing={6} maxW="440px" textAlign="center">
          <Flex w="72px" h="72px" borderRadius="20px" bg="bg.accent" align="center" justify="center">
            <Icon as={Inbox} boxSize={8} color="brand.500" />
          </Flex>
          <VStack spacing={2}>
            <Text fontSize="24px" fontWeight={700} color="text.primary" letterSpacing="-0.01em">
              Welcome to EmailDiet
            </Text>
            <Text fontSize="15px" color="text.secondary">
              Scan your mailbox to unlock your health score, AI recommendations, and cleanup insights.
            </Text>
          </VStack>
          <Button
            colorScheme="brand" size="lg" borderRadius="control"
            leftIcon={<Icon as={ScanLine} boxSize={5} />}
            onClick={() => onNavigate('mailbox')}
          >
            Scan mailbox
          </Button>
        </VStack>
      </Flex>
    )
  }

  const recs = [
    metrics.promoEmails > 0 && {
      key: 'promo', icon: Trash2, tint: 'danger',
      title: `Clear ${metrics.promoEmails.toLocaleString()} promotional emails`,
      sub: `${metrics.promoSenders} senders · none opened recently`, cta: 'Review', tab: 'mailbox' as TabValue,
    },
    metrics.storageMB > 0 && {
      key: 'storage', icon: HardDrive, tint: 'warning',
      title: `Reclaim ${Math.round(metrics.storageMB).toLocaleString()} MB of storage`,
      sub: `${(storage?.messageCount ?? 0).toLocaleString()} large emails over 250 KB`, cta: 'Open storage', tab: 'storage' as TabValue,
    },
    metrics.newsletterCount > 0 && {
      key: 'news', icon: MailX, tint: 'ai',
      title: `Unsubscribe from ${metrics.newsletterCount} newsletters`,
      sub: 'One-click unsubscribe available', cta: 'Unsubscribe', tab: 'mailbox' as TabValue,
    },
    metrics.donut.length > 0 && {
      key: 'label', icon: Tags, tint: 'highlight',
      title: `Organize ${metrics.donut.length} categories with labels`,
      sub: 'AI-suggested Gmail labels ready to apply', cta: 'Open labels', tab: 'labels' as TabValue,
    },
  ].filter(Boolean) as { key: string; icon: any; tint: string; title: string; sub: string; cta: string; tab: TabValue }[]

  const tintColor: Record<string, string> = {
    danger: 'danger', warning: 'warning', ai: 'ai.500', highlight: 'highlight.500',
  }

  return (
    <Box flex={1} overflowY="auto" overflowX="hidden" pr={1}>
      {/* Header */}
      <Flex align={{ base: 'flex-start', md: 'center' }} justify="space-between" gap={4} mb={6} direction={{ base: 'column', md: 'row' }}>
        <Box>
          <Text fontSize="28px" fontWeight={700} color="text.primary" letterSpacing="-0.02em">
            {greeting()}{userName ? `, ${userName}` : ''}
          </Text>
          <Text fontSize="15px" color="text.secondary" mt={0.5}>
            Here's your mailbox health overview.
          </Text>
        </Box>
        <HStack spacing={2}>
          <Button
            variant="outline" size="md" borderRadius="control"
            leftIcon={<Icon as={RefreshCw} boxSize={4} />}
            onClick={load}
            color="text.secondary" borderColor="border.subtle"
            _hover={{ bg: 'bg.hover' }}
          >
            Refresh
          </Button>
          <Button
            colorScheme="brand" size="md" borderRadius="control"
            leftIcon={<Icon as={ScanLine} boxSize={4} />}
            onClick={() => onNavigate('mailbox')}
          >
            Scan mailbox
          </Button>
        </HStack>
      </Flex>

      {/* Stat cards */}
      <SimpleGrid columns={{ base: 1, sm: 2, lg: 5 }} spacing={4} mb={6}>
        <Box
          bg="bg.card" border="1px solid" borderColor="border.subtle" borderRadius="card"
          boxShadow="e1" p={5} transition="box-shadow 0.2s, transform 0.2s"
          _hover={{ boxShadow: 'e2', transform: 'translateY(-2px)' }}
        >
          <Text fontSize="13px" fontWeight={500} color="text.secondary" mb={2}>Mailbox Health</Text>
          <Flex justify="center" pt={1} pb={5}>
            <ScoreRing score={metrics.score} size={112} />
          </Flex>
        </Box>
        <StatCard label="Needs attention" value={metrics.unsubableCount} unit="senders"
          accent="warning" icon={<Icon as={AlertTriangle} boxSize={4} />}
          hint={`${metrics.unsubableEmails.toLocaleString()} unsubscribable emails`} />
        <StatCard label="Storage reclaimable" value={Math.round(metrics.storageMB)} unit="MB"
          accent="text.primary" icon={<Icon as={HardDrive} boxSize={4} />}
          hint={metrics.storageMB > 0 ? `${(storage?.messageCount ?? 0).toLocaleString()} large emails` : 'Analyze in Storage tab'} />
        <StatCard label="Social & promo noise" value={metrics.socialEmails + metrics.promoEmails} unit="emails"
          accent="highlight.500" icon={<Icon as={Sparkles} boxSize={4} />}
          hint={`${metrics.promoSenders} promo senders`} />
        <StatCard label="Active subscriptions" value={metrics.subscriptionsCount} unit="services"
          accent="ai.500" icon={<Icon as={RefreshCw} boxSize={4} />}
          hint="Recurring paid detected" />
      </SimpleGrid>

      {/* AI Recommended Actions */}
      <Flex align="center" gap={2} mb={3}>
        <Icon as={Sparkles} boxSize={4} color="ai.500" />
        <Text fontSize="17px" fontWeight={600} color="text.primary">AI recommended actions</Text>
      </Flex>
      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4} mb={6}>
        {recs.map((r) => (
          <Flex
            key={r.key}
            direction="column"
            bg="bg.card" border="1px solid" borderColor="border.subtle" borderRadius="card"
            boxShadow="e1" p={4} gap={3}
            position="relative" overflow="hidden"
            transition="box-shadow 0.2s, transform 0.2s"
            _hover={{ boxShadow: 'e2', transform: 'translateY(-2px)' }}
          >
            <Box position="absolute" left={0} top={0} bottom={0} w="3px" bg={tintColor[r.tint]} />
            <Flex w="36px" h="36px" borderRadius="10px" bg="bg.muted" align="center" justify="center">
              <Icon as={r.icon} boxSize={4} color={tintColor[r.tint]} />
            </Flex>
            <Box flex={1}>
              <Text fontSize="14px" fontWeight={600} color="text.primary" lineHeight="20px">{r.title}</Text>
              <Text fontSize="13px" color="text.tertiary" mt={1}>{r.sub}</Text>
            </Box>
            <Button
              size="sm" variant="ghost" borderRadius="10px" alignSelf="flex-start"
              color="brand.500" fontWeight={600}
              rightIcon={<Icon as={ArrowRight} boxSize={3.5} />}
              _hover={{ bg: 'bg.accent' }}
              onClick={() => onNavigate(r.tab)}
            >
              {r.cta}
            </Button>
          </Flex>
        ))}
      </SimpleGrid>

      {/* Charts */}
      <Grid templateColumns={{ base: '1fr', lg: '1.6fr 1fr' }} gap={4} pb={2}>
        <GridItem
          bg="bg.card" border="1px solid" borderColor="border.subtle" borderRadius="card"
          boxShadow="e1" p={5}
        >
          <Text fontSize="15px" fontWeight={600} color="text.primary" mb={1}>Email volume trend</Text>
          <Text fontSize="13px" color="text.tertiary" mb={4}>Emails by month from your latest scan</Text>
          <Box h="240px">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.trend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chakra-colors-brand-500)" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="var(--chakra-colors-brand-500)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--chakra-colors-text-tertiary)' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--chakra-colors-text-tertiary)' }} width={48} />
                <RTooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid var(--chakra-colors-border-subtle)', boxShadow: 'var(--chakra-shadows-e2)', fontSize: 13 }}
                  formatter={(v) => [Number(v).toLocaleString(), 'Emails']}
                />
                <Area type="monotone" dataKey="emails" stroke="var(--chakra-colors-brand-500)" strokeWidth={2.5} fill="url(#volGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </GridItem>

        <GridItem
          bg="bg.card" border="1px solid" borderColor="border.subtle" borderRadius="card"
          boxShadow="e1" p={5}
        >
          <Text fontSize="15px" fontWeight={600} color="text.primary" mb={1}>Top categories by volume</Text>
          <Text fontSize="13px" color="text.tertiary" mb={2}>Share of scanned emails</Text>
          {metrics.donut.length === 0 ? (
            <Flex h="200px" align="center" justify="center">
              <Text fontSize="13px" color="text.tertiary">No categorized senders yet.</Text>
            </Flex>
          ) : (
            <Flex align="center" gap={2} direction={{ base: 'column', sm: 'row' }}>
              <Box w="160px" h="180px" flexShrink={0}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.donut} dataKey="value" nameKey="name"
                      innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none"
                    >
                      {metrics.donut.map((d) => (
                        <Cell key={d.name} fill={CATEGORY_COLORS[d.name] ?? '#AEAEB2'} />
                      ))}
                    </Pie>
                    <RTooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid var(--chakra-colors-border-subtle)', boxShadow: 'var(--chakra-shadows-e2)', fontSize: 13 }}
                      formatter={(v, n) => [Number(v).toLocaleString(), String(n)]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <VStack align="stretch" spacing={1.5} flex={1} minW={0}>
                {metrics.donut.map((d) => {
                  const pct = metrics.totalEmails > 0 ? Math.round((d.value / metrics.totalEmails) * 100) : 0
                  return (
                    <Flex key={d.name} align="center" justify="space-between" gap={2}>
                      <HStack spacing={2} minW={0}>
                        <Box w={2.5} h={2.5} borderRadius="full" bg={CATEGORY_COLORS[d.name] ?? '#AEAEB2'} flexShrink={0} />
                        <Text fontSize="13px" color="text.secondary" isTruncated>{d.name}</Text>
                      </HStack>
                      <Text fontSize="13px" fontWeight={600} color="text.primary" sx={{ fontVariantNumeric: 'tabular-nums' }}>{pct}%</Text>
                    </Flex>
                  )
                })}
              </VStack>
            </Flex>
          )}
        </GridItem>
      </Grid>
    </Box>
  )
}
