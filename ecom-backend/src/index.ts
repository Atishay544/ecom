import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import 'dotenv/config'

import productsRouter  from './routes/products'
import categoriesRouter from './routes/categories'
import cartRouter       from './routes/cart'
import checkoutRouter   from './routes/checkout'
import ordersRouter     from './routes/orders'
import adminRouter      from './routes/admin'
import searchRouter     from './routes/search'
import miscRouter       from './routes/misc'
import webhooksRouter   from './routes/webhooks'

const app = express()
const PORT = process.env.PORT || 4000

app.use(helmet())
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'] }))

// Raw body for Razorpay webhook signature verification
app.use('/api/webhooks', express.raw({ type: 'application/json' }), (req, _res, next) => {
  if (Buffer.isBuffer(req.body)) req.body = JSON.parse(req.body.toString())
  next()
})

app.use(express.json())

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.use('/api/products',   productsRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/cart',       cartRouter)
app.use('/api/checkout',   checkoutRouter)
app.use('/api/orders',     ordersRouter)
app.use('/api/admin',      adminRouter)
app.use('/api/search',     searchRouter)
app.use('/api',            miscRouter)
app.use('/api/webhooks',   webhooksRouter)

// 404 handler
app.use((_req, res) => res.status(404).json({ data: null, error: 'Not found' }))

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`))

export default app
