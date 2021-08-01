import { validateUUID } from '../utils/string'
import dbAPI from '../database/api'
import { StoreOrder, StoreOrderState } from '../@types/order'

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
  cancelValidation?: (order: StoreOrder, reason: string) => Promise<boolean>
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

  if (
    cancelValidation &&
    !(await cancelValidation(orderResult.order, cancelReason))
  ) {
    throw new Error('취소 요청 검증에 실패하여 취소하지 못했습니다.')
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
}

export default {
  cancel
}