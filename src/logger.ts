const padding = (num: number, length: number) => {
  let str = num.toString()

  if (str.length < length) {
    str = '0'.repeat(length - str.length) + str
  }

  return str
}

const logger = (...args: any[]) => {
  const date = new Date()
  console.log(
    `${date.toLocaleDateString('ja-JP')} ${date.toLocaleTimeString(
      'ja-JP'
    )}.${padding(date.getMilliseconds(), 3)}:`,
    ...args
  )
}

export default logger
