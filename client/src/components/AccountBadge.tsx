import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'

export default function AccountBadge({ email, onLogout }: { email: string; onLogout: () => void }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 'auto' }}>
      <Typography variant="body2" color="text.secondary" noWrap>
        {email}
      </Typography>
      <Button size="small" variant="outlined" onClick={onLogout}>
        Disconnect
      </Button>
    </Box>
  )
}
