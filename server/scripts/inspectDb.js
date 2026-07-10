import { getDb, closeDb } from '../src/db/db.js'

function inspect() {
  const db = getDb()

  console.log('==============================================')
  console.log('         EMAILDIET DATABASE INSPECTOR         ')
  console.log('==============================================\n')

  const tables = [
    'users',
    'tokens',
    'preferences',
    'scan_cache',
    'protected_senders',
    'label_registry',
    'activity_log',
    'digest_baseline'
  ]

  for (const table of tables) {
    try {
      const countRow = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get()
      console.log(`📦 Table [${table}]: ${countRow.count} row(s)`)

      if (countRow.count > 0 && (table === 'users' || table === 'activity_log' || table === 'preferences')) {
        const rows = db.prepare(`SELECT * FROM ${table} ORDER BY rowid DESC LIMIT 5`).all()
        console.table(rows)
      }
    } catch (err) {
      console.log(`⚠️  Could not inspect table ${table}: ${err.message}`)
    }
    console.log('')
  }

  closeDb()
}

inspect()
