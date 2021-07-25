declare interface StoreItemOption {
  flavor?: string
  [index: string]: string | number | undefined
}

declare interface StoreItemBase {
  name: string
  description?: string
  image?: string
  discount?: number
  price: number
  options?: StoreItemOption
}

declare interface StoreItem extends StoreItemBase {
  id: string
}

declare interface StoreCategory {
  id: string
  name: string
  items: StoreItem[]
}

declare interface CartItem {
  item: StoreItem
  amount: number
}
