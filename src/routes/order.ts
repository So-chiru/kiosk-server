import { Context } from 'koa'
import {
  StoreOrderState,
  StorePaymentMethod,
  VerifiedStoreOrderRequest
} from '../@types/order'
import { KioskRoute } from 'src/@types/routes'

import dbAPI from '../database/api'
import { approvePayments } from '../toss/api'

const validatePayMethod = (payWith: unknown) => {
  if (typeof payWith === 'undefined' || payWith === null) {
    throw new Error('결제 수단이 선택되지 않았습니다.')
  }

  const data =
    !isNaN(Number(payWith)) &&
    Object.values(StorePaymentMethod).filter(v => v === Number(payWith))[0]

  console.log(data)

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
      try {
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

        const order = await dbAPI.makeAnOrder(
          items,
          StoreOrderState.WaitingPayment
        )

        console.log(order)

        ctx.body = JSON.stringify({
          status: 'success',
          data: {
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
        })
      } catch (e) {
        ctx.body = JSON.stringify({
          status: 'error',
          error: e.message
        })
      }
    }
  },
  {
    method: 'post',
    url: '/order/payment',
    func: async ctx => {
      try {
        const data = ctx.request.body

        if (typeof data === 'string') {
          throw new Error('요청한 데이터가 올바르지 않아 결제할 수 없습니다.')
        }

        console.log(data)

        if (
          typeof data.orderId !== 'string' ||
          typeof data.paymentKey !== 'string' ||
          typeof data.amount !== 'string' ||
          isNaN(Number(data.amount))
        ) {
          throw new Error('결제 데이터가 올바르게 지정되지 않았습니다.')
        }

        const order = await dbAPI.getOrder(data.orderId)

        if (!order) {
          throw new Error('요청한 주문이 없습니다.')
        }

        if (Number(data.amount) !== order.price) {
          throw new Error('결제 금액이 요청한 금액과 다릅니다.')
        }

        if (order.state !== StoreOrderState.WaitingPayment) {
          throw new Error('이미 결제가 완료된 건이나 오류가 발생한 건입니다.')
        }

        const payments = await approvePayments(
          data.orderId,
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

        let currentState = StoreOrderState.WaitingPayment

        if (payments.status === 'DONE') {
          currentState = StoreOrderState.Purchased
        } else if (payments.status === 'READY') {
          currentState = StoreOrderState.Ready
        } else if (payments.status === 'IN_PROGRESS') {
          currentState = StoreOrderState.InProgress
        }

        dbAPI.updateOrder(order.id, {
          ...order,
          state: currentState
        })

        ctx.body = JSON.stringify({
          status: 'success',
          data: {
            state: currentState,
            price: payments.totalAmount,
            virtualAccount: payments.virtualAccount
          }
        })
      } catch (e) {
        ctx.status = 500
        ctx.body = JSON.stringify({
          status: 'error',
          error: e.message
        })
      }
    }
  }
]

export default Route
