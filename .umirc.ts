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
      routes: [
        {
          path: '/univerTable',
          redirect: '/univerTable/demo',
        },
        {
          name: '表格示例',
          path: '/univerTable/demo',
          component: './UniverTable',
        },
      ],
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
  ],
  npmClient: 'yarn',
  utoopack: {},
});
