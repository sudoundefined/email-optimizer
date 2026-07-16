import { LabelRegistryRepository } from '../models/LabelRegistryRepository.js'
import { getDb } from '../db/db.js'

/** Registry of Gmail label ids created by this app, per user. */

export async function listRegistered(userId) {
  const rows = await LabelRegistryRepository.findByUserId(userId)
  return rows.map(r => ({
    id: r.gmail_id,
    name: r.label_name,
    createdAt: r.created_at
  }))
}

export async function registerLabel(userId, { id, name }) {
  await LabelRegistryRepository.insert(userId, name, id)
}

export async function unregisterLabel(userId, id) {
  await LabelRegistryRepository.deleteByGmailId(userId, id)
}
