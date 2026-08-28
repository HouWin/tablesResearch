import React, { useState, useEffect, Suspense } from 'react';
import { SheetComponent } from '@antv/s2-react';
import type { S2DataConfig, S2Options } from '@antv/s2';
import '@antv/s2-react/dist/s2-react.min.css';

// ============================================================================
// 1. 数据源：标准的扁平交叉数据
// ============================================================================
const generateS2Data = () => {
  const rows: any[] = [];
  const regions = ['华东大区', '华南大区'];
  const companies = ['上海分公司', '广东分公司'];
  const depts = ['直销一部', '渠道部'];
  const categories = ['智能硬件', 'SaaS软件'];
  const subCategories = ['服务器', '协同办公'];
  const products = ['AI训练服务器', '企业版旗舰'];
  
  const years = ['2026年', '2027年'];
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

  regions.forEach(region => {
    companies.forEach(company => {
      depts.forEach(dept => {
        categories.forEach(category => {
          subCategories.forEach(sub => {
            products.forEach(product => {
              if (Math.random() > 0.6) return; 
              
              years.forEach(year => {
                quarters.forEach(quarter => {
                  rows.push({
                    region, company, department: dept,
                    category, subCategory: sub, product,
                    year, quarter,
                    revenue: Math.floor(Math.random() * 50000) + 10000,
                    profit: Math.floor(Math.random() * 10000) + 2000,
                  });
                });
              });
            });
          });
        });
      });
    });
  });
  return rows;
};

// ============================================================================
// 2. S2 报表组件 (严格分列网格模式)
// ============================================================================
const BudgetGridS2: React.FC = () => {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    setTimeout(() => setData(generateS2Data()), 200);
  }, []);

  const s2DataConfig: S2DataConfig = {
    fields: {
      // 🌟 每一项都会在表格中生成独立的物理列
      rows: [
        'region',        // 第一列：大区
        'company',       // 第二列：分公司
        'department',    // 第三列：部门
        'category',      // 第四列：产品大类
        'subCategory',   // 第五列：产品中类
        'product',       // 第六列：具体产品
      ],
      columns: ['year', 'quarter'],
      values: ['revenue', 'profit'],
      valueInCols: true, 
    },
    meta: [
      { field: 'region', name: '大区' },
      { field: 'company', name: '分公司' },
      { field: 'department', name: '部门' },
      { field: 'category', name: '产品大类' },
      { field: 'subCategory', name: '产品中类' },
      { field: 'product', name: '具体产品' },
      { field: 'year', name: '年度' },
      { field: 'quarter', name: '季度' },
      { field: 'revenue', name: '总收入 (¥)', formatter: (v) => v ? v.toLocaleString() : '-' },
      { field: 'profit', name: '总净利 (¥)', formatter: (v) => v ? v.toLocaleString() : '-' },
    ],
    data,
  };

  const s2Options: S2Options = {
    width: 1200,
    height: 700,

    // 🌟 核心破局：grid-tree = 平铺布局 + 展开折叠！
    // grid: 纯平铺，所有行展开（无折叠）
    // tree: 纯树形（传统树形结构）
    // grid-tree: 平铺 + 可展开折叠 ✅ 推荐
    hierarchyType: 'grid-tree', 
    
    totals: {
      row: {
        showGrandTotals: true,
        showSubTotals: true,
        reverseLayout: false, 
        reverseSubLayout: false,
        // 精准控制：只在“分公司”和“产品大类”这两个关键节点输出小计行
        subTotalsDimensions: ['company', 'category'], 
        calcSubTotals: {
          aggregation: 'SUM',
        },
      },
      col: {
        showGrandTotals: true,
        showSubTotals: true,
        subTotalsDimensions: ['year'], // 折叠年份时显示年度小计
      }
    },

    interaction: {
      hoverHighlight: true,
      selectedCellsSpotlight: true,
      // 在平铺模式下，允许双击列头进行排序等操作
      sortColumnAppliesToMultipleFields: true,
    },
    
    style: {
      rowCell: {
        // 设置合并单元格中文本的对齐方式（居中或靠顶），靠顶更符合透视表习惯
        textBaseline: 'top', 
      }
    }
  };

  return (
    <div style={{ background: '#f5f7fa', padding: 20 }}>
      <h3>AntV S2 多维独立分列预算报表</h3>
      {data.length > 0 ? (
        <Suspense fallback={<div style={{ padding: 20, textAlign: 'center' }}>加载中...</div>}>
          <SheetComponent 
            sheetType="pivot" 
            dataCfg={s2DataConfig} 
            options={s2Options} 
          />
        </Suspense>
      ) : (
        <div style={{ padding: 20, textAlign: 'center' }}>数据加载中...</div>
      )}
    </div>
  );
};

export default BudgetGridS2;