const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

const dbPath = path.join(__dirname, 'data.sqlite')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT,
    amount REAL,
    sender TEXT,
    code TEXT,
    type TEXT,
    is_fake INTEGER DEFAULT 0,
    risk_level TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    quantity INTEGER,
    unit_cost REAL,
    reorder_level INTEGER,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS debtors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    amount REAL,
    note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`)

function seedSampleData() {
  const transactionCount = db.prepare('SELECT COUNT(*) as total FROM transactions').get().total
  if (transactionCount === 0) {
    db.prepare(`
      INSERT INTO transactions (message, amount, sender, code, type, is_fake, risk_level)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Confirmed. KSh 2,500.00 sent to Jane Wanjiku for stock. Ref: ABX8791N.',
      2500,
      'Jane Wanjiku',
      'ABX8791N',
      'debit',
      0,
      'low',
    )

    db.prepare(`
      INSERT INTO transactions (message, amount, sender, code, type, is_fake, risk_level)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Confirmed. KSh 3,200.00 received from Martin Njeri for rice delivery. Ref: SDQ44F9.',
      3200,
      'Martin Njeri',
      'SDQ44F9',
      'credit',
      0,
      'low',
    )

    db.prepare(`
      INSERT INTO transactions (message, amount, sender, code, type, is_fake, risk_level)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Alert! You have won KSh 5,000 from Safaricom. Reply YES to claim your prize.',
      5000,
      'Unknown sender',
      'WIN5000',
      'scam',
      1,
      'high',
    )
  }

  const stockCount = db.prepare('SELECT COUNT(*) as total FROM stock').get().total
  if (stockCount === 0) {
    db.prepare(`INSERT INTO stock (name, quantity, unit_cost, reorder_level) VALUES (?, ?, ?, ?)`)
      .run('Rice sacks', 52, 1450, 18)
    db.prepare(`INSERT INTO stock (name, quantity, unit_cost, reorder_level) VALUES (?, ?, ?, ?)`)
      .run('Cooking oil', 16, 980, 10)
    db.prepare(`INSERT INTO stock (name, quantity, unit_cost, reorder_level) VALUES (?, ?, ?, ?)`)
      .run('Sugar bags', 9, 1200, 12)
  }

  const debtorCount = db.prepare('SELECT COUNT(*) as total FROM debtors').get().total
  if (debtorCount === 0) {
    db.prepare(`INSERT INTO debtors (name, amount, note) VALUES (?, ?, ?)`)
      .run('Amina Yusuf', 18000, 'School supply credit')
    db.prepare(`INSERT INTO debtors (name, amount, note) VALUES (?, ?, ?)`)
      .run('Daniel Otieno', 5600, 'Rice bag advance')
  }
}

seedSampleData()

function listTransactions() {
  return db.prepare('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 20').all()
}

function listStock() {
  return db.prepare('SELECT * FROM stock ORDER BY name ASC').all()
}

function listDebtors() {
  return db.prepare('SELECT * FROM debtors ORDER BY amount DESC').all()
}

function summaryStats() {
  const dailySales = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE type = 'credit' AND is_fake = 0 AND date(created_at) = date('now')
  `).get().total

  const dailyExpenses = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE type = 'debit' AND is_fake = 0 AND date(created_at) = date('now')
  `).get().total

  const suspiciousCount = db.prepare(`
    SELECT COUNT(*) as total FROM transactions WHERE is_fake = 1
  `).get().total

  const pendingDebts = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM debtors`).get().total
  const inventoryValue = db.prepare(`SELECT COALESCE(SUM(quantity * unit_cost), 0) as total FROM stock`).get().total

  return {
    dailySales: Number(dailySales),
    dailyExpenses: Number(dailyExpenses),
    dailyProfit: Number(dailySales - dailyExpenses),
    pendingDebts: Number(pendingDebts),
    inventoryValue: Number(inventoryValue),
    suspiciousCount: Number(suspiciousCount),
  }
}

function addTransaction(data) {
  const insert = db.prepare(`
    INSERT INTO transactions (message, amount, sender, code, type, is_fake, risk_level)
    VALUES (@message, @amount, @sender, @code, @type, @is_fake, @risk_level)
  `)

  return insert.run({
    message: data.message,
    amount: Number(data.amount || 0),
    sender: data.sender || 'Unknown sender',
    code: data.code || 'UNKNOWN',
    type: data.type || 'credit',
    is_fake: data.is_fake ? 1 : 0,
    risk_level: data.risk_level || 'low',
  })
}

function addStockItem(item) {
  const insert = db.prepare(`
    INSERT INTO stock (name, quantity, unit_cost, reorder_level)
    VALUES (@name, @quantity, @unitCost, @reorderLevel)
  `)

  return insert.run({
    name: item.name,
    quantity: Number(item.quantity || 0),
    unitCost: Number(item.unitCost || 0),
    reorderLevel: Number(item.reorderLevel || 0),
  })
}

function addDebtor(item) {
  const insert = db.prepare(`
    INSERT INTO debtors (name, amount, note)
    VALUES (@name, @amount, @note)
  `)

  return insert.run({
    name: item.name,
    amount: Number(item.amount || 0),
    note: item.note || 'General debt',
  })
}

module.exports = {
  db,
  summaryStats,
  addTransaction,
  addStockItem,
  addDebtor,
  listTransactions,
  listStock,
  listDebtors,
}
