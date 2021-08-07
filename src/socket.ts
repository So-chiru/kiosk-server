import { IncomingMessage } from 'http'
import { Socket } from 'net'
import { v4 as uuidv4 } from 'uuid'
import WebSocket from 'ws'
import { clientsEvent } from './events'

import { server } from './index'
import logger from './logger'

const wss = new WebSocket.Server({
  noServer: true
})

const subscribePool = new Map()

wss.on('connection', (ws, req) => {
  logger(
    '[ soc ]',
    `${req.method} ${req.url}:connect < ${req.socket.remoteAddress}`
  )
  ;(ws as any).id = uuidv4()

  subscribePool.set((ws as any).id, ws)

  ws.on('command', (code: string, data: unknown) => {
    ws.send(
      JSON.stringify({
        code,
        data
      })
    )
  })

  ws.on('message', data => {
    logger(
      '[ soc ]',
      `${req.method} ${req.url}:message<${data}> < ${req.socket.remoteAddress}`
    )

    if (data.toString().indexOf('{') === 0) {
      const message = JSON.parse(data.toString())

      if (message.setOrderId) {
        clientsEvent.on(
          'command',
          (...args: any[]) => ws.emit('command', ...args),
          message.setOrderId
        )
      } else if (message.setAdmin) {
        // TODO : 클라이언트가 권한을 가지고 있는지 확인하는 로직 만들기

        ;(ws as any).admin = true
      }
    }
  })

  ws.on('close', () => {
    subscribePool.delete((ws as any).id)
  })
})

export const sendOrderClient = (
  orderId: string,
  func: (ws: WebSocket) => void
) => {
  wss.clients.forEach(socket => {
    if (socket && (socket as any).orderId === orderId) func(socket)
  })
}

export const sendAdminClient = (func: (ws: WebSocket) => void) => {
  wss.clients.forEach(socket => {
    if (socket && (socket as any).admin) func(socket)
  })
}

clientsEvent.on('adminCommand', (...args: any[]) => {
  sendAdminClient(ws => {
    ws.emit('command', ...args)
  })
})

server.on(
  'upgrade',
  (request: IncomingMessage, socket: Socket, head: Buffer) => {
    if (request.url !== '/socket') {
      return
    }

    // 여기서 클라이언트 인증

    wss.handleUpgrade(request, socket, head, ws => {
      wss.emit('connection', ws, request)
    })
  }
)

export default wss
