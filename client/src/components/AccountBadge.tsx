import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

function initials(email: string) {
  const name = email.split('@')[0]
  return name.slice(0, 2).toUpperCase()
}

function avatarColor(email: string) {
  const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#0ea5e9', '#8b5cf6']
  let hash = 0
  for (const ch of email) hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function AccountBadge({ email, onLogout }: { email: string; onLogout: () => void }) {
  const bg = avatarColor(email)

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
      <Tooltip title={email} placement="bottom">
        <Avatar
          sx={{
            width: 32, height: 32, fontSize: '0.75rem', fontWeight: 700,
            background: `linear-gradient(135deg, ${bg} 0%, ${bg}cc 100%)`,
            border: '2px solid rgba(255,255,255,0.2)',
            cursor: 'default',
          }}
        >
          {initials(email)}
        </Avatar>
      </Tooltip>
      <Typography
        variant="body2"
        sx={{ color: 'rgba(255,255,255,0.65)', fontWeight: 500, display: { xs: 'none', lg: 'block' }, maxWidth: 160 }}
        noWrap
      >
        {email}
      </Typography>
      <Button
        size="small"
        onClick={onLogout}
        sx={{
          color: 'rgba(255,255,255,0.55)',
          fontWeight: 600,
          fontSize: '0.75rem',
          borderColor: 'rgba(255,255,255,0.15)',
          border: '1px solid',
          borderRadius: '8px',
          px: 1.5, py: 0.5,
          '&:hover': { color: '#fff', borderColor: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.08)' },
        }}
      >
        Sign out
      </Button>
    </Box>
  )
}
