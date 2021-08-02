import { promisify } from 'util'
import db, { isDatabaseClientReady } from './client'
import { StoreItem } from 'src/@types/items'
import {
  DBFoundOrder,
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

const findOrder = async (orderId: string): Promise<DBFoundOrder | null> => {
  let data = await getOrder(orderId)
  let isPreOrder: boolean | null = false

  if (!data) {
    data = await getPreOrder(orderId)
    isPreOrder = true
  }

  if (!data) {
    return null
  }

  return {
    preOrder: isPreOrder,
    order: data
  }
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

const deleteOrder = async (orderId: string): Promise<boolean> => {
  return new Promise((resolve, reject) =>
    db.hdel('orders', orderId, (err, res) => {
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

  if (await findOrder(orderId)) {
    return makeAnPreOrder(order)
  }

  const lastOrder = await getMaxOrderSequence()

  const orderData = {
    id: orderId,
    date: new Date().toISOString(),
    sequence: (lastOrder === null ? 0 : lastOrder[1]) + 1,
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
  await deletePreOrder(order.id)

  const data = await promisify(db.hset).bind(db)([
    'orders',
    order.id,
    JSON.stringify(order)
  ])

  if (!data) {
    throw new Error('Failed to make an order. ' + order.id)
  }

  return order
}

const cachePaymentsData = async (id: string, data: Record<string, unknown>) => {
  return new Promise((resolve, reject) =>
    db.set(
      'paymentsSession.' + id,
      JSON.stringify(data),
      'EX',
      1800,
      (err, res) => {
        if (err) {
          return reject(err)
        }

        if (res !== 'OK') {
          return resolve(false)
        }

        return resolve(true)
      }
    )
  )
}

const getCachedPaymentsData = async (id: string) => {
  const response = await promisify(db.get).bind(db)('paymentsSession.' + id)

  if (!response) {
    return null
  }

  return JSON.parse(response)
}

const setPaymentSecret = async (id: string, secret: string) => {
  return new Promise((resolve, reject) =>
    db.set('paymentsSecret.' + id, secret, 'EX', 1800, (err, res) => {
      if (err) {
        return reject(err)
      }

      if (res !== 'OK') {
        return resolve(false)
      }

      return resolve(true)
    })
  )
}

const getPaymentSecret = (id: string) =>
  promisify(db.get).bind(db)('paymentsSecret.' + id)

const getMaxOrderSequence = async (): Promise<[string, number] | null> =>
  new Promise<[string, string] | null>((resolve, reject) =>
    db.zrevrangebyscore(
      'ordersSequence',
      '+inf',
      '-inf',
      'WITHSCORES',
      (err, reply) => {
        if (err) {
          return reject(err)
        }

        if (
          !reply ||
          typeof reply[0] === 'undefined' ||
          typeof reply[1] === 'undefined'
        ) {
          return resolve(null)
        }

        return resolve(reply.slice(0, 2) as [string, string])
      }
    )
  ).then(v => {
    if (v && v.length) {
      const [key, score] = v

      return [key, Number(score)]
    }

    return null
  })

export default {
  get,
  findOrder,
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
  promotePreOrderToOrder,
  cachePaymentsData,
  getCachedPaymentsData,
  setPaymentSecret,
  getPaymentSecret
}
