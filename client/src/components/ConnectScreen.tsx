import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { MailOutlined as MailOutlineIcon } from '@mui/icons-material'

export default function ConnectScreen() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', p: 3 }}>
      <Card sx={{ maxWidth: 460, textAlign: 'center' }}>
        <CardContent sx={{ px: 5, py: 6 }}>
          <MailOutlineIcon sx={{ fontSize: 56, color: 'primary.main', mb: 2 }} />
          <Typography variant="h4" sx={{ fontWeight: 800 }} gutterBottom>
            Email Unsubscriber
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Scan your Gmail for marketing email, unsubscribe in bulk, sort senders into labels, and
            clear out what you never read.
          </Typography>
          <Button
            variant="contained"
            size="large"
            href="/api/auth/login"
            sx={{ mb: 3 }}
          >
            Sign in with Google
          </Button>
          <Typography variant="body2" color="text.secondary">
            While the app is in Google "Testing" mode, sessions expire after about 7 days and you'll
            need to sign in again.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
