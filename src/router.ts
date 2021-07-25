import Router from 'koa-router'
import graphqlHTTP from 'koa-graphql'
import GraphQLStruct from './structs/graphql'
import { GraphQLRoot } from './structs/graphql_root'

const router = new Router()

export const ghttp = graphqlHTTP({
  schema: GraphQLStruct,
  rootValue: GraphQLRoot,
  graphiql: true
})

export default router
