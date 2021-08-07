import { validateUUID } from '../utils/string'
import dbAPI from '../database/api'
import {
  StoreOrder,
  StoreOrderState,
  VerifiedStoreOrderRequest
} from '../@types/order'
import { clientsEvent, orderEvents } from '../events'

/**
 * 데이터베이스에서 주문을 가져와 반환합니다.
 * @param id  가져올 주문의 ID
 */
const get = async (id: string) => {
  const data = await dbAPI.findOrder(id)

  return data && data.order
}

/**
 * 데이터베이스에서 모든 주문을 가져와 반환합니다.
 */
const all = async () =>
  (await dbAPI.getAllOrders())?.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

/**
 * 데이터베이스에서 주문을 삭제합니다. preOrder인 경우 객체를 삭제하고,
 * 일반 order인 경우에는 취소 상태로 만들어 업데이트합니다.
 *
 * @param id 취소할 주문의 ID
 * @param cancelReason 주문을 취소하는 이유
 * @param cancelValidation 주문을 취소하기 전에 실행할 함수
 */
const cancel = async (
  id: string,
  cancelReason: string,
  cancelValidation?: (
    order: StoreOrder,
    reason: string
  ) => Promise<boolean | Error>
) => {
  if (!validateUUID(id)) {
    throw new Error('주어진 ID가 올바른 ID가 아닙니다.')
  }

  let orderResult = await dbAPI.findOrder(id)

  if (orderResult === null) {
    throw new Error('해당 주문은 없습니다.')
  }

  if (cancelReason.length > 2 ** 8) {
    throw new Error('취소하는 이유가 너무 깁니다. (> 256)')
  }

  if (orderResult.order.state === StoreOrderState.Canceled) {
    throw new Error('이미 취소된 주문입니다.')
  }

  const validation =
    cancelValidation &&
    (await cancelValidation(orderResult.order, cancelReason))

  if (validation && validation !== true) {
    throw validation instanceof Error
      ? validation
      : new Error('취소 요청 검증에 실패하여 취소하지 못했습니다.')
  }

  orderResult.order.state = StoreOrderState.Canceled
  orderResult.order.cancel = {
    reason: cancelReason,
    date: new Date().toISOString()
  }

  if (orderResult.preOrder) {
    await dbAPI.deletePreOrder(orderResult.order.id)
  } else {
    await dbAPI.updateOrder(orderResult.order.id, orderResult.order)
  }

  ;(res => {
    setTimeout(() => {
      orderEvents.runAll('canceled', {
        id: res.order.id,
        type: 'STATUS_UPDATE',
        order: res.order
      })
    })
  })(orderResult)
}

/**
 * ID가 없는 주문 데이터를 ID를 가진 주문 데이터로 만들고, DB에 사전 주문을 생성합니다.
 * @param data ID가 없는 주문 데이터
 */
const place = async (
  data: VerifiedStoreOrderRequest,
  payWith = StoreOrderState.WaitingPayment
) => {
  const order = await dbAPI.makeAnPreOrder(data, payWith)
  const rank = await dbAPI.makeAnOrderDate(order)

  orderEvents.runAll('placed', {
    id: order.id,
    type: 'STATUS_UPDATE',
    order: order
  })

  return order
}

/**
 * 데이터베이스에서 주어진 날짜의 범위를 가져와 반환합니다.
 *
 * @param start 검색을 시작할 시각 (초)
 * @param end 검색을 끝낼 시각 (초)
 */
const findByDate = async (start: number, end: number) => {
  const orderNames = await dbAPI.findOrderRange(start, end)

  if (!orderNames) {
    return []
  }

  return (((await dbAPI.getOrders(...orderNames)).filter(
    v => v !== null
  ) as unknown) as StoreOrder[]).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
}

/**
 * 주문 상태를 변경합니다.
 *
 * @param orderId 주문의 ID
 * @param status 변경할 주문의 상태
 */
const updateStatus = async (orderId: string, status: StoreOrderState) => {
  const found = await dbAPI.findOrder(orderId)

  if (!found) {
    throw new Error('해당 주문을 찾을 수 없습니다.')
  }

  const newData = {
    ...found.order,
    state: status
  }

  orderEvents.runAll('statusUpdate', {
    id: found.order.id,
    type: 'STATUS_UPDATE',
    order: newData
  })

  if (found.preOrder) {
    return dbAPI.updatePreOrder(orderId, newData)
  }

  return dbAPI.updateOrder(orderId, newData)
}

const accept = async (orderId: string) => {
  const found = await dbAPI.findOrder(orderId)

  if (!found) {
    throw new Error('주문이 없습니다.')
  }

  if (found.order.state === StoreOrderState.Done) {
    throw new Error('이미 확인이 완료된 주문입니다.')
  }

  if (found.order.state !== StoreOrderState.WaitingAccept) {
    throw new Error('확인을 기다리는 주문이 아닙니다.')
  }

  const newOrder = {
    ...found.order,
    state: StoreOrderState.Done
  }

  await dbAPI.updateOrder(found.order.id, newOrder)

  try {
    orderEvents.runAll('accepted', {
      id: found.order.id,
      type: 'STATUS_UPDATE',
      order: newOrder
    })
    clientsEvent.run('command', newOrder.id, 'STATE_UPDATE', newOrder)
  } catch (e) {}

  return true
}

export default {
  get,
  all,
  cancel,
  place,
  updateStatus,
  findByDate,
  accept
}
