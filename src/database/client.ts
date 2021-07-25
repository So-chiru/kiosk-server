import logger from '../logger'
import { RedisClient } from 'redis'

if (!process.env.DB_HOST || !process.env.DB_PORT) {
  throw new Error(
    'proccess.env.DB_HOST or process.env.DB_PORT is not defined. Please define it at /.env'
  )
}

let client: RedisClient = new RedisClient({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  password: process.env.DB_PASS
})

export const init = async () => {
  // const db = process.env.NODE_ENV === 'production' ? 1 : 2
  const db = 2

  const response = await client.select(db)

  if (response) {
    logger('[ dbc ]', 'database changed to ' + db)
    return
  }

  logger('[ dbc ]', 'failed to change db to ' + db)
}

export const isDatabaseClientReady = () => {
  return client && client.connected
}

export const start = () => {}

client.on('ready', () => {
  logger('[ dbc ]', 'redis client is now ready.')

  init()
})

client.on('error', err => {
  console.log(err)
})

export default client
