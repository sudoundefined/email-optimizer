import fs from 'node:fs/promises'
import { config } from '../config.js'

/** Registry of Gmail label ids created by this app: [{id, name, createdAt}] */

async function read() {
  try {
    return JSON.parse(await fs.readFile(config.labelRegistryPath, 'utf8'))
  } catch {
    return []
  }
}

async function write(entries) {
  await fs.mkdir(config.dataDir, { recursive: true })
  const tmp = config.labelRegistryPath + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(entries, null, 2), 'utf8')
  await fs.rename(tmp, config.labelRegistryPath)
}

export async function listRegistered() {
  return read()
}

export async function registerLabel({ id, name }) {
  const entries = await read()
  if (!entries.some((e) => e.id === id)) {
    entries.push({ id, name, createdAt: new Date().toISOString() })
    await write(entries)
  }
}

export async function unregisterLabel(id) {
  const entries = await read()
  await write(entries.filter((e) => e.id !== id))
}
