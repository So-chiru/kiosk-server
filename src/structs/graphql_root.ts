import dbAPI from '../database/api'

interface CategoryArguments {
  id: string
}

interface ItemArguments {
  id: string
}

export const GraphQLRoot = {
  item: async (args: ItemArguments) => {
    if (!args.id) {
      throw new Error('args.id is not defined.')
    }

    const query = dbAPI.getMenuItem(args.id)

    return query
  },

  items: () => dbAPI.getAllMenuItems(),

  category: async (args: CategoryArguments) => {
    if (!args.id) {
      throw new Error('args.id is not defined.')
    }

    const query = dbAPI.getCategory(args.id)

    return query
  },

  categories: () => dbAPI.getAllCategories(),

  menus: async () => {
    const query = await dbAPI.getMenus()

    if (!query) {
      return []
    }

    return query
  }
}
