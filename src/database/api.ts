import { promisify } from 'util'
import db, { isDatabaseClientReady } from './client'
import { StoreItem } from 'src/@types/items'
import {
  StoreOrder,
  StoreOrderState,
  VerifiedStoreOrderRequest
} from '../@types/order'
import { v4 as uuidv4 } from 'uuid'

const get = () => {
  if (!isDatabaseClientReady()) {
    return
  }
}

const getMenuItem = async (id: string): Promise<StoreItem | null> => {
  const data = await promisify(db.hget).bind(db)('items', id)

  if (!data) {
    return null
  }

  return JSON.parse(data)
}

const getAllMenuItems = async () => {
  const data = await promisify(db.hgetall).bind(db)('items')

  if (!data) {
    return null
  }

  return Object.keys(data).map(key => JSON.parse(data[key]))
}

const getMenus = async () => {
  const keys = await promisify(db.lrange).bind(db)('menuLists', 0, -1)

  const b = await Promise.all(keys.map(key => getCategory(key)))

  for (let i = 0; i < b.length; i++) {
    b[i].items = await Promise.all(
      b[i].items.map((v: string) => getMenuItem(v))
    )
  }

  return b
}

const getCategory = async (id: string) => {
  const data = await promisify(db.hget).bind(db)('categories', id)

  if (!data) {
    return null
  }

  return JSON.parse(data)
}

const getAllCategories = async () => {
  const data = await promisify(db.hgetall).bind(db)('categories')

  if (!data) {
    return null
  }

  return Object.keys(data).map(key => JSON.parse(data[key]))
}

const getOrder = async (orderId: string): Promise<StoreOrder | null> => {
  const data = await promisify(db.hget).bind(db)('orders', orderId)

  if (!data) {
    return null
  }

  return JSON.parse(data)
}

const updateOrder = async (
  orderId: string,
  order: StoreOrder
): Promise<boolean> => {
  const data = await promisify(db.hset).bind(db)([
    'orders',
    orderId,
    JSON.stringify(order)
  ])

  if (!data) {
    return false
  }

  return true
}

const makeAnOrder = async (
  order: VerifiedStoreOrderRequest,
  state = StoreOrderState.WaitingPayment
): Promise<StoreOrder> => {
  const orderId = uuidv4()

  if (await getOrder(orderId)) {
    return makeAnOrder(order)
  }

  const orderData = {
    id: orderId,
    date: Date.now(),
    state,
    ...order
  }

  const data = await promisify(db.hset).bind(db)([
    'orders',
    orderId,
    JSON.stringify(orderData)
  ])

  if (!data) {
    throw new Error('Failed to make an order, ' + data)
  }

  return orderData
}

export default {
  get,
  getCategory,
  getMenus,
  getAllCategories,
  getMenuItem,
  getAllMenuItems,
  getOrder,
  updateOrder,
  makeAnOrder
}
