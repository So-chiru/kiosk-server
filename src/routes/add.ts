import { Context } from 'koa'
import { KioskRoute } from 'src/@types/routes'

const Route: KioskRoute[] = [
  {
    method: 'get',
    url: '/menu/add',
    func: (ctx: Context) => {
      const data = ctx.body

      console.log(data)
    }
  }
]

export default Route
