import fetch from 'node-fetch'

export const approvePayments = (
  orderId: string,
  paymentKey: string,
  amount: number
) => {
  console.log(
    'Basic ' + Buffer.from(process.env.TOSS_AUTH_CODE! + ':').toString('base64')
  )

  console.log(
    orderId,
    paymentKey,
    `https://api.tosspayments.com/v1/payments/${paymentKey}`,
    amount
  )

  return fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}`, {
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
}
