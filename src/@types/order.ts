import { StoreItemWithAmounts } from './items'

/**
 * 주문 데이터에 ID가 붙기 전의 상태입니다. StoreItem의 베이스로 사용되고 주문 요청에도 사용됩니다.
 */
export interface VerifiedStoreOrderRequest {
  price: number
  payWith: StorePaymentMethod
  items: StoreItemWithAmounts[]
}

/**
 * 주문의 상태 코드입니다. 음수는 오류로 사용되고 양수는 중립/성공의 값으로 사용됩니다.
 */
export enum StoreOrderState {
  Expired = -400,
  Aborted = -300,
  Canceled = -200,
  Failed = -100,
  Done = 0,
  WaitingPayment = 100,
  WaitingAccept = 200
}

export enum StorePaymentMethod {
  Card = 100,
  Toss = 150,
  Mobile = 200,
  VirtualAccount = 300,
  Direct = 1000
}

export interface StoreCancel {
  reason: string
  date: string
}

export interface StoreOrder extends VerifiedStoreOrderRequest {
  id: string
  date: string
  payWith: StorePaymentMethod
  state: StoreOrderState
  cancel?: StoreCancel
}

export interface DBFoundOrder {
  preOrder: boolean
  order: StoreOrder
}

/**
 * 서버 내에서 주문 이벤트가 발생하면 처리할 이벤트의 콜백을 정의한 함수 인터페이스입니다.
 */
export interface OrderEvents {
  accepted: (event: OrderEventCallback) => void
  canceled: (event: OrderEventCallback) => void
  placed: (event: OrderEventCallback) => void
  payments: (event: OrderEventCallback) => void
  statusUpdate: (event: OrderEventCallback) => void
}

export interface OrderEventCallback {
  id: string
  type: 'STATUS_UPDATE'
  order: StoreOrder
}
