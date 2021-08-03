import { StoreOrderState } from '../@types/order'
import orders from '../commands/orders'
import { clientsEvent, orderEvents } from '../events'

orderEvents.on('accepted', event => {
  clientsEvent.run('command', event.id, 'STATE_UPDATE', event.order)
})

orderEvents.on('canceled', event => {
  clientsEvent.run('command', event.id, 'STATE_UPDATE', event.order)
})

orderEvents.on('payments', event => {
  // FIXME : 아직 결제를 승인하는 front UI가 구현되지 않아 3초 후에 자동으로 요청 승인
  if (event.order.state === StoreOrderState.WaitingAccept) {
    setTimeout(async () => {
      await orders.accept(event.id)
    }, 3000)
  }

  // 지정된 시간 후에도 결제가 완료되지 않는 경우 결제를 취소
  if (event.order.state === StoreOrderState.WaitingPayment) {
    setTimeout(async () => {
      const data = await orders.get(event.id)

      if (data && data.state === StoreOrderState.WaitingPayment) {
        await orders.cancel(event.id, '결제 시간 초과')
      }
    }, ((process.env.DEFAULT_PAYMENT_TIMEOUT as number | undefined) || 99999) * 1000)
  }
})
