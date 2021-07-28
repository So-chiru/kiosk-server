import { promisify } from 'util'
import db, { isDatabaseClientReady } from './client'
import { StoreItem } from 'src/@types/items'
import {
  StoreOrder,
  StoreOrderState,
  VerifiedStoreOrderRequest
} from '../@types/order'
import { v4 as uuidv4 } from 'uuid'
import { Callback } from 'redis'

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

const getPreOrder = async (orderId: string): Promise<StoreOrder | null> => {
  const data = await promisify(db.hget).bind(db)('preOrders', orderId)

  if (!data) {
    return null
  }

  return JSON.parse(data)
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

const updatePreOrder = async (
  orderId: string,
  order: StoreOrder
): Promise<boolean> => {
  const data = await promisify(db.hset).bind(db)([
    'preOrders',
    orderId,
    JSON.stringify(order)
  ])

  if (!data) {
    return false
  }

  return true
}

const deletePreOrder = async (orderId: string): Promise<boolean> => {
  return new Promise((resolve, reject) =>
    db.hdel('preOrders', orderId, (err, res) => {
      if (err) {
        return reject(err)
      }

      if (!res) {
        return resolve(false)
      }

      return resolve(true)
    })
  )
}

const makeAnPreOrder = async (
  order: VerifiedStoreOrderRequest,
  state = StoreOrderState.WaitingPayment
): Promise<StoreOrder> => {
  const orderId = uuidv4()

  if ((await getPreOrder(orderId)) || (await getOrder(orderId))) {
    return makeAnPreOrder(order)
  }

  const orderData = {
    id: orderId,
    date: Date.now(),
    state,
    ...order
  }

  const data = await promisify(db.hset).bind(db)([
    'preOrders',
    orderId,
    JSON.stringify(orderData)
  ])

  if (!data) {
    throw new Error('Failed to make an order, ' + data)
  }

  return orderData
}

const promotePreOrderToOrder = async (order: StoreOrder) => {
  if (order.state === StoreOrderState.WaitingAccept) {
    order.state = StoreOrderState.Done
  }

  await deletePreOrder(order.id)

  const data = await promisify(db.hset).bind(db)([
    'orders',
    order.id,
    JSON.stringify(order)
  ])

  if (!data) {
    throw new Error('Failed to make an order, ' + data)
  }

  return order
}

export default {
  get,
  getCategory,
  getMenus,
  getAllCategories,
  getMenuItem,
  getAllMenuItems,
  deletePreOrder,
  getPreOrder,
  updatePreOrder,
  getOrder,
  updateOrder,
  makeAnPreOrder,
  promotePreOrderToOrder
}
