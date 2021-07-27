export interface StoreItemOption {
  flavor?: string
  [index: string]: string | number | undefined
}

export interface StoreItemBase {
  name: string
  description?: string
  image?: string
  discount?: number
  price: number
  options?: StoreItemOption
}

export interface StoreItem extends StoreItemBase {
  id: string
}

export interface StoreItemWithAmounts extends StoreItem {
  amount: number
}

export interface StoreCategory {
  id: string
  name: string
  items: StoreItem[]
}

export interface CartItem {
  item: StoreItem
  amount: number
}
