import { google } from 'googleapis'
import { getAuthedClient } from '../auth/oauthClient.js'

export async function getGmail() {
  const auth = await getAuthedClient()
  return google.gmail({ version: 'v1', auth })
}
