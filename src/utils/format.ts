// 示例方法，没有实际意义
export function trim(str: string) {
  return str.trim();
}

/**
 * 安全地将任意值转换为数字
 * @param value - 任意类型的值
 * @returns 转换后的数字，如果无法转换则返回 NaN
 */
function toSafeNumber(value: any): number {
  if (typeof value === 'number') {
    return value
  }
  if (value == null) {
    return NaN
  }
  const num = Number(value)
  return num
}

/**
 * 安全地格式化数字为本地化字符串
 * @param value - 任意类型的值
 * @param defaultValue - 当值为无效数字时的默认显示值
 * @returns 格式化后的字符串
 *
 * @example
 * formatNumber(1234.567) // "1,234.567"
 * formatNumber(0) // "0"
 * formatNumber(null) // "-"
 * formatNumber("1234") // "1,234"
 * formatNumber(undefined) // "-"
 * formatNumber("invalid", "N/A") // "N/A"
 */
export function formatNumber(
  value: any,
  defaultValue: string = '-'
): string {
  const num = toSafeNumber(value)
  if (num == null || isNaN(num)) {
    return defaultValue
  }
  return num.toLocaleString()
}

/**
 * 安全地格式化数字为固定小数位的字符串
 * @param value - 任意类型的值
 * @param decimals - 小数位数，默认为 2
 * @param defaultValue - 当值为无效数字时的默认显示值
 * @returns 格式化后的字符串
 *
 * @example
 * formatNumberFixed(1234.5678) // "1,234.57"
 * formatNumberFixed(1234.5678, 4) // "1,234.5678"
 * formatNumberFixed(0, 2, '-') // "0.00"
 * formatNumberFixed("invalid") // "-"
 */
export function formatNumberFixed(
  value: any,
  decimals: number = 2,
  defaultValue: string = '-'
): string {
  const num = toSafeNumber(value)
  if (num == null || isNaN(num)) {
    return defaultValue
  }
  return num.toFixed(decimals)
}

/**
 * 格式化金额（带人民币符号）
 * @param value - 任意类型的值
 * @param decimals - 小数位数，默认为 2
 * @param defaultValue - 当值为无效数字时的默认显示值
 * @returns 格式化后的金额字符串
 *
 * @example
 * formatCurrency(1234.567) // "¥1,234.57"
 * formatCurrency(0) // "¥0.00"
 * formatCurrency(null) // "-"
 */
export function formatCurrency(
  value: any,
  decimals: number = 2,
  defaultValue: string = '-'
): string {
  const num = toSafeNumber(value)
  if (num == null || isNaN(num)) {
    return defaultValue
  }
  return `¥${num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

/**
 * 格式化百分比
 * @param value - 任意类型的值（0-1之间的小数）
 * @param decimals - 小数位数，默认为 2
 * @param defaultValue - 当值为无效数字时的默认显示值
 * @returns 格式化后的百分比字符串
 *
 * @example
 * formatPercent(0.1234) // "12.34%"
 * formatPercent(0.5, 0) // "50%"
 * formatPercent(null) // "-"
 */
export function formatPercent(
  value: any,
  decimals: number = 2,
  defaultValue: string = '-'
): string {
  const num = toSafeNumber(value)
  if (num == null || isNaN(num)) {
    return defaultValue
  }
  return `${(num * 100).toFixed(decimals)}%`
}

