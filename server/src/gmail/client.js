import { google } from 'googleapis'
import { getAuthedClient } from '../auth/oauthClient.js'

export async function getGmail(userId) {
  const auth = await getAuthedClient(userId)
  return google.gmail({ version: 'v1', auth })
}
