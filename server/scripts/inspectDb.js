import { getDb, closeDb } from '../src/db/db.js'

async function inspect() {
  const sql = getDb()

  console.log('==============================================')
  console.log('     EMAILDIET 13-TABLE DATABASE INSPECTOR    ')
  console.log('==============================================\n')

  const tables = [
    'users',
    'tokens',
    'preferences',
    'protected_senders',
    'label_registry',
    'activity_log',
    'digest_baseline',
    'scan_cache',
    'sender_cache',
    'cleanup_history',
    'weekly_digest',
    'saved_views',
    'scan_metadata'
  ]

  for (const table of tables) {
    try {
      const countRow = await sql.unsafe(`SELECT COUNT(*) as count FROM ${table}`)
      console.log(`📦 Table [${table}]: ${countRow[0].count} row(s)`)

      if (countRow[0].count > 0 && ['users', 'preferences', 'scan_cache', 'scan_metadata'].includes(table)) {
        const rows = await sql.unsafe(`SELECT * FROM ${table} LIMIT 5`)
        console.table(rows)
      }
    } catch (err) {
      console.log(`⚠️  Could not inspect table [${table}]: ${err.message}`)
    }
    console.log('')
  }

  await closeDb()
}

inspect().catch(err => {
  console.error(err)
  process.exit(1)
})
