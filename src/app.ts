import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { env } from './shared/config/env'
import { errorHandler } from './shared/middlewares/error-handler'

const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json())

// Routes (à ajouter au fur et à mesure)
// app.use(authRouter)
// app.use(userRouter)

app.use(errorHandler)

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`)
})

export default app