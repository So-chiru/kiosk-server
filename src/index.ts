import { config } from 'dotenv'
config()

import { start } from './database/client'
start()

import http from 'http'

import Koa from 'koa'
import logger from './logger'
import router, { ghttp } from './router'
import mount from 'koa-mount'
import cors from '@koa/cors'
import bodyParser from 'koa-bodyparser'

const app = new Koa()

app
  .use(
    cors({
      origin: 'http://localhost:8080'
    })
  )
  .use(bodyParser())
  .use(async (ctx: Koa.Context, next: Koa.Next) => {
    const start = Date.now()

    await next()

    logger(
      '[ web ]',
      `${ctx.status} ${ctx.method} ${ctx.URL} < ${ctx.ip} - ${Date.now() -
        start}ms`
    )
  })
  .use(router.routes())
  .use(router.allowedMethods())
  .use(mount('/graphql', ghttp))

export const server = http.createServer(app.callback())

server.listen(process.env.PORT, () => {
  logger('[ web ]', `server is listening on ${process.env.PORT}`)
})

import './socket'
import './routines/order'

export default app
