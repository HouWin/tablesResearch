import path from 'path';
import { defineConfig } from '@umijs/max';

export default defineConfig({
  antd: {},
  access: {},
  model: {},
  initialState: {},
  request: {},
  layout: {
    title: '@umijs/max',
  },
  routes: [
    {
      path: '/',
      redirect: '/home',
    },
    {
      name: '首页',
      path: '/home',
      component: './Home',
    },
    {
      name: '权限演示',
      path: '/access',
      component: './Access',
    },
    {
      name: ' CRUD 示例',
      path: '/table',
      component: './Table',
    },
    {
      name: 'UniverTable',
      path: '/univerTable',
      component: './UniverTable',
    },
    {
      name: 'Vtable',
      path: '/vtable',
      component: './Vtable',
    },
    {
      name: 'AG Grid',
      path: '/ag-grid',
      component: './AGGrid',
    },
    {
      name: 'AntV S2',
      path: '/antv-s2',
      component: './AntvS2',
    },
    {
      name: 'Handsontable',
      path: '/handsontable',
      routes: [
        {
          path: '/handsontable',
          redirect: '/handsontable/big-data',
        },
        {
          name: '大数据示例',
          path: '/handsontable/big-data',
          component: './Handsontable/BigDataExample',
        },
      ],
    },
    {
      name: 'Jspreadsheet',
      path: '/jspreadsheet',
      component: './Jspreadsheet',
    },
    {
      name: 'SpreadJS Demo',
      path: '/spreadjs-demo',
      routes: [
        {
          path: '/spreadjs-demo',
          redirect: '/spreadjs-demo/business',
        },
        {
          name: '经营数据表',
          path: '/spreadjs-demo/business',
          component: './SpreadJSDemo',
        },
        {
          name: '双列独立折叠',
          path: '/spreadjs-demo/independent-outline',
          component: './SpreadJSIndependentOutline',
        },
      ],
    },
  ],
  npmClient: 'yarn',
  utoopack: {},
  alias: {
    '@univerjs/preset-sheets-data-validation': path.resolve(
      __dirname,
      'node_modules/@univerjs/preset-sheets-data-validation',
    ),
    '@univerjs/preset-sheets-find-replace': path.resolve(
      __dirname,
      'node_modules/@univerjs/preset-sheets-find-replace',
    ),
    '@univerjs/find-replace/locale/zh-CN': path.resolve(
      __dirname,
      'node_modules/@univerjs/find-replace/lib/es/locale/zh-CN.js',
    ),
    '@univerjs/data-validation/locale/zh-CN': path.resolve(
      __dirname,
      'node_modules/@univerjs/data-validation/lib/es/locale/zh-CN.js',
    ),
    '@univerjs/sheets-data-validation/locale/zh-CN': path.resolve(
      __dirname,
      'node_modules/@univerjs/sheets-data-validation/lib/es/locale/zh-CN.js',
    ),
    '@univerjs/sheets-data-validation-ui/locale/zh-CN': path.resolve(
      __dirname,
      'node_modules/@univerjs/sheets-data-validation-ui/lib/es/locale/zh-CN.js',
    ),
    '@univerjs/sheets-find-replace': path.resolve(
      __dirname,
      'node_modules/@univerjs/sheets-find-replace',
    ),
    '@univerjs/sheets-find-replace/lib/facade': path.resolve(
      __dirname,
      'node_modules/@univerjs/sheets-find-replace/lib/es/facade.js',
    ),
    '@univerjs/sheets-data-validation/lib/facade': path.resolve(
      __dirname,
      'node_modules/@univerjs/sheets-data-validation/lib/es/facade.js',
    ),
  },
});
