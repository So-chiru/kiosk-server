import { Context } from 'koa'
import { StoreOrderState, StorePaymentMethod } from '../@types/order'
import { KioskRoute } from '../@types/routes'

import dbAPI from '../database/api'
import tossAPI from '../toss/api'
import { clientsEvent, orderEvents } from '../events'

import orders from '../commands/orders'
import {
  validateOrderItems,
  validatePayMethod,
  verifyOrderRequest
} from '../utils/order'

const Route: KioskRoute[] = [
  {
    method: 'post',
    url: '/order',
    func: async (ctx: Context) => {
      const data = ctx.request.body

      if (typeof data === 'string' && typeof data !== 'object') {
        throw new Error('요청한 데이터가 올바르지 않아 결제할 수 없습니다.')
      }

      if (!data.items) {
        throw new Error('결제할 항목이 지정되지 않아 결제할 수 없습니다.')
      }

      if (typeof data.payWith === 'undefined' || data.payWith === null) {
        throw new Error('결제 수단이 지정되지 않았습니다.')
      }

      if (!verifyOrderRequest(data as Record<string, unknown>)) {
        throw new Error('요청이 올바르지 않습니다.')
      }

      const payWith = validatePayMethod(data.payWith)
      const items = await validateOrderItems(data.items, payWith)

      const result = await orders.place(items)

      return {
        order: result,
        toss: {
          amount: result.price,
          orderId: result.id,
          orderName:
            result.items[0].name +
            (result.items.length > 1
              ? ' 외 ' + (result.items.length - 1) + '건'
              : ''),
          customerName: '키오스크 결제'
        }
      }
    }
  },
  {
    method: 'get',
    url: '/orders',
    func: async (ctx: Context) => {
      const query = ctx.query

      if (
        typeof query.start !== 'undefined' ||
        typeof query.end !== 'undefined'
      ) {
        const start = Number(query.start)
        const end = Number(query.end)

        if (isNaN(start) || start < 0 || start > 2 ** 32)
          throw new Error('검색 시작 범위 값이 올바르지 않습니다.')
        if (isNaN(end) || end < 0 || end > 2 ** 32)
          throw new Error('검색 시작 범위 값이 올바르지 않습니다.')

        return orders.findByDate(start, end)
      }

      return orders.all()
    }
  },
  {
    method: 'post',
    url: '/order/:orderId/payment',
    func: async ctx => {
      const data = ctx.request.body

      if (typeof data === 'string') {
        throw new Error('요청한 데이터가 올바르지 않아 결제할 수 없습니다.')
      }

      const orderId = ctx.params.orderId

      if (!orderId || typeof orderId !== 'string') {
        throw new Error('올바른 주문 ID가 주어지지 않았습니다.')
      }

      if (typeof data.amount !== 'string' || isNaN(Number(data.amount))) {
        throw new Error('올바른 금액이 주어지지 않았습니다.')
      }

      const found = await dbAPI.findOrder(orderId)

      if (!found) {
        throw new Error('요청한 주문이 없습니다.')
      }

      const cachedResponse = await dbAPI.getCachedPaymentsData(found.order.id)
      if (
        (found.order.state === StoreOrderState.WaitingPayment ||
          found.order.state === StoreOrderState.WaitingAccept) &&
        cachedResponse
      ) {
        return {
          ...cachedResponse,
          state: found.order.state
        }
      }

      if (found.order.state === StoreOrderState.Done) {
        throw new Error('이미 결제가 끝났습니다.')
      }

      if (Number(data.amount) !== found.order.price) {
        throw new Error('결제 금액이 요청한 금액과 다릅니다.')
      }

      if (found.order.state !== StoreOrderState.WaitingPayment) {
        throw new Error('이미 결제가 완료된 건이나 오류가 발생한 건입니다.')
      }

      let currentState = StoreOrderState.WaitingPayment
      let customResponse: { [index: string]: unknown } = {}

      if (found.order.payWith === StorePaymentMethod.Direct) {
        currentState = StoreOrderState.WaitingAccept
      } else {
        if (typeof data.paymentKey !== 'string') {
          throw new Error('필요한 결재 키 값이 주어지지 않았습니다.')
        }

        const payments = await tossAPI.approvePayments(
          found.order.id,
          data.paymentKey,
          found.order.price
        )

        console.log(payments)

        if (payments.code && typeof payments.message !== 'undefined') {
          throw new Error(`${payments.code}: ${payments.message}`)
        }

        if (payments.cancels) {
          throw new Error('취소된 결제입니다.')
        }

        if (payments.totalAmount !== found.order.price) {
          throw new Error('결제한 금액과 상품의 가격이 다릅니다.')
        }

        // TODO : 계좌 이체인 경우에는 따로 처리
        if (
          !payments ||
          payments.status === 'CANCELED' ||
          payments.status === 'PARTIAL_CANCELED' ||
          payments.status === 'ABORTED' ||
          payments.status === 'EXPIRED'
        ) {
          throw new Error('결제가 완료된 상태가 아닙니다. ' + payments.status)
        }

        if (payments.status === 'DONE') {
          currentState = StoreOrderState.WaitingAccept
        } else if (
          payments.status === 'READY' ||
          payments.status === 'IN_PROGRESS'
        ) {
          currentState = StoreOrderState.WaitingPayment
        }

        await dbAPI.setPaymentSecret(found.order.id, payments.secret)

        customResponse.virtualAccount = payments.virtualAccount
      }

      const newData = {
        ...found.order,
        state: currentState
      }

      if (currentState === StoreOrderState.WaitingPayment) {
        await dbAPI.updatePreOrder(found.order.id, newData)
      } else {
        await dbAPI.promotePreOrderToOrder(newData)
      }

      try {
        orderEvents.runAll('payments', {
          id: found.order.id,
          type: 'STATUS_UPDATE',
          order: newData
        })
      } catch (e) {}

      const responseData = {
        state: currentState,
        left:
          ((process.env.DEFAULT_PAYMENT_TIMEOUT as number | undefined) ||
            99999) * 1000,
        price: found.order.price,
        ...customResponse
      }

      await dbAPI.cachePaymentsData(found.order.id, responseData)

      return responseData
    }
  },
  {
    method: 'get',
    url: '/order/:orderId/accept',
    func: async ctx => {
      const orderId = ctx.params.orderId

      if (typeof orderId !== 'string') {
        throw new Error('올바른 요청이 아닙니다.')
      }

      await orders.accept(orderId)

      return true
    }
  },
  {
    method: 'post',
    url: '/order/toss_deposit',
    func: async ctx => {
      const body = ctx.request.body

      if (!body || typeof body !== 'object') {
        throw new Error('올바른 요청이 아닙니다.')
      }

      if (
        typeof body.secret !== 'string' ||
        typeof body.orderId !== 'string' ||
        typeof body.status !== 'string'
      ) {
        throw new Error('올바른 요청이 아닙니다.')
      }

      if (
        body.secret !== (await dbAPI.getPaymentSecret(body.orderId as string))
      ) {
        throw new Error('결제 정보가 올바르지 않습니다.')
      }

      const order =
        (await dbAPI.getPreOrder(body.orderId)) ||
        (await dbAPI.getOrder(body.orderId))

      if (!order) {
        throw new Error('주문이 없습니다.')
      }

      const currentState =
        body.status === 'DONE'
          ? StoreOrderState.WaitingAccept
          : StoreOrderState.Canceled

      const newOrder = {
        ...order,
        state: currentState
      }

      await dbAPI.promotePreOrderToOrder(newOrder)

      try {
        clientsEvent.run('command', order.id, 'STATE_UPDATE', newOrder)
        clientsEvent.runAll('adminCommand', 'ORDER_UPDATE', newOrder)
      } catch (e) {}

      return true
    }
  },
  {
    method: 'post',
    url: '/order/:orderId/cancel',
    func: async ctx => {
      const orderId = ctx.params.orderId

      if (!orderId) {
        throw new Error('주문 ID가 지정되지 않았습니다.')
      }

      if (typeof ctx.request.body !== 'object') {
        throw new Error('요청 body가 Object 타입이 아닙니다.')
      }

      if (
        !ctx.request.body.reason ||
        typeof ctx.request.body.reason !== 'string'
      ) {
        throw new Error('취소되는 이유를 지정하지 않았습니다.')
      }

      if (ctx.request.body.reason.length > 2 ** 8) {
        throw new Error('취소하는 이유가 너무 깁니다. (> 256)')
      }

      await orders.cancel(
        orderId,
        ctx.request.body.reason,
        async (order, reason) => {
          if (
            order.state === StoreOrderState.WaitingAccept ||
            order.state === StoreOrderState.Done
          ) {
            if (order.payWith === StorePaymentMethod.Direct) {
              return true
            }

            try {
              await tossAPI.cancelPayment(order.id, reason)

              return true
            } catch (e) {
              return e
            }
          }

          return true
        }
      )

      return true
    }
  }
]

export default Route
