import { Context } from 'koa'
import {
  StoreOrderState,
  StorePaymentMethod,
  VerifiedStoreOrderRequest
} from '../@types/order'
import { KioskRoute } from 'src/@types/routes'

import dbAPI from '../database/api'
import tossAPI from '../toss/api'
import { clientsEvent } from '../events'

import orders from '../commands/order'

const validatePayMethod = (payWith: unknown) => {
  if (typeof payWith === 'undefined' || payWith === null) {
    throw new Error('결제 수단이 선택되지 않았습니다.')
  }

  const data =
    !isNaN(Number(payWith)) &&
    Object.values(StorePaymentMethod).filter(v => v === Number(payWith))[0]

  if (data === false || typeof data === 'undefined') {
    throw new Error('결제 수단 선택이 올바르지 않습니다.')
  }

  return data as StorePaymentMethod
}

const validateItems = async (
  items: unknown,
  payWith = StorePaymentMethod.Card
): Promise<VerifiedStoreOrderRequest> => {
  if (
    typeof items === 'undefined' ||
    items === null ||
    typeof items !== 'object'
  ) {
    throw new TypeError('not valid type.')
  }

  if (!Array.isArray(items)) {
    throw new TypeError('값이 배열이 아닙니다.')
  }

  let results: VerifiedStoreOrderRequest = {
    price: 0,
    payWith: payWith,
    items: []
  }

  let proceedItems = new Map<string, ''>()

  for (let i = 0; i < items.length; i++) {
    if (typeof items[i][0] !== 'number' || typeof items[i][1] !== 'string') {
      throw new Error(
        '물품의 수량이나 ID가 주어지지 않았거나 값이 올바르지 않습니다.'
      )
    }

    if (items[i][0] === 0) {
      throw new Error('어느 물품의 수량이 0개 입니다.')
    }

    // TODO : 물품 최대 수량 검사

    if (proceedItems.has(items[i][1])) {
      throw new Error('중복된 물품이 다른 단일 물품으로 존재합니다.')
    }

    const item = await dbAPI.getMenuItem(items[i][1])

    if (!item || typeof item !== 'object') {
      throw new Error(items[i][1] + '은(는) 없는 상품입니다.')
    }

    proceedItems.set(item.id, '')

    results.items.push({ ...item, amount: items[i][0] })
  }

  results.price = results.items
    .map(v => v.amount * v.price)
    .reduce((p, c) => p + c, 0)

  return results
}

const Route: KioskRoute[] = [
  {
    method: 'post',
    url: '/order',
    func: async (ctx: Context) => {
      const data = ctx.request.body

      if (typeof data === 'string') {
        throw new Error('요청한 데이터가 올바르지 않아 결제할 수 없습니다.')
      }

      if (!data.items) {
        throw new Error('결제할 항목이 지정되지 않아 결제할 수 없습니다.')
      }

      if (typeof data.payWith === 'undefined' || data.payWith === null) {
        throw new Error('결제 수단이 지정되지 않았습니다.')
      }

      const payWith = validatePayMethod(data.payWith)
      const items = await validateItems(data.items, payWith)

      const order = await dbAPI.makeAnPreOrder(
        items,
        StoreOrderState.WaitingPayment
      )

      console.log(order)

      return {
        order,
        toss: {
          amount: order.price,
          orderId: order.id,
          orderName:
            order.items[0].name +
            (order.items.length > 1
              ? ' 외 ' + (order.items.length - 1) + '건'
              : ''),
          customerName: '키오스크 결제'
        }
      }
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

      const order =
        (await dbAPI.getPreOrder(orderId)) || (await dbAPI.getOrder(orderId))

      if (!order) {
        throw new Error('요청한 주문이 없습니다.')
      }

      const cachedResponse = await dbAPI.getCachedPaymentsData(order.id)
      if (
        (order.state === StoreOrderState.WaitingPayment ||
          order.state === StoreOrderState.WaitingAccept) &&
        cachedResponse
      ) {
        return {
          ...cachedResponse,
          state: order.state
        }
      }

      if (order.state === StoreOrderState.Done) {
        throw new Error('이미 결제가 끝났습니다.')
      }

      if (Number(data.amount) !== order.price) {
        throw new Error('결제 금액이 요청한 금액과 다릅니다.')
      }

      if (order.state !== StoreOrderState.WaitingPayment) {
        throw new Error('이미 결제가 완료된 건이나 오류가 발생한 건입니다.')
      }

      let currentState = StoreOrderState.WaitingPayment
      let customResponse: { [index: string]: unknown } = {}
      let paymentSecret: string | undefined

      if (order.payWith === StorePaymentMethod.Direct) {
        currentState = StoreOrderState.WaitingAccept
      } else {
        if (typeof data.paymentKey !== 'string') {
          throw new Error('필요한 결재 키 값이 주어지지 않았습니다.')
        }

        const payments = await tossAPI.approvePayments(
          order.id,
          data.paymentKey,
          order.price
        )

        console.log(payments)

        if (payments.code && typeof payments.message !== 'undefined') {
          throw new Error(`${payments.code}: ${payments.message}`)
        }

        if (payments.cancels) {
          throw new Error('취소된 결제입니다.')
        }

        if (payments.totalAmount !== order.price) {
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

        await dbAPI.setPaymentSecret(order.id, payments.secret)

        paymentSecret = payments.secret
        customResponse.virtualAccount = payments.virtualAccount
      }

      if (currentState === StoreOrderState.WaitingPayment) {
        await dbAPI.updatePreOrder(order.id, {
          ...order,
          state: currentState
        })
      } else {
        await dbAPI.promotePreOrderToOrder({
          ...order,
          state: currentState
        })
      }

      const responseData = {
        state: currentState,
        price: order.price,
        ...customResponse
      }

      await dbAPI.cachePaymentsData(order.id, responseData)

      return responseData
    }
  },
  {
    method: 'post',
    url: '/order/:orderId/accept',
    func: async ctx => {
      const orderId = ctx.params.orderId

      if (typeof orderId !== 'string') {
        throw new Error('올바른 요청이 아닙니다.')
      }

      // TODO : 클라이언트 인증

      const order =
        (await dbAPI.getPreOrder(orderId)) || (await dbAPI.getOrder(orderId))

      if (!order) {
        throw new Error('주문이 없습니다.')
      }

      if (order.state === StoreOrderState.Done) {
        throw new Error('이미 확인이 완료된 주문입니다.')
      }

      if (order.state !== StoreOrderState.WaitingAccept) {
        throw new Error('확인을 기다리는 주문이 아닙니다.')
      }

      const newOrder = {
        ...order,
        state: StoreOrderState.Done
      }

      await dbAPI.updateOrder(order.id, newOrder)

      try {
        clientsEvent.run('command', order.id, 'STATE_UPDATE', newOrder)
      } catch (e) {}

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
        !ctx.request.body.cancelReason ||
        typeof ctx.request.body.cancelReason !== 'string'
      ) {
        throw new Error('취소되는 이유를 지정하지 않았습니다.')
      }

      if (ctx.request.body.cancelReason.length > 2 ** 8) {
        throw new Error('취소하는 이유가 너무 깁니다. (> 256)')
      }

      await orders.cancel(
        orderId,
        ctx.request.body.cancelReason,
        async (order, reason) => {
          if (order.state === StoreOrderState.WaitingAccept) {
            try {
              await tossAPI.cancelPayment(order.id, reason)

              return true
            } catch (e) {
              console.log(e)
              return false
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
