// 兼容旧的演示数据入口；唯一真实数据源位于 spreadsheet/model.ts，
// 避免静态快照与页面实际使用的 BUSINESS_DATA 再次发生偏差。
export { BUSINESS_COLUMN_DATA, BUSINESS_DATA } from './spreadsheet/model';
