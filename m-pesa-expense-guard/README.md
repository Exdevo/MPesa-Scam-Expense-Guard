# M-Pesa Scam & Expense Guard for Small Traders

A small business finance dashboard for traders who receive M-Pesa messages daily. It helps to:

- parse incoming M-Pesa SMS text or uploaded files,
- flag suspicious scam-style messages,
- record valid transactions,
- track profit and loss,
- monitor stock and debtors.

## Stack

- React for the frontend
- Node.js + Express for the API
- SQLite for persistent local storage

## Features

- Paste or upload SMS messages
- Detect fake M-Pesa messages with risk scoring
- Save valid transactions to SQLite
- Auto-calculate daily profit and loss
- Track inventory stock levels
- Track debtor balances

## Run locally

```bash
npm install
npm run dev
```

The app runs at http://localhost:5173 and the API is served from http://localhost:3001.

## Production build

```bash
npm run build
npm start
```

## Notes

- The app stores data in `server/data.sqlite`.
- The database is seeded with sample items for demo purposes.
