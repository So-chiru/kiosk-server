import orders from '../commands/orders'
import { clientsEvent, orderEvents } from '../events'

orderEvents.on('accepted', event => {
  clientsEvent.run('command', event.id, 'STATE_UPDATE', event.order)
})

orderEvents.on('payments', event => {
  // FIXME : 아직 결제를 승인하는 front UI가 구현되지 않아 3초 후에 자동으로 요청 승인

  setTimeout(async () => {
    await orders.accept(event.id)
  }, 3000)
})
