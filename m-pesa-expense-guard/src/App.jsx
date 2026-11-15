import { useEffect, useMemo, useState } from 'react'

const sampleMessages = `Confirmed. KSh 2,500.00 sent to Jane Wanjiku for stock on 15/11/2026 at 12:30 PM. Ref: ABX8791N.
Confirmed. KSh 3,200.00 received from Martin Njeri for rice delivery. Ref: SDQ44F9.
Alert! You have won KSh 5,000 from Safaricom. Reply YES to claim your prize and secure your bonus.
`

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'Request failed')
  }

  return response.json()
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

export default function App() {
  const [smsInput, setSmsInput] = useState(sampleMessages)
  const [summary, setSummary] = useState({
    dailySales: 0,
    dailyExpenses: 0,
    dailyProfit: 0,
    pendingDebts: 0,
    inventoryValue: 0,
    suspiciousCount: 0,
  })
  const [transactions, setTransactions] = useState([])
  const [stock, setStock] = useState([])
  const [debtors, setDebtors] = useState([])
  const [status, setStatus] = useState('')
  const [stockForm, setStockForm] = useState({
    name: '',
    quantity: 10,
    unitCost: 120,
    reorderLevel: 5,
  })
  const [debtorForm, setDebtorForm] = useState({
    name: '',
    amount: 2500,
    note: 'Stock advance',
  })

  const loadDashboard = async () => {
    try {
      const [summaryRes, transactionsRes, stockRes, debtorsRes] = await Promise.all([
        fetchJson('/api/summary'),
        fetchJson('/api/transactions'),
        fetchJson('/api/stock'),
        fetchJson('/api/debtors'),
      ])

      setSummary(summaryRes)
      setTransactions(transactionsRes)
      setStock(stockRes)
      setDebtors(debtorsRes)
    } catch (error) {
      setStatus(error.message)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const riskCounts = useMemo(() => {
    return transactions.reduce(
      (acc, transaction) => {
        if (transaction.is_fake) {
          acc.fake += 1
        } else {
          acc.valid += 1
        }
        return acc
      },
      { valid: 0, fake: 0 },
    )
  }, [transactions])

  const handleAnalyze = async () => {
    try {
      setStatus('Checking messages...')
      const response = await fetchJson('/api/transactions/analyze', {
        method: 'POST',
        body: JSON.stringify({ messages: smsInput }),
      })
      setStatus(`${response.savedCount} valid transactions logged. ${response.scamCount} scam alerts flagged.`)
      await loadDashboard()
    } catch (error) {
      setStatus(error.message)
    }
  }

  const handleUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/transactions/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const result = await response.json()
      setStatus(`${result.savedCount} transactions imported from ${file.name}.`)
      await loadDashboard()
    } catch (error) {
      setStatus(error.message)
    }
  }

  const handleAddStock = async (event) => {
    event.preventDefault()

    try {
      await fetchJson('/api/stock', {
        method: 'POST',
        body: JSON.stringify({ ...stockForm, quantity: Number(stockForm.quantity), unitCost: Number(stockForm.unitCost), reorderLevel: Number(stockForm.reorderLevel) }),
      })
      setStockForm({ name: '', quantity: 10, unitCost: 120, reorderLevel: 5 })
      setStatus('Stock updated.')
      await loadDashboard()
    } catch (error) {
      setStatus(error.message)
    }
  }

  const handleAddDebtor = async (event) => {
    event.preventDefault()

    try {
      await fetchJson('/api/debtors', {
        method: 'POST',
        body: JSON.stringify({ ...debtorForm, amount: Number(debtorForm.amount) }),
      })
      setDebtorForm({ name: '', amount: 2500, note: 'Stock advance' })
      setStatus('Debtor record added.')
      await loadDashboard()
    } catch (error) {
      setStatus(error.message)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Trader income shield</p>
          <h1>M-Pesa Scam & Expense Guard</h1>
        </div>
        <div className="badge success">Live dashboard</div>
      </header>

      <section className="summary-grid">
        <div className="metric-card">
          <span>Daily sales</span>
          <strong>{formatCurrency(summary.dailySales)}</strong>
        </div>
        <div className="metric-card expense">
          <span>Daily expenses</span>
          <strong>{formatCurrency(summary.dailyExpenses)}</strong>
        </div>
        <div className="metric-card profit">
          <span>Net profit</span>
          <strong>{formatCurrency(summary.dailyProfit)}</strong>
        </div>
        <div className="metric-card warning">
          <span>Risk alerts</span>
          <strong>{summary.suspiciousCount}</strong>
        </div>
      </section>

      <section className="panel-grid">
        <div className="panel">
          <div className="section-header">
            <h2>SMS intake</h2>
            <label className="upload-btn">
              Upload text file
              <input type="file" accept=".txt,.csv,.log" onChange={handleUpload} />
            </label>
          </div>

          <textarea
            value={smsInput}
            onChange={(event) => setSmsInput(event.target.value)}
            rows={11}
            placeholder="Paste M-Pesa messages here, one per line or paragraph."
          />

          <div className="action-row">
            <button onClick={handleAnalyze}>Analyze messages</button>
          </div>

          {status && <p className="status">{status}</p>}
        </div>

        <div className="panel">
          <h2>Snapshot</h2>
          <div className="stats-list">
            <div>
              <span>Valid messages</span>
              <strong>{riskCounts.valid}</strong>
            </div>
            <div>
              <span>Scam flags</span>
              <strong>{riskCounts.fake}</strong>
            </div>
            <div>
              <span>Pending debts</span>
              <strong>{formatCurrency(summary.pendingDebts)}</strong>
            </div>
            <div>
              <span>Inventory value</span>
              <strong>{formatCurrency(summary.inventoryValue)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="two-col-layout">
        <div className="panel">
          <h2>Recent M-Pesa activity</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sender</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Code</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No transactions yet.</td>
                  </tr>
                ) : (
                  transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{transaction.sender}</td>
                      <td>{transaction.type}</td>
                      <td>{formatCurrency(transaction.amount)}</td>
                      <td>{transaction.code}</td>
                      <td>
                        <span className={transaction.is_fake ? 'pill danger' : 'pill ok'}>
                          {transaction.is_fake ? 'Scam' : 'Valid'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h2>Stock check</h2>
          <form onSubmit={handleAddStock} className="compact-form">
            <input
              type="text"
              placeholder="Item name"
              value={stockForm.name}
              onChange={(event) => setStockForm({ ...stockForm, name: event.target.value })}
            />
            <div className="inline-fields">
              <input
                type="number"
                placeholder="Qty"
                value={stockForm.quantity}
                onChange={(event) => setStockForm({ ...stockForm, quantity: Number(event.target.value) })}
              />
              <input
                type="number"
                placeholder="Unit cost"
                value={stockForm.unitCost}
                onChange={(event) => setStockForm({ ...stockForm, unitCost: Number(event.target.value) })}
              />
            </div>
            <input
              type="number"
              placeholder="Reorder level"
              value={stockForm.reorderLevel}
              onChange={(event) => setStockForm({ ...stockForm, reorderLevel: Number(event.target.value) })}
            />
            <button type="submit">Add stock item</button>
          </form>

          <div className="mini-table">
            {stock.map((item) => (
              <div key={item.id} className="mini-row">
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.quantity} units</span>
                </div>
                <div className={item.quantity <= item.reorder_level ? 'low-stock' : ''}>
                  {item.quantity <= item.reorder_level ? 'Low stock' : 'Healthy'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="two-col-layout">
        <div className="panel">
          <h2>Debtors</h2>
          <form onSubmit={handleAddDebtor} className="compact-form">
            <input
              type="text"
              placeholder="Debtor name"
              value={debtorForm.name}
              onChange={(event) => setDebtorForm({ ...debtorForm, name: event.target.value })}
            />
            <input
              type="number"
              placeholder="Amount owed"
              value={debtorForm.amount}
              onChange={(event) => setDebtorForm({ ...debtorForm, amount: Number(event.target.value) })}
            />
            <input
              type="text"
              placeholder="Reason"
              value={debtorForm.note}
              onChange={(event) => setDebtorForm({ ...debtorForm, note: event.target.value })}
            />
            <button type="submit">Add debtor</button>
          </form>

          <div className="mini-table">
            {debtors.map((debtor) => (
              <div key={debtor.id} className="mini-row debtor-row">
                <div>
                  <strong>{debtor.name}</strong>
                  <span>{debtor.note}</span>
                </div>
                <div>{formatCurrency(debtor.amount)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>Profit logic</h2>
          <ul className="logic-list">
            <li>Sales = valid M-Pesa credits received from customers.</li>
            <li>Expenses = valid money sent to stock suppliers or household costs.</li>
            <li>Profit = Sales - Expenses - outstanding debtor risk.</li>
            <li>Scam queue = suspicious messages blocked from the ledger.</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
