import Router from 'koa-router'
import graphqlHTTP from 'koa-graphql'
import GraphQLStruct from './structs/graphql'
import { GraphQLRoot } from './structs/graphql_root'
import { KioskRoute } from './@types/routes'

const router = new Router()

export const ghttp = graphqlHTTP({
  schema: GraphQLStruct,
  rootValue: GraphQLRoot,
  graphiql: true
})

import addRoutes from './routes/add'
import clerkRoutes from './routes/clerk'
import orderRoutes from './routes/order'

const makeSafeRoute = (func: KioskRoute['func']) => async (
  ...args: Parameters<KioskRoute['func']>
) => {
  try {
    const data = await func(...args)

    if (typeof data !== 'undefined' && typeof args[0].body === 'undefined') {
      args[0].body = JSON.stringify({
        status: 'success',
        data
      })

      return
    }
  } catch (e) {
    args[0].status = 500
    args[0].body = JSON.stringify({
      status: 'error',
      error: e.message
    })

    return
  }

  args[0].body = JSON.stringify({
    status: 'success'
  })
}

const routesAdd = (...args: KioskRoute[][]) =>
  args.forEach(routes =>
    routes.map(route =>
      router[route.method](route.url, makeSafeRoute(route.func))
    )
  )

routesAdd(addRoutes, clerkRoutes, orderRoutes)

export default router
