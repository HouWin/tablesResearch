import React, { useRef,useEffect } from 'react';
import { useState } from 'react';
import { ListTable } from '@visactor/react-vtable';
import { HistoryPlugin } from '@visactor/vtable-plugins';
import { ContextMenuPlugin } from '@visactor/vtable-plugins';
import { SearchComponent } from '@visactor/vtable-search';

import styles from './index.less';
import jsonData from './data.json';
import { DateInputEditor, InputEditor, ListEditor, TextAreaEditor } from '@visactor/vtable-editors';
    const columns = [
         {
            field: 'Category',
            title: 'Category',
            width: 150,
            tree: true,  // 👈 标记为主树形列（显示缩进和折叠箭头）
         
        },
        {
            field: 'Region',
            title: 'Region',
            width: 120,
            // 👇 关键：通过自定义 style 实现多列树形缩进
            style: (args: any) => {
                const { row } = args;
                // 获取当前行的层级深度
                const depth = row?.hierarchyDepth ?? 0;
                // 非根节点缩进（模仿树形缩进）
                return {
                    paddingLeft: depth > 0 ? `${depth * 20 + 20}px` : '0px',
                };
            },
        },
        {
            field: '类别',
            tree: true,
            title: '类别',
            width: 'auto',
            editor: new InputEditor(), // 使用文本输入框
        },
        {
            field: 'p1',
            title: '属性1',
            width: 'auto',
            editor: new InputEditor(), // 使用文本输入框
        },
        {
            field: 'p2',
            title: '属性2',
            width: 'auto',
            editor: new InputEditor(), // 使用文本输入框
        },
        {
            field: '产品',
            tree: true,
            title: '产品',
            width: 'auto',
            editor: new InputEditor(), // 使用文本输入框
        },
        {
            field: 'month',
            title: '一月',
            width: 'auto',
            headerStyle: { textAlign: 'center' },
            columns: [
                { field: '1-数量', title: '数量', width: 'auto', style: { textAlign: 'right' }},
                { field: '1-销售额', title: '销售额', width: 'auto', style: { textAlign: 'right' }},
                { field: '1-利润', title: '利润', width: 'auto', style: { textAlign: 'right' }}
            ]
        },
        {
            field: 'month',
            title: '二月',
            width: 'auto',
            headerStyle: { textAlign: 'center' },
            columns: [
                { field: '2-数量', title: '数量', width: 'auto', style: { textAlign: 'right' } },
                { field: '2-销售额', title: '销售额', width: 'auto', style: { textAlign: 'right' } },
                { field: '2-利润', title: '利润', width: 'auto', style: { textAlign: 'right' } }
            ]
        }
    ];

    // 👇 2. 创建插件实例并保存到 ref
    const historyPlugin = new HistoryPlugin({
        maxHistory: 100,
        enableCompression: false
    });

    const contextMenuPlugin = new ContextMenuPlugin({
    // 使用默认菜单项
    // 在菜单显示前动态调整菜单项
    beforeShowAdjustMenuItems: (menuItems, table, col, row) => {
      // 可以基于单元格位置、内容等条件动态调整菜单项
      if (table.isHeader(col, row)) {
        // 表头区域的额外处理
        return [
          ...menuItems,
          '---',
          { text: '自定义表头操作', menuKey: 'custom_header_action' }
        ];
      }
      
      // 获取单元格数据
      const cellValue = table.getCellValue(col, row);
      
      // 根据单元格值动态添加菜单项
      if (typeof cellValue === 'number' && cellValue > 100) {
        return [
          ...menuItems,
          '---',
          { text: '高亮大数值', menuKey: 'highlight_large_value' }
        ];
      }
      return [
        ...menuItems,
        '---',
        { text: '下钻', menuKey: 'xiazuan' }    
      ];
    },
    // 自定义菜单点击回调
    menuClickCallback: (args, table) => {
      // 自定义菜单点击处理
      console.log('菜单点击:', args);
      
      if (args.menuKey === 'xiazuan') {
        // 执行自定义操作\
        alert('执行下钻操作');
      }
    }
  });
    const option = {
        records: jsonData,
        columns,
        widthMode: 'standard',
          plugins: [
            new HistoryPlugin({
            maxHistory: 100,
            enableCompression: false
            }),
          contextMenuPlugin  
        ],
        editCellTrigger: 'click', // 点击单元格触发编辑
        hierarchyColumnField: 'Region',
        hierarchyIndent: 20,
        hierarchyExpandLevel: 2,
    };
const VtablePage: React.FC = () => {
    const tableRef = useRef<any>(null);
    const searchRef =  useRef<any>(null);
    const [searchValue, setSearchValue] = useState('');
     // ✅ 组件挂载后获取插件实例
    useEffect(() => {
     const timer = setTimeout(() => {
        console.log('tableRef', tableRef);
        if (tableRef.current) {
            const instance = tableRef.current;
            if (instance) {
                searchRef.current = new SearchComponent({
                    table: instance,  // 传实例，不是 ref
                    autoJump: true
                });
                console.log('searchRef.current', searchRef.current);
            }
        }
    }, 2000);  // 延迟 200ms 确保表格已渲染
    return () => clearTimeout(timer);
    }, []); 
    // 👇 1. 创建 ref 保存插件实例
    const inputEditor = new InputEditor();
    const dateEditor = new DateInputEditor();


    const [count, setCount] = useState(0);

    function handleClick() {
        setCount(count + 1);
        alert(`Clicked ${count} times`);
    }

    // 👇 3. 撤销/重做处理函数
    function handleUndo() {
        const history = tableRef.current.pluginManager.getPlugin('history-plugin') as HistoryPlugin;
        history.undo();
    }

    function handleRedo() {
        const history = tableRef.current.pluginManager.getPlugin('history-plugin') as HistoryPlugin;
        history.redo();
    }
    const handleSearch = () => {
        if (searchRef.current) {
           const searchResult = searchRef.current.search(searchValue);
        }
    };
    function setSearchKeyword(value: string): void {
        setSearchValue(value);
    }

    function handleJumpPrev(): void {
        console.log('jump prev',searchRef);
       const searchResult = searchRef.current.prev(); // 跳转到上一条搜索结果
    }
    function handleJumpNext(): void {
       const searchResult = searchRef.current.next(); // 跳转到下一条搜索结果
    }
    return (
        <div id="root" className={styles.container}>
            <h1 onClick={handleClick}>Vtable{count}</h1>
            <input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="输入搜索关键词..."
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleJumpPrev}>⬆ 上一个</button>
            <button onClick={handleJumpNext}>⬇ 下一个</button>
            <button onClick={handleSearch}>搜索</button>
            <button onClick={handleUndo}>撤销</button>  {/* 👈 绑定撤销 */}
            <button onClick={handleRedo}>重做</button>  {/* 👈 绑定重做 */}
            <ListTable option={option} height={'500px'} ref={tableRef} />
        </div>
    );
};

export default VtablePage;