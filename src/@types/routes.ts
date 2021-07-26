import { Context, Next } from 'koa'

export interface KioskRoute {
  method:
    | 'get'
    | 'post'
    | 'options'
    | 'link'
    | 'unlink'
    | 'put'
    | 'delete'
    | 'head'
    | 'patch'
    | 'all'
  url: string
  func: (ctx: Context, next?: Next) => void
}
