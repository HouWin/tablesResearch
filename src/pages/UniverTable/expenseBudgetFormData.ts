import type { FormSchema } from './formSchemaTypes';
import raw from './expenseBudgetFormData.json';

/** 费用预算表单样例（后端 columns / records 结构原样） */
export const expenseBudgetFormData = raw as FormSchema;
