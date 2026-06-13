import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { env } from './shared/config/env'
import { errorHandler } from './shared/middlewares/error-handler'
import authRouter from './modules/auth/auth.router'
import userRouter from './modules/users/user.router'
import productRouter from './modules/products/product.router'
import basketRouter from './modules/basket/basket.router'

const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json())

app.use(authRouter)
app.use(userRouter)
app.use(productRouter)
app.use(basketRouter)

app.use(errorHandler)

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`)
})

export default app