import { inspect, promisify } from 'util'
import db, { isDatabaseClientReady } from './client'

const get = () => {
  if (!isDatabaseClientReady()) {
    return
  }
}

const getMenuItem = async (id: string) => {
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

export default {
  get,
  getCategory,
  getMenus,
  getAllCategories,
  getMenuItem,
  getAllMenuItems
}
