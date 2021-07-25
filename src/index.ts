import { config } from 'dotenv'
config()

import { start } from './database/client'
start()

import Koa from 'koa'
import logger from './logger'
import router, { ghttp } from './router'
import mount from 'koa-mount'
import cors from '@koa/cors'

const app = new Koa()

app
  .use(
    cors({
      origin: 'http://localhost:8080'
    })
  )
  .use(async (ctx: Koa.Context, next: Koa.Next) => {
    await next()

    logger('[ web ]', `(${ctx.status}) ${ctx.method} ${ctx.URL} < ${ctx.ip}`)
  })
  .use(router.routes())
  .use(router.allowedMethods())
  .use(mount('/graphql', ghttp))

app.listen(process.env.PORT, () => {
  logger('[ web ]', `server is listening on ${process.env.PORT}`)
})

export default app
