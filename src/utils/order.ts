import { StorePaymentMethod, VerifiedStoreOrderRequest } from '../@types/order'
import { validateUUID } from './string'

import dbAPI from '../database/api'

// name: string
// description?: string
// image?: string
// discount?: number
// price: number
// options?: StoreItemOption
// }

// export interface StoreItem extends StoreItemBase {
// id: string
// }

// export interface StoreItemWithAmounts extends StoreItem {
// amount: number
// }

export const verifyStoreItem = (data: Record<string, unknown>, id = false) => {
  if (typeof data !== 'object') {
    return false
  }

  if (typeof data.name !== 'string' || typeof data.price !== 'number') {
    return false
  }

  if (
    typeof data.description !== 'undefined' &&
    typeof data.description !== 'string'
  ) {
    return false
  }

  if (typeof data.image !== 'undefined' && typeof data.image !== 'string') {
    return false
  }

  if (typeof data.options && typeof data.options !== 'object') {
    return false
  }

  if (id && (typeof data.id !== 'string' || validateUUID(data.id))) {
    return false
  }

  return true
}

export const verifyPaymentMethod = (data: unknown): boolean =>
  typeof data === 'number' && typeof StorePaymentMethod[data] !== 'undefined'

export const verifyStoreItemWithAmounts = (
  data: Record<string, unknown>
): boolean => {
  if (typeof data !== 'object') {
    return false
  }

  if (!verifyStoreItem(data)) {
    return false
  }

  if (typeof data.amounts !== 'number') {
    return false
  }

  return true
}

export const verifyOrderRequest = (data: Record<string, unknown>): boolean => {
  if (typeof data !== 'object') {
    return false
  }

  if (
    typeof data.payWith !== 'number' ||
    !verifyPaymentMethod(data.payWith) ||
    typeof data.items !== 'object' ||
    !Array.isArray(data.items) ||
    data.items.filter(
      v =>
        !Array.isArray(v) ||
        v.length !== 2 ||
        typeof v[0] !== 'number' ||
        typeof v[1] !== 'string'
    ).length
  ) {
    return false
  }

  return true
}

export const validatePayMethod = (payWith: unknown) => {
  if (typeof payWith === 'undefined' || payWith === null) {
    throw new Error('?????? ????????? ???????????? ???????????????.')
  }

  const data =
    !isNaN(Number(payWith)) &&
    Object.values(StorePaymentMethod).filter(v => v === Number(payWith))[0]

  if (data === false || typeof data === 'undefined') {
    throw new Error('?????? ?????? ????????? ???????????? ????????????.')
  }

  return data as StorePaymentMethod
}

export const validateOrderItems = async (
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
    throw new TypeError('?????? ????????? ????????????.')
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
        '????????? ???????????? ID??? ???????????? ???????????? ?????? ???????????? ????????????.'
      )
    }

    if (items[i][0] === 0) {
      throw new Error('?????? ????????? ????????? 0??? ?????????.')
    }

    // TODO : ?????? ?????? ?????? ??????

    if (proceedItems.has(items[i][1])) {
      throw new Error('????????? ????????? ?????? ?????? ???????????? ???????????????.')
    }

    const item = await dbAPI.getMenuItem(items[i][1])

    if (!item || typeof item !== 'object') {
      throw new Error(items[i][1] + '???(???) ?????? ???????????????.')
    }

    proceedItems.set(item.id, '')

    results.items.push({ ...item, amount: items[i][0] })
  }

  results.price = results.items
    .map(v => v.amount * v.price)
    .reduce((p, c) => p + c, 0)

  return results
}
