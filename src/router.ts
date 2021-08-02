import Router from 'koa-router'
import graphqlHTTP from 'koa-graphql'
import GraphQLStruct from './structs/graphql'
import { GraphQLRoot } from './structs/graphql_root'
import { KioskRoute } from './@types/routes'

const router = new Router()
export const wsRouter = new Router()

export const ghttp = graphqlHTTP({
  schema: GraphQLStruct,
  rootValue: GraphQLRoot,
  graphiql: true
})

import addRoutes from './routes/add'
import clerkRoutes from './routes/clerk'
import orderRoutes from './routes/order'

// TODO : 만약 상태 인증을 필요로 하는 route가 있는 경우 KioskRoute interface에 authentication: true를
// 구현하여 접속 중인 세션에 대한 인증을 진행할 수 있도록 구현

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
    if (process.env.NODE_ENV === 'development') {
      console.log(e)
    }

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

const routesAdd = (to: Router, ...args: KioskRoute[][]) =>
  args.forEach(routes =>
    routes.map(route => to[route.method](route.url, makeSafeRoute(route.func)))
  )

routesAdd(router, addRoutes, clerkRoutes, orderRoutes)

export default router
