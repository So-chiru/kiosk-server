import { StoreItemWithAmounts } from './items'

export interface VerifiedStoreOrderRequest {
  price: number
  payWith: StorePaymentMethod
  items: StoreItemWithAmounts[]
}

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
