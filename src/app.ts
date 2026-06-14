import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { env } from './shared/config/env'
import { errorHandler } from './shared/middlewares/error-handler'
import authRouter from './modules/auth/auth.router'
import userRouter from './modules/users/user.router'
import productRouter from './modules/products/product.router'
import basketRouter from './modules/basket/basket.router'
import orderRouter from './modules/orders/order.router'
import checkoutRouter from './modules/checkout/checkout.router'
import paymentRouter from './modules/payments/payment.router'
import reviewRouter from './modules/reviews/review.router'
import warehouseRouter from './modules/warehouses/warehouse.router'
import inventoryRouter from './modules/inventory/inventory.router'
import shipmentRouter from './modules/shipments/shipment.router'
import addressRouter from './modules/address/address.router'

const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json())

app.use(authRouter)
app.use(userRouter)
app.use(productRouter)
app.use(basketRouter)
app.use(orderRouter)
app.use(checkoutRouter)
app.use(paymentRouter)
app.use(reviewRouter)
app.use(warehouseRouter)
app.use(inventoryRouter)
app.use(shipmentRouter)
app.use(addressRouter)

app.use(errorHandler)

export default app