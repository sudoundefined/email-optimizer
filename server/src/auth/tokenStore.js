import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config.js'

async function ensureDataDir() {
  await fs.mkdir(config.dataDir, { recursive: true })
}

export async function readTokens() {
  try {
    const raw = await fs.readFile(config.tokensPath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function writeTokens(tokens) {
  await ensureDataDir()
  const tmp = config.tokensPath + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(tokens, null, 2), 'utf8')
  await fs.rename(tmp, config.tokensPath)
}

export async function deleteTokens() {
  try {
    await fs.unlink(config.tokensPath)
  } catch {
    // already gone
  }
}

export async function updateTokens(partial) {
  const current = (await readTokens()) || {}
  await writeTokens({ ...current, ...partial })
}

export function tokensPathDir() {
  return path.dirname(config.tokensPath)
}
