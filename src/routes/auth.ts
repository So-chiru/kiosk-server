import { Context } from 'koa'
import { KioskRoute } from 'src/@types/routes'

const Route: KioskRoute[] = [
  {
    method: 'get',
    url: '/auth',
    func: (ctx: Context) => {
      // const data = ctx.body

      // TODO : 실제 인증 과정에는 인증하는 로직을 구현

      return new Promise((resolve, reject) =>
        setTimeout(
          () =>
            resolve({
              state: 'DONE'
            }),
          3000
        )
      )
    }
  }
]

export default Route
