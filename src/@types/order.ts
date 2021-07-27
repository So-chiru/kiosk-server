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
  Purchased = 0,
  Ready = 10,
  InProgress = 20,
  WaitingPayment = 100
}

export enum StorePaymentMethod {
  Card = 100,
  Toss = 150,
  Mobile = 200,
  VirtualAccount = 300,
  Direct = 1000
}

export interface StoreOrder extends VerifiedStoreOrderRequest {
  id: string
  date: number
  payWith: StorePaymentMethod
  state: StoreOrderState
}
