import { Context } from 'koa'
import router from '../router'

router.post('/menu/add', (ctx: Context) => {
  const data = ctx.body

  console.log(data)
})
