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
  const colors = ['#5856D6', '#FF2D55', '#34C759', '#FF9500', '#007AFF', '#00C7BE']
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
            backgroundColor: bg,
            border: '1px solid rgba(0,0,0,0.06)',
            cursor: 'default',
          }}
        >
          {initials(email)}
        </Avatar>
      </Tooltip>
      <Typography
        variant="body2"
        sx={{ color: 'rgba(60,60,67,0.6)', fontWeight: 500, display: { xs: 'none', lg: 'block' }, maxWidth: 160 }}
        noWrap
      >
        {email}
      </Typography>
      <Button
        size="small"
        onClick={onLogout}
        sx={{
          color: 'rgba(60,60,67,0.75)',
          fontWeight: 600,
          fontSize: '0.75rem',
          borderColor: 'rgba(60,60,67,0.22)',
          border: '1px solid',
          borderRadius: '8px',
          px: 1.5, py: 0.5,
          '&:hover': { color: '#007AFF', borderColor: 'rgba(0,122,255,0.4)', background: 'rgba(0,122,255,0.08)' },
        }}
      >
        Sign out
      </Button>
    </Box>
  )
}
