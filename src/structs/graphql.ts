import { buildSchema } from 'graphql'

export default buildSchema(`
  type Query {
    item(id: String): StoreItem
    items: [StoreItem]!
    category(id: String): StoreCategory
    categories: [StoreCategory]!
    menus: [StoreCategory]!
  }

  type StoreItemOption {
    flavor: String
  }

  type StoreItem {
    id: String!
    name: String!
    image: String
    discount: Int
    price: Int!
    options: StoreItemOption
  }

  type StoreCategory {
    id: String!
    name: String!
    items: [StoreItem]!
  }
`)
