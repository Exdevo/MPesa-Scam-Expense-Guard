const express = require('express')
const cors = require('cors')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const {
  summaryStats,
  addTransaction,
  addStockItem,
  addDebtor,
  listTransactions,
  listStock,
  listDebtors,
} = require('./db')

const app = express()
const port = 3001
const upload = multer({ storage: multer.memoryStorage() })

app.use(cors())
app.use(express.json({ limit: '2mb' }))

const scamKeywords = [
  'winner',
  'claim',
  'bonus',
  'free',
  'promo',
  'win',
  'reward',
  'click',
  'activate',
  'urgent',
  'prize',
  'reply yes',
  'send pin',
]

function parseAmount(text) {
  const amountMatch = text.match(/(?:ksh|kes|kshs|shs?)[^\d]*(\d[\d,]*(?:\.\d{2})?)/i)
  if (amountMatch) {
    return Number(amountMatch[1].replace(/,/g, ''))
  }

  const plainMatch = text.match(/(?<!\w)(\d[\d,]*(?:\.\d{2})?)(?!\w)/)
  return plainMatch ? Number(plainMatch[1].replace(/,/g, '')) : 0
}

function extractSender(text) {
  const senderMatch = text.match(/(?:from|sent to|received from|customer|client)\s+([A-Z][A-Za-z0-9 .'-]+)/i)
  if (senderMatch) return senderMatch[1].trim()

  const toMatch = text.match(/(?:to)\s+([A-Z][A-Za-z0-9 .'-]+)/i)
  if (toMatch) return toMatch[1].trim()

  return 'Unknown sender'
}

function extractCode(text) {
  const codeMatch = text.match(/(?:ref|code|transaction(?:\s+id)?|trx|ref no|receipt)\s*[:#-]?\s*([A-Z0-9]+)/i)
  if (codeMatch) return codeMatch[1].toUpperCase()

  const fallback = text.match(/[A-Z]{3,}[0-9A-Z]{3,}/)
  return fallback ? fallback[0].toUpperCase() : 'UNKNOWN'
}

function classifyMessage(message) {
  const cleaned = message.trim()
  const normalized = cleaned.toLowerCase()

  const hasScamSignal = scamKeywords.some((keyword) => normalized.includes(keyword))
  const amount = parseAmount(cleaned)
  const sender = extractSender(cleaned)
  const code = extractCode(cleaned)

  const lower = normalized
  const isCredit = /received|credited|paid|cash in|top up/i.test(lower)
  const isDebit = /sent|debited|withdrawn|bought|paid out|purchase/i.test(lower)

  let type = 'credit'
  if (isDebit && !isCredit) type = 'debit'
  if (!isCredit && !isDebit) type = 'credit'

  const isFake = hasScamSignal || (!amount && !/confirmed|received|sent|debited|credited/i.test(lower))
  const riskLevel = isFake ? 'high' : 'low'

  return {
    message: cleaned,
    amount,
    sender,
    code,
    type,
    is_fake: isFake ? 1 : 0,
    risk_level: riskLevel,
  }
}

function parseBatch(messages) {
  const entries = messages
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  return entries.map((entry) => classifyMessage(entry))
}

app.get('/api/summary', (req, res) => {
  res.json(summaryStats())
})

app.get('/api/transactions', (req, res) => {
  res.json(listTransactions())
})

app.get('/api/stock', (req, res) => {
  res.json(listStock())
})

app.get('/api/debtors', (req, res) => {
  res.json(listDebtors())
})

app.post('/api/transactions/analyze', (req, res) => {
  try {
    const { messages = '' } = req.body || {}
    const parsed = parseBatch(messages)
    const validResults = parsed.filter((item) => item.amount > 0)
    const scamCount = parsed.filter((item) => item.is_fake === 1).length

    validResults.forEach((item) => {
      addTransaction(item)
    })

    const summary = summaryStats()
    res.json({
      savedCount: validResults.length,
      scamCount,
      results: parsed,
      summary,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/transactions/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' })
    }

    const text = req.file.buffer.toString('utf8')
    const parsed = parseBatch(text)
    const validResults = parsed.filter((item) => item.amount > 0)

    validResults.forEach((item) => {
      addTransaction(item)
    })

    res.json({ savedCount: validResults.length, scamCount: parsed.filter((item) => item.is_fake === 1).length })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/stock', (req, res) => {
  try {
    const { name, quantity, unitCost, reorderLevel } = req.body || {}
    if (!name) {
      return res.status(400).json({ error: 'Item name is required.' })
    }

    const result = addStockItem({ name, quantity, unitCost, reorderLevel })
    res.json({ success: true, id: result.lastInsertRowid })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/debtors', (req, res) => {
  try {
    const { name, amount, note } = req.body || {}
    if (!name) {
      return res.status(400).json({ error: 'Debtor name is required.' })
    }

    const result = addDebtor({ name, amount, note })
    res.json({ success: true, id: result.lastInsertRowid })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist')
  app.use(express.static(distPath))

  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(port, () => {
  console.log(`M-Pesa Expense Guard running on http://localhost:${port}`)
})
