import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import { MailOutlined as MailIcon, AutoAwesome as SparkleIcon } from '@mui/icons-material'

const FEATURES = [
  { icon: '🧹', label: 'Bulk unsubscribe from marketing mail' },
  { icon: '🏷️', label: 'Auto-label senders by category' },
  { icon: '🛡️', label: 'Protect important senders from actions' },
  { icon: '💾', label: 'Reclaim storage from large emails' },
]

export default function ConnectScreen() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, sm: 4 },
        background: 'var(--color-dominant-light)',
      }}
    >
      <Card
        sx={{
          maxWidth: 480,
          width: '100%',
          p: { xs: 4, sm: 6 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Logo mark */}
        <Box
          sx={{
            width: 64, height: 64, borderRadius: '16px', mb: 3,
            background: 'var(--color-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 16px rgba(37, 99, 235, 0.25)',
          }}
        >
          <MailIcon sx={{ color: '#fff', fontSize: 32 }} />
        </Box>

        <Typography variant="h2" sx={{ mb: 1, color: 'var(--color-dominant)' }}>
          Email Optimizer
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
          Take back control of your Gmail inbox. Unsubscribe in bulk, organise with labels, and free up storage.
        </Typography>

        {/* Feature list */}
        <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', gap: 2, width: '100%', textAlign: 'left' }}>
          {FEATURES.map(f => (
            <Box
              key={f.label}
              sx={{
                display: 'flex', alignItems: 'center', gap: 2,
              }}
            >
              <Typography sx={{ fontSize: '1.25rem', lineHeight: 1 }}>{f.icon}</Typography>
              <Typography variant="body2" sx={{ color: 'var(--color-dominant)', fontWeight: 500 }}>
                {f.label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* CTA */}
        <Button
          variant="contained"
          color="primary"
          size="large"
          href="/api/auth/login"
          startIcon={<SparkleIcon />}
          fullWidth
          sx={{ py: 1.5, fontSize: '16px', mb: 3 }}
        >
          Sign in with Google
        </Button>

        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '12px' }}>
          While in Google Testing mode, sessions expire after ~7 days.
          <br />Nothing is deleted permanently — Trash is always recoverable.
        </Typography>
      </Card>
    </Box>
  )
}
