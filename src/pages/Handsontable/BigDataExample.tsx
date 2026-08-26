import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { HotTable } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import {
  Button,
  Space,
  Card,
  Statistic,
  Row,
  Col,
  Select,
  message,
  Progress,
  Spin,
  Alert,
  Switch,
  Tooltip,
  Input,
  Divider,
} from 'antd';
import {
  ReloadOutlined,
  ExportOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons';

// 注册所有 Handsontable 模块
registerAllModules();

// 数据生成器
const generateBigData = (rows: number, cols: number): any[][] => {
  const firstNames = ['张', '王', '李', '刘', '陈', '杨', '黄', '吴', '周'];
  const lastNames = ['伟', '芳', '娜', '强', '磊', '军', '洋', '勇', '杰', '娟'];
  const departments = ['技术部', '销售部', '市场部', '人事部', '财务部', '研发部'];
  const statuses = ['活跃', '闲置', '在职', '休假'];

  const data = [];
  for (let i = 0; i < rows; i++) {
    const row = [];
    row.push(i + 1); // ID
    row.push(firstNames[i % firstNames.length] + lastNames[i % lastNames.length]); // 姓名
    row.push(departments[i % departments.length]); // 部门
    row.push(Math.floor(Math.random() * 30) + 22); // 年龄
    row.push(Math.floor(Math.random() * 50000) + 8000); // 薪资
    row.push(statuses[i % statuses.length]); // 状态
    for (let j = 6; j < cols; j++) {
      row.push(Math.floor(Math.random() * 1000));
    }
    data.push(row);
  }
  return data;
};

const HandsontableBigData: React.FC = () => {
  const hotRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [rowCount, setRowCount] = useState(10000);
  const [colCount] = useState(100);
  const [data, setData] = useState<any[][]>([]);
  const [renderProgress, setRenderProgress] = useState(0);
  const [enableFilters, setEnableFilters] = useState(true);
  const [enableSorting, setEnableSorting] = useState(true);
  const [performanceMode, setPerformanceMode] = useState(true);

  // 列标题
  const colHeaders = useMemo(() => {
    const base = ['ID', '姓名', '部门', '年龄', '薪资', '状态'];
    for (let i = 6; i < colCount; i++) {
      base.push(`列${i + 1}`);
    }
    return base;
  }, [colCount]);

  // 生成数据
  const generateData = useCallback((rows: number) => {
    setLoading(true);
    setRenderProgress(0);
    setTimeout(() => {
      try {
        const newData = generateBigData(rows, colCount);
        setData(newData);
        setRenderProgress(100);
        message.success(`成功生成 ${rows} 行数据！`);
      } catch (error) {
        message.error('数据生成失败');
      } finally {
        setLoading(false);
      }
    }, 100);
  }, [colCount]);

  useEffect(() => {
    generateData(rowCount);
  }, []);

  // 统计数据
  const stats = useMemo(() => {
    if (data.length === 0) return null;
    let totalSalary = 0;
    let totalAge = 0;
    data.forEach(row => {
      if (row[4] && typeof row[4] === 'number') totalSalary += row[4];
      if (row[3] && typeof row[3] === 'number') totalAge += row[3];
    });
    return {
      totalRows: data.length,
      totalCols: colCount,
      totalCells: data.length * colCount,
      avgSalary: Math.round(totalSalary / data.length),
      avgAge: Math.round(totalAge / data.length),
    };
  }, [data, colCount]);

  // 导出 CSV
  const handleExportCSV = useCallback(() => {
    const hot = hotRef.current;
    if (hot) {
      try {
        const hotData = hot.getData();
        if (hotData.length === 0) {
          message.warning('没有数据可导出');
          return;
        }
        const colHeaders = hot.getColHeader();
        const csvContent = [
          colHeaders.join(','),
          ...hotData.map(row => row.join(','))
        ].join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `big_data_${Date.now()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        message.success(`成功导出 ${hotData.length} 行数据！`);
      } catch (error) {
        message.error('导出失败');
      }
    }
  }, []);

  // 添加行
  const handleAddRows = useCallback(() => {
    const hot = hotRef.current;
    if (hot) {
      const newData = generateBigData(100, colCount);
      const currentData = hot.getData();
      const combinedData = [...currentData, ...newData];
      hot.loadData(combinedData);
      setRowCount(prev => prev + 100);
      message.success('已添加 100 行数据');
    }
  }, [colCount]);

  // 删除选中行
  const handleDeleteSelectedRows = useCallback(() => {
    const hot = hotRef.current;
    if (hot) {
      const selected = hot.getSelected();
      if (selected && selected.length > 0) {
        const rowsToDelete = selected.map((s: any) => s[0]);
        const sortedRows = [...new Set(rowsToDelete)].sort((a, b) => b - a);
        let currentData = hot.getData();
        sortedRows.forEach(rowIndex => {
          currentData.splice(rowIndex, 1);
        });
        hot.loadData(currentData);
        setRowCount(currentData.length);
        message.success(`已删除 ${sortedRows.length} 行数据`);
      } else {
        message.warning('请先选择要删除的行');
      }
    }
  }, []);

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      {/* 标题和操作栏 */}
      <Card style={{ marginBottom: '16px' }}>
        <Row justify="space-between" align="middle">
          <Col>
            <h2 style={{ margin: 0 }}>📊 Handsontable 大数据示例</h2>
            <p style={{ margin: '4px 0 0 0', color: '#666' }}>
              基于 @handsontable/react-wrapper，支持 10万+ 行数据
            </p>
          </Col>
          <Col>
            <Space>
              <Select
                value={rowCount}
                onChange={(value) => {
                  setRowCount(value);
                  generateData(value);
                }}
                style={{ width: 120 }}
              >
                <Select.Option value={1000}>1,000 行</Select.Option>
                <Select.Option value={5000}>5,000 行</Select.Option>
                <Select.Option value={10000}>10,000 行</Select.Option>
                <Select.Option value={50000}>50,000 行</Select.Option>
                <Select.Option value={100000}>100,000 行</Select.Option>
              </Select>
              <Button type="primary" onClick={() => generateData(rowCount)} icon={<ReloadOutlined />}>
                重新生成
              </Button>
              <Button onClick={handleExportCSV} icon={<ExportOutlined />}>
                导出 CSV
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 统计信息 */}
      {stats && (
        <Card style={{ marginBottom: '16px' }}>
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={8} md={6}>
              <Statistic title="总行数" value={stats.totalRows} suffix="行" />
            </Col>
            <Col xs={12} sm={8} md={6}>
              <Statistic title="总列数" value={stats.totalCols} suffix="列" />
            </Col>
            <Col xs={12} sm={8} md={6}>
              <Statistic title="总单元格" value={stats.totalCells} suffix="个" />
            </Col>
            <Col xs={12} sm={8} md={6}>
              <Statistic title="平均薪资" value={stats.avgSalary} prefix="¥" suffix="元" />
            </Col>
          </Row>
        </Card>
      )}

      {/* 工具栏 */}
      <Card style={{ marginBottom: '16px' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Space>
              <Tooltip title="添加 100 行数据">
                <Button onClick={handleAddRows} icon={<PlusOutlined />}>
                  添加行
                </Button>
              </Tooltip>
              <Tooltip title="删除选中的行">
                <Button danger onClick={handleDeleteSelectedRows} icon={<DeleteOutlined />}>
                  删除行
                </Button>
              </Tooltip>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={18}>
            <Space wrap>
              <span>功能开关：</span>
              <Switch
                checked={enableFilters}
                onChange={setEnableFilters}
                checkedChildren="过滤"
                unCheckedChildren="过滤"
              />
              <Switch
                checked={enableSorting}
                onChange={setEnableSorting}
                checkedChildren="排序"
                unCheckedChildren="排序"
              />
              <Switch
                checked={performanceMode}
                onChange={setPerformanceMode}
                checkedChildren="性能模式"
                unCheckedChildren="性能模式"
              />
            </Space>
          </Col>
        </Row>
        {loading && (
          <div style={{ marginTop: '12px' }}>
            <Progress percent={renderProgress} status="active" />
          </div>
        )}
      </Card>

      {/* Handsontable 表格 - 注意：配置直接作为 props 传入，不再使用 settings */}
      <Card>
        <Alert
          message="性能提示"
          description={`当前数据量 ${rowCount.toLocaleString()} 行 × ${colCount} 列，共 ${(rowCount * colCount).toLocaleString()} 个单元格。${performanceMode ? '已开启性能优化模式。' : '高质量模式。'}`}
          type={rowCount > 50000 ? 'warning' : 'info'}
          showIcon
          style={{ marginBottom: '16px' }}
          closable
        />
        {loading ? (
          <div style={{ height: '600px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Spin size="large" tip="加载数据中..." />
          </div>
        ) : (
          <div style={{ height: '600px' }}>
            <HotTable
              ref={hotRef}
              // 所有配置直接作为 props 传入，不再使用 settings[citation:1][citation:4]
              data={data}
              colWidths={100}
              colHeaders={colHeaders}
              rowHeaders={true}
              licenseKey="non-commercial-and-evaluation"
              width="100%"
              height="100%"
              stretchH="all"
              autoColumnSize={true}
              manualColumnResize={true}
              manualRowResize={true}
              filters={enableFilters}
              dropdownMenu={true}
              contextMenu={true}
              sortIndicator={true}
              columnSorting={enableSorting}
              multiColumnSorting={enableSorting}
              fillHandle={true}
              fixedColumnsLeft={1}
              fixedRowsTop={1}
              // 大数据性能优化配置[citation:4]
              renderAllRows={false}
              viewportRowRenderingOffset={performanceMode ? 20 : 50}
              viewportColumnRenderingOffset={performanceMode ? 5 : 15}
              preventOverflow={false}
              disableVisualSelection={false}
              // 主题支持[citation:4]
            />
          </div>
        )}
      </Card>

      {/* 使用说明 */}
      <Card style={{ marginTop: '16px' }} size="small">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <h4>💡 功能说明</h4>
            <ul>
              <li>基于新版 <code>@handsontable/react-wrapper</code>，支持 React 18+</li>
              <li>配置直接作为 <code>HotTable</code> 的 props 传入，无需 <code>settings</code></li>
              <li>支持虚拟滚动，10万+ 行数据流畅展示</li>
              <li>内置排序、过滤、导出 CSV 功能</li>
            </ul>
          </Col>
          <Col xs={24} md={12}>
            <h4>🔧 新版 Wrapper 特点</h4>
            <ul>
              <li>函数式组件优先，更好的类型安全[citation:1]</li>
              <li>自定义编辑器使用 <code>useHotEditor</code> Hook[citation:1]</li>
              <li>支持 <code>HotColumn</code> 子组件配置列[citation:4]</li>
              <li>内置主题支持：main / horizon / classic[citation:4]</li>
            </ul>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default HandsontableBigData;
