import { google } from 'googleapis'
import { getAuthedClient } from '../auth/oauthClient.js'
import { config } from '../config.js'
import { getMockGmailClient } from './mockClient.js'

export async function getGmail(userId) {
  if (config.demoMode || String(userId).startsWith('acc_demo_')) {
    return getMockGmailClient(userId)
  }
  const auth = await getAuthedClient(userId)
  return google.gmail({ version: 'v1', auth })
}
