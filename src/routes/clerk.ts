import { Context } from 'koa'
import { KioskRoute } from 'src/@types/routes'

const Route: KioskRoute[] = [
  {
    method: 'get',
    url: '/call_clerk',
    func: (ctx: Context) => {
      ctx.body = ''
    }
  }
]

export default Route
