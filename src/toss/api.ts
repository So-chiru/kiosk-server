import fetch from 'node-fetch'

export const approvePayments = (
  orderId: string,
  paymentKey: string,
  amount: number
) =>
  fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}`, {
    method: 'POST',
    headers: {
      Authorization:
        'Basic ' +
        Buffer.from(process.env.TOSS_AUTH_CODE! + ':').toString('base64'),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      orderId,
      amount
    })
  }).then(v => v.json())

export const getPayment = (orderId?: string, paymentKey?: string) => {
  if (!orderId && !paymentKey) {
    throw new Error('orderId와 paymentKey 중 하나는 지정되어야 합니다.')
  }

  return fetch(
    paymentKey
      ? `https://api.tosspayments.com/v1/payments/${paymentKey}`
      : `https://api.tosspayments.com/v1/payments/orders/${orderId}`,
    {
      method: 'GET',
      headers: {
        Authorization:
          'Basic ' +
          Buffer.from(process.env.TOSS_AUTH_CODE! + ':').toString('base64'),
        'Content-Type': 'application/json'
      }
    }
  ).then(v => v.json())
}

export const cancelPayment = async (orderId: string, reason: string) => {
  const payments = await getPayment(orderId)
  const paymentKey = payments.paymentKey

  return fetch(
    `https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`,
    {
      method: 'POST',
      headers: {
        Authorization:
          'Basic ' +
          Buffer.from(process.env.TOSS_AUTH_CODE! + ':').toString('base64'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cancelReason: reason
      })
    }
  )
    .then(async v => {
      const data = await v.json()

      if (v.status !== 200) {
        throw new Error(`${data.code}: ${data.message}`)
      }

      return data
    })
    .then(v => {
      if (!v.status) {
        throw new Error('상태 값이 주어지지 않았습니다.')
      }

      if (v.status !== 'CANCELED' && v.status !== 'PARTIAL_CANCELED') {
        throw new Error('취소되지 않았습니다. ' + v.status)
      }

      return
    })
}

export default {
  approvePayments,
  getPayment,
  cancelPayment
}
