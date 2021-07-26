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

const routesAdd = (...args: KioskRoute[][]) =>
  args.forEach(routes =>
    routes.map(route => router[route.method](route.url, route.func))
  )

routesAdd(addRoutes, clerkRoutes)

export default router
