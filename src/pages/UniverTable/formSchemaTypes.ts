/*
 * @Author: 知恩gg lichao.zhao@dxdstech.com
 * @Date: 2026-09-04 10:45:13
 * @LastEditors: 知恩gg lichao.zhao@dxdstech.com
 * @LastEditTime: 2026-09-04 10:49:07
 * @FilePath: /demo/tablesResearch/src/pages/UniverTable/formSchemaTypes.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
/**
 * 后端费用预算表单 schema（columns / records）类型。
 * 页面经 adaptFormSchemaToETable 转成 ETable treeData + treeConfig。
 */

export type FormColumnType = 'rowDim' | 'attr' | 'colDim' | 'value';

export type FormDataType =
  | 'number'
  | 'percentage'
  | 'enum'
  | 'text'
  | 'string'
  | (string & {});

export type FormColumnOption = {
  label: string;
  value: string;
};

export type FormDimValue = Record<string, string>;

export type FormColumnStyle = {
  bgColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  [key: string]: unknown;
};

export type FormColumn = {
  field: string;
  title: string;
  type: FormColumnType;
  width?: number | 'auto' | string;
  readOnly?: boolean;
  tree?: boolean;
  dimCode?: string;
  dataType?: FormDataType;
  options?: FormColumnOption[];
  style?: FormColumnStyle;
  headerStyle?: FormColumnStyle;
  formDimValue?: FormDimValue;
  columns?: FormColumn[];
};

export type FormRecord = {
  [key: string]: unknown;
  formDimValue?: FormDimValue;
  readOnly?: boolean;
  children?: FormRecord[];
};

export type FormSchema = {
  columns: FormColumn[];
  records: FormRecord[];
  formStatus?: number;
  filters?: Record<string, string>;
};
