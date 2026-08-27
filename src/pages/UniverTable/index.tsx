import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Col,
  Input,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Switch,
  Tooltip,
  Tree,
  message,
} from 'antd';
import {
  ExpandAltOutlined,
  ShrinkOutlined,
  ReloadOutlined,
  SearchOutlined,
  VerticalAlignTopOutlined,
  VerticalAlignBottomOutlined,
  UndoOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import ETable from '@/components/UniverTable';
import { defaultContextMenuItems } from '@/components/UniverTable/contextMenu';
import { flattenTreeData } from '@/components/UniverTable/tree';
import {
  generateScaledTreeData,
  PROFIT_OPTIONS,
  toDemoDate,
  toProfitLevel,
} from '@/components/UniverTable/treeDataGenerator';
import type {
  ETableCellChangeRecord,
  ETableDataTraceNode,
  ETableOptions,
  ETableRef,
  ETableTreeAttribute,
  ETableTreeConfig,
  ETableTreeNode,
} from '@/components/UniverTable/types';

/** 树形演示 / 树形大数据规模（展平后的工作表行数） */
const DATA_SCALE_OPTIONS = [
  { value: 'tree', label: '树形演示' },
  { value: 10000, label: '1万行（树形）' },
  { value: 50000, label: '5万行（树形）' },
  { value: 100000, label: '10万行（树形）' },
  { value: 500000, label: '50万行（树形）' },
  { value: 1000000, label: '100万行（树形）' },
] as const;

type DataScale = (typeof DATA_SCALE_OPTIONS)[number]['value'];

const treeConfig: ETableTreeConfig = {
  treeUI: true,
  labelMode: 'single',
  collapseAttributes: true,
  dimensions: [
    { field: 'category', title: 'Category', width: 180 },
    // 中间维度列（截图中 Category 与可折叠 Region 之间的 Region）
    { field: 'region', title: 'Region', width: 100 },
  ],
  // 可折叠 Region 属性列（East / Central / West / South）
  attribute: { field: 'attribute', title: 'Region', width: 120 },
  // 行背景：顶层分类 / 子类 / 更深层级
  rowBackgrounds: ['#E8F3FF', '#F5FAFF', '#FFFFFF'],
  regionDetailBackground: '#FAFBFC',
  measures: [
    {
      field: 'sales',
      title: '数字',
      width: 130,
      type: 'number',
      numberFormat: '$#,##0.00',
    },
    {
      field: 'profit',
      title: '下拉',
      width: 130,
      type: 'select',
      options: [...PROFIT_OPTIONS],
    },
    {
      field: 'date',
      title: '日期',
      width: 130,
      type: 'date',
      numberFormat: 'yyyy-mm-dd',
    },
  ],
};

const regionAttributes = (
  prefix: string,
  east: [number, number],
  central: [number, number],
  west: [number, number],
  south: [number, number],
  dateSeed = 1,
): ETableTreeAttribute[] => [
  {
    id: `${prefix}-east`,
    label: 'East',
    collapsed: true,
    values: {
      sales: east[0],
      profit: toProfitLevel(east[1]),
      date: toDemoDate(dateSeed),
    },
  },
  {
    id: `${prefix}-central`,
    label: 'Central',
    values: {
      sales: central[0],
      profit: toProfitLevel(central[1]),
      date: toDemoDate(dateSeed + 1),
    },
  },
  {
    id: `${prefix}-west`,
    label: 'West',
    values: {
      sales: west[0],
      profit: toProfitLevel(west[1]),
      date: toDemoDate(dateSeed + 2),
    },
  },
  {
    id: `${prefix}-south`,
    label: 'South',
    values: {
      sales: south[0],
      profit: toProfitLevel(south[1]),
      date: toDemoDate(dateSeed + 3),
    },
  },
];

/** 给树节点写入中间 Region 维度值（默认 East，与截图一致） */
const withRegionDim = (
  nodes: ETableTreeNode[],
  region = 'East',
): ETableTreeNode[] =>
  nodes.map((node) => ({
    ...node,
    data: { ...node.data, region },
    children: node.children ? withRegionDim(node.children, region) : undefined,
  }));

const treeData: ETableTreeNode[] = withRegionDim([
  {
    id: 'furniture',
    label: 'Furniture',
    collapsed: false,
    attributes: regionAttributes(
      'furniture',
      [208291.2, 3046.17],
      [52000, 2100],
      [48000, 1800],
      [41000, -900],
      11,
    ),
    children: [
      {
        id: 'bookcases',
        label: 'Bookcases',
        attributes: regionAttributes(
          'bookcases',
          [43819.33, -1167.63],
          [12000, 400],
          [9800, -200],
          [7500, 120],
          21,
        ),
      },
      {
        id: 'chairs',
        label: 'Chairs',
        attributes: regionAttributes(
          'chairs',
          [98621.45, 5240.18],
          [22000, 1100],
          [18500, 900],
          [16000, 700],
          31,
        ),
      },
      {
        id: 'furnishings',
        label: 'Furnishings',
        attributes: regionAttributes(
          'furnishings',
          [21540.9, 832.4],
          [6200, 300],
          [5100, 180],
          [4300, 90],
          41,
        ),
      },
      {
        id: 'tables',
        label: 'Tables',
        attributes: regionAttributes(
          'tables',
          [44309.52, -1858.78],
          [11800, -400],
          [9600, -300],
          [8200, -220],
          51,
        ),
      },
    ],
  },
  {
    id: 'office-supplies',
    label: 'Office Supplies',
    collapsed: true,
    attributes: regionAttributes(
      'office',
      [205516.05, 41014.28],
      [58000, 12000],
      [49000, 9800],
      [42000, 7200],
      61,
    ),
    children: [
      {
        id: 'binders',
        label: 'Binders',
        attributes: regionAttributes(
          'binders',
          [72000, 12000],
          [18000, 3200],
          [15000, 2800],
          [12000, 2100],
          71,
        ),
      },
      {
        id: 'paper',
        label: 'Paper',
        attributes: regionAttributes(
          'paper',
          [53000, 15000],
          [14000, 4000],
          [11000, 3200],
          [9000, 2500],
          81,
        ),
      },
      {
        id: 'storage',
        label: 'Storage',
        attributes: regionAttributes(
          'storage',
          [80516.05, 14014.28],
          [21000, 3600],
          [17000, 2900],
          [14000, 2200],
          91,
        ),
      },
    ],
  },
  {
    id: 'technology',
    label: 'Technology',
    collapsed: true,
    attributes: regionAttributes(
      'tech',
      [269870.85, 48275.14],
      [72000, 13000],
      [65000, 11000],
      [58000, 9200],
      101,
    ),
    children: [
      {
        id: 'phones',
        label: 'Phones',
        attributes: regionAttributes(
          'phones',
          [110000, 20000],
          [28000, 5200],
          [24000, 4100],
          [20000, 3500],
          111,
        ),
      },
      {
        id: 'accessories',
        label: 'Accessories',
        attributes: regionAttributes(
          'accessories',
          [90000, 18000],
          [23000, 4500],
          [19000, 3800],
          [16000, 3000],
          121,
        ),
      },
      {
        id: 'machines',
        label: 'Machines',
        attributes: regionAttributes(
          'machines',
          [69870.85, 10275.14],
          [18000, 2800],
          [15000, 2200],
          [12000, 1800],
          131,
        ),
      },
    ],
  },
]);

const defaultOptions: ETableOptions = {
  name: 'Sales by Category',
  defaultColumnWidth: 110,
  defaultRowHeight: 28,
  showGridLines: true,
  freezeRows: 1,
  freezeColumns: 0,
  customizeColumnHeader: true,
  /** Canvas 可视区虚拟绘制 + 大数据分片写入 */
  virtualScroll: true,
  contextMenuItems: defaultContextMenuItems,
  enableContextMenu: true,
} as any;

const countNodes = (nodes: ETableTreeNode[]): number =>
  nodes.reduce(
    (sum, node) => sum + 1 + (node.children ? countNodes(node.children) : 0),
    0,
  );

const UniverTablePage = () => {
  const tableRef = useRef<ETableRef>(null);
  const [dataScale, setDataScale] = useState<DataScale>('tree');
  const [scaledTreeData, setScaledTreeData] = useState<ETableTreeNode[] | null>(
    null,
  );
  const [flatRowCount, setFlatRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tableKey, setTableKey] = useState(0);
  const [gridLines, setGridLines] = useState(true);
  const [freezeHeader, setFreezeHeader] = useState(true);
  const [contextMenu, setContextMenu] = useState(true);
  const [virtualScroll, setVirtualScroll] = useState(true);
  const [renderMs, setRenderMs] = useState<number | null>(null);
  const [tracks, setTracks] = useState<ETableCellChangeRecord[]>([]);
  const [focusCell, setFocusCell] = useState('C2');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);
  const [traceOpen, setTraceOpen] = useState(false);
  const [traceTree, setTraceTree] = useState<ETableDataTraceNode | null>(null);

  const isDemoTree = dataScale === 'tree';
  const targetRowCount = typeof dataScale === 'number' ? dataScale : 0;
  const activeTreeData = isDemoTree ? treeData : scaledTreeData ?? [];
  const cellHistory = useMemo(
    () => tracks.filter((item) => item.cell === focusCell),
    [tracks, focusCell],
  );

  const loadScaledTree = useCallback(async (count: number) => {
    if (count >= 500000) {
      message.warning('数据量较大，生成与渲染可能较慢，请耐心等待');
    }
    setLoading(true);
    setProgress(0);
    setRenderMs(null);
    try {
      const { treeData: generated, flatRowCount: rows } =
        await generateScaledTreeData(count, setProgress);
      setScaledTreeData(generated);
      setFlatRowCount(rows);
      setTracks([]);
      setTableKey((key) => key + 1);
      message.success(
        `成功生成树形数据，约 ${rows.toLocaleString()} 行（展平后）`,
      );
    } catch {
      message.error('树形数据生成失败');
    } finally {
      setLoading(false);
      setProgress(100);
    }
  }, []);

  const handleScaleChange = async (value: DataScale) => {
    setDataScale(value);
    if (value === 'tree') {
      setScaledTreeData(null);
      setFlatRowCount(0);
      setTracks([]);
      setRenderMs(null);
      setTableKey((key) => key + 1);
      message.success('已切换到树形演示数据');
      return;
    }
    await loadScaledTree(value);
  };

  const handleRegenerate = async () => {
    if (dataScale === 'tree') {
      setTracks([]);
      setRenderMs(null);
      setTableKey((key) => key + 1);
      message.success('已重新加载树形演示');
      return;
    }
    await loadScaledTree(dataScale);
  };

  const stats = useMemo(() => {
    const treeNodes = countNodes(activeTreeData);
    const sheetRows = isDemoTree
      ? flattenTreeData(activeTreeData, treeConfig).rows.length
      : flatRowCount;
    const cols = 6;
    return {
      treeNodes,
      sheetRows,
      totalCols: cols,
      totalCells: sheetRows * cols,
      modeLabel: isDemoTree ? '树形演示' : '树形大数据',
    };
  }, [activeTreeData, flatRowCount, isDemoTree]);

  const options = useMemo(
    () => ({
      ...defaultOptions,
      name: isDemoTree ? 'Sales by Category' : `Tree Data ${targetRowCount}`,
      showGridLines: gridLines,
      freezeRows: freezeHeader ? 1 : 0,
      enableContextMenu: contextMenu,
      virtualScroll,
      defaultRowHeight: 32,
    }),
    [gridLines, freezeHeader, contextMenu, virtualScroll, isDemoTree, targetRowCount],
  );

  const refreshBreadcrumb = () => {
    setBreadcrumb(tableRef.current?.getBreadcrumb() || []);
  };

  const handleExpandAll = () => {
    tableRef.current?.expandAllRows();
    message.success('已展开全部 Category 行组');
    refreshBreadcrumb();
  };

  const handleCollapseAll = () => {
    tableRef.current?.collapseAllRows();
    message.success('已折叠全部 Category 行组');
    refreshBreadcrumb();
  };

  const handleDrillDown = () => {
    const ok = tableRef.current?.drillDown();
    message[ok ? 'success' : 'info'](ok ? '已下钻展开' : '当前行无可下钻分组');
    refreshBreadcrumb();
  };

  const handleDrillUp = () => {
    const ok = tableRef.current?.drillUp();
    message[ok ? 'success' : 'info'](ok ? '已上钻折叠' : '当前行无可上钻分组');
    refreshBreadcrumb();
  };

  const handleQuickSearch = async () => {
    if (searchKeyword.trim()) {
      const result = await tableRef.current?.search(searchKeyword.trim());
      if (result?.count) {
        message.success(`找到 ${result.count} 处，已定位 ${result.cell || ''}`);
      } else {
        message.warning('未找到匹配内容');
      }
      return;
    }
    const ok = tableRef.current?.openSearch();
    if (!ok) {
      message.warning('快速搜索不可用');
    }
  };

  const handleUndo = async () => {
    const ok = await tableRef.current?.undo();
    message[ok ? 'success' : 'info'](ok ? '已撤销上一步编辑' : '没有可撤销的操作');
  };

  const handleRedo = async () => {
    const ok = await tableRef.current?.redo();
    message[ok ? 'success' : 'info'](ok ? '已重做' : '没有可重做的操作');
  };

  const handleViewHistory = (cell: string) => {
    setFocusCell(cell);
    message.info(`已切换到 ${cell} 的历史记录`);
  };

  const handleViewTrace = (cell: string) => {
    setFocusCell(cell);
    const trace = tableRef.current?.getDataTrace(cell) || null;
    setTraceTree(trace);
    setTraceOpen(true);
  };

  const toAntdTree = (node: ETableDataTraceNode, key = 'root'): any => ({
    key,
    title: node.value ? `${node.label}: ${node.value}` : node.label,
    children: node.children?.map((child, index) =>
      toAntdTree(child, `${key}-${index}`),
    ),
  });

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100%' }}>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <h2 style={{ margin: 0 }}>Univer 树形分组 / 大数据示例</h2>
            <p style={{ margin: '4px 0 0 0', color: '#666' }}>
              上钻下钻 · 回撤重做 · 单元格历史 · 数据追踪 · 快速搜索 · Sales 数字 / Profit 下拉 / Date 日期
            </p>
          </Col>
          <Col>
            <Space wrap>
              <Select
                value={dataScale}
                style={{ width: 140 }}
                onChange={handleScaleChange}
                options={DATA_SCALE_OPTIONS.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
              />
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={handleRegenerate}
              >
                重新生成
              </Button>
              <Button icon={<ExpandAltOutlined />} onClick={handleExpandAll}>
                全部展开
              </Button>
              <Button icon={<ShrinkOutlined />} onClick={handleCollapseAll}>
                全部折叠
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} md={6}>
            <Statistic title="树节点数" value={stats.treeNodes} suffix="个" />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <Statistic title="展平行数" value={stats.sheetRows} suffix="行" />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <Statistic title="总列数" value={stats.totalCols} suffix="列" />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <Statistic title="变更记录" value={tracks.length} suffix="条" />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <Statistic title="数据模式" value={stats.modeLabel} />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <Statistic
              title="渲染时长"
              value={renderMs ?? '-'}
              suffix={renderMs == null ? undefined : 'ms'}
              valueStyle={
                renderMs != null && renderMs > 3000
                  ? { color: '#cf1322' }
                  : renderMs != null && renderMs > 1000
                    ? { color: '#d48806' }
                    : undefined
              }
            />
          </Col>
        </Row>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} lg={14}>
            <Space wrap>
              <Tooltip title="撤销上一步单元格编辑（Ctrl/Cmd+Z）">
                <Button icon={<UndoOutlined />} onClick={handleUndo}>
                  回撤
                </Button>
              </Tooltip>
              <Tooltip title="重做（Ctrl/Cmd+Y / Ctrl+Shift+Z）">
                <Button icon={<RedoOutlined />} onClick={handleRedo}>
                  重做
                </Button>
              </Tooltip>
              <Tooltip title="下钻：展开当前选中行组">
                <Button
                  icon={<VerticalAlignBottomOutlined />}
                  onClick={handleDrillDown}
                >
                  下钻
                </Button>
              </Tooltip>
              <Tooltip title="上钻：折叠当前选中行组">
                <Button
                  icon={<VerticalAlignTopOutlined />}
                  onClick={handleDrillUp}
                >
                  上钻
                </Button>
              </Tooltip>
              <Button icon={<ExpandAltOutlined />} onClick={handleExpandAll}>
                展开行
              </Button>
              <Button icon={<ShrinkOutlined />} onClick={handleCollapseAll}>
                折叠行
              </Button>
              <Input.Search
                placeholder="快速搜索"
                allowClear
                style={{ width: 220 }}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onSearch={handleQuickSearch}
                enterButton={<SearchOutlined />}
              />
              <Button onClick={() => tableRef.current?.openSearch()}>
                查找面板
              </Button>
            </Space>
          </Col>
          <Col xs={24} lg={10}>
            <Space wrap>
              <span>功能开关：</span>
              <Switch
                checked={gridLines}
                onChange={setGridLines}
                checkedChildren="网格线"
                unCheckedChildren="网格线"
              />
              <Switch
                checked={freezeHeader}
                onChange={setFreezeHeader}
                checkedChildren="冻结表头"
                unCheckedChildren="冻结表头"
              />
              <Switch
                checked={contextMenu}
                onChange={setContextMenu}
                checkedChildren="右键菜单"
                unCheckedChildren="右键菜单"
              />
              <Switch
                checked={virtualScroll}
                onChange={(checked) => {
                  setVirtualScroll(checked);
                  setRenderMs(null);
                  setTableKey((k) => k + 1);
                }}
                checkedChildren="虚拟滚动"
                unCheckedChildren="虚拟滚动"
              />
            </Space>
          </Col>
        </Row>
        {breadcrumb.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Breadcrumb
              items={[
                { title: '根' },
                ...breadcrumb.map((item) => ({ title: item })),
              ]}
            />
          </div>
        )}
        {loading && (
          <div style={{ marginTop: 12 }}>
            <Progress percent={progress} status="active" />
          </div>
        )}
      </Card>

      <Row gutter={16}>
        <Col xs={24} xl={17}>
          <Card>
            <Alert
              message="树形交互说明"
              description={
                isDemoTree
                  ? 'Sales 为数字列，Profit 为下拉（High/Medium/Low/Loss），Date 为日期列。右键可查看历史、数据追踪、上钻下钻、快速搜索。'
                  : `当前约 ${stats.sheetRows.toLocaleString()} 行。编辑 Sales/Profit 会写入数据追踪；50万/100万行可能较慢。`
              }
              type={!isDemoTree && targetRowCount >= 500000 ? 'warning' : 'info'}
              showIcon
              closable
              style={{ marginBottom: 16 }}
            />
            {loading ? (
              <div
                style={{
                  height: 560,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Spin size="large" tip={`生成树形数据中… ${progress}%`} />
              </div>
            ) : isDemoTree || scaledTreeData ? (
              <div style={{ height: 560, overflow: 'hidden' }}>
                <ETable
                  ref={tableRef}
                  key={`tree-${dataScale}-${tableKey}-${gridLines}-${freezeHeader}-${contextMenu}-${virtualScroll}`}
                  treeData={activeTreeData}
                  treeConfig={treeConfig}
                  options={options}
                  onReady={({ renderMs: ms }) => {
                    if (typeof ms === 'number') {
                      setRenderMs(ms);
                      if (ms >= 1000) {
                        message.info(`表格渲染完成，耗时 ${ms.toLocaleString()} ms`);
                      }
                    }
                  }}
                  onCellChange={(record: ETableCellChangeRecord) => {
                    setTracks((prev) => [record, ...prev].slice(0, 200));
                    setFocusCell(record.cell);
                  }}
                  onSelectionChange={(cell: string) => {
                    setFocusCell(cell);
                    refreshBreadcrumb();
                  }}
                  onViewCellHistory={handleViewHistory}
                  onViewDataTrace={handleViewTrace}
                />
              </div>
            ) : (
              <div
                style={{
                  height: 560,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#999',
                }}
              >
                请选择数据规模并点击「重新生成」
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} xl={7}>
          <Card
            size="small"
            title="数据追踪（最近变更）"
            style={{ marginBottom: 16, minHeight: 280 }}
            extra={
              <Button
                type="link"
                size="small"
                onClick={() => {
                  setTracks([]);
                  tableRef.current?.clearTracks();
                }}
              >
                清空
              </Button>
            }
          >
            {tracks.length === 0 ? (
              <div style={{ color: '#999' }}>编辑任意单元格后，变更会记录在这里。</div>
            ) : (
              <ul style={{ paddingLeft: 18, margin: 0, maxHeight: 220, overflow: 'auto' }}>
                {tracks.slice(0, 40).map((item) => (
                  <li key={item.id} style={{ marginBottom: 8 }}>
                    <div>
                      <a onClick={() => setFocusCell(item.cell)}>{item.cell}</a>
                      <span style={{ color: '#999' }}> · {item.time}</span>
                    </div>
                    <div>
                      {item.from || '∅'} → {item.to || '∅'}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card size="small" title={`单元格历史 · ${focusCell}`} style={{ minHeight: 240 }}>
            {cellHistory.length === 0 ? (
              <div style={{ color: '#999' }}>
                编辑当前单元格并确认后，这里会列出该格的变更历史。也可右键「查看单元格历史」。
              </div>
            ) : (
              <ul style={{ paddingLeft: 18, margin: 0, maxHeight: 200, overflow: 'auto' }}>
                {cellHistory.map((item) => (
                  <li key={item.id} style={{ marginBottom: 8 }}>
                    <div style={{ color: '#999' }}>{item.time}</div>
                    <div>
                      {item.from || '∅'} → {item.to || '∅'}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }} size="small">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <h4>功能说明</h4>
            <ul>
              <li>上钻 / 下钻：按当前选中行折叠或展开行组，顶部显示面包屑</li>
              <li>回撤 / 重做：工具栏按钮、右键菜单或 Ctrl/Cmd+Z / Ctrl+Y</li>
              <li>单元格历史 / 数据追踪：编辑后右侧记录；右键可打开追踪树</li>
              <li>快速搜索：工具栏搜索或 Ctrl/Cmd+F 查找面板</li>
              <li>虚拟滚动：Canvas 仅绘制可视区；大数据分片写入（可在功能开关关闭）</li>
              <li>
                Sales 数字列，Profit 下拉（{PROFIT_OPTIONS.join(' / ')}），Date 日期列
              </li>
            </ul>
          </Col>
          <Col xs={24} md={12}>
            <h4>封装特点</h4>
            <ul>
              <li>
                声明式 <code>treeData</code> + <code>treeConfig</code>
              </li>
              <li>
                列 <code>type: number | select | date</code> + 数据验证
              </li>
              <li>Ref：drillDown / drillUp / openSearch / getDataTrace</li>
              <li>基于 Univer Sheets Preset 组合能力</li>
            </ul>
          </Col>
        </Row>
      </Card>

      <Modal
        title={traceTree?.label || '数据追踪'}
        open={traceOpen}
        onCancel={() => setTraceOpen(false)}
        footer={null}
        width={480}
      >
        {traceTree ? (
          <Tree
            defaultExpandAll
            treeData={[toAntdTree(traceTree)]}
          />
        ) : (
          <div style={{ color: '#999' }}>暂无追踪信息</div>
        )}
      </Modal>
    </div>
  );
};

export default UniverTablePage;
