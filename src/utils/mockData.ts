import type { FinanceRow } from '../types/grid'

// 产品名称列表
const products = [
  '原材料A', '原材料B', '原材料C', '辅助材料', '包装材料',
  '人工成本', '制造费用', '管理费用', '销售费用', '研发费用',
  '水电费', '折旧费', '维修费', '运输费', '仓储费'
]

// 产品大类
const categories = [
  '直接材料', '间接材料', '直接人工', '间接人工',
  '制造费用', '管理费用', '销售费用', '研发支出'
]

// 状态列表
const statuses = ['正常', '待审核', '已审核', '已锁定', '已作废']

// 生成随机数
const randomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// 生成随机日期
const randomDate = (): string => {
  const start = new Date(2024, 0, 1)
  const end = new Date(2024, 11, 31)
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
  return date.toISOString().split('T')[0]
}

// 生成单行数据
const generateRow = (index: number): FinanceRow => {
  return {
    id: index + 1,
    product: products[randomInt(0, products.length - 1)],
    category: categories[randomInt(0, categories.length - 1)],
    qty: randomInt(1, 1000),
    price: Number((Math.random() * 10000 + 10).toFixed(2)),
    dt: randomDate(),
    remark: statuses[randomInt(0, statuses.length - 1)]
  }
}

// 生成模拟数据
export const generateMockData = (count: number): FinanceRow[] => {
  const data: FinanceRow[] = []
  for (let i = 0; i < count; i++) {
    data.push(generateRow(i))
  }
  return data
}

// 生成带子数据的行（用于Master-Detail）
export const generateMockDataWithChildren = (count: number): FinanceRow[] => {
  const data: FinanceRow[] = []
  for (let i = 0; i < count; i++) {
    const row = generateRow(i)
    // 添加1-3个子记录
    const childCount = randomInt(1, 3)
    row.children = []
    for (let j = 0; j < childCount; j++) {
      row.children.push({
        ...generateRow(i * 100 + j),
        id: (i + 1) * 100 + j + 1
      })
    }
    data.push(row)
  }
  return data
}

// 生成大数据量（用于性能测试）
export const generateBigData = (count: number): FinanceRow[] => {
  console.log(`正在生成 ${count} 条模拟数据...`)
  const startTime = performance.now()
  const data = generateMockData(count)
  const endTime = performance.now()
  console.log(`数据生成完成，耗时: ${(endTime - startTime).toFixed(2)}ms`)
  return data
}
