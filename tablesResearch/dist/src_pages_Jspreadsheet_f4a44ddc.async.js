(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/pages/Jspreadsheet/dictionary.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "zhCN",
    ()=>zhCN
]);
const zhCN = {
    Show: '显示',
    Hide: '隐藏',
    Search: '搜索',
    Reset: '重置',
    Find: '查找',
    Replace: '替换',
    'Find and Replace': '查找替换',
    Undo: '撤销',
    Redo: '重做',
    Download: '下载',
    Print: '打印',
    Fullscreen: '全屏',
    Save: '保存',
    Cancel: '取消',
    Copy: '复制',
    Cut: '剪切',
    Paste: '粘贴',
    Comments: '批注',
    'Edit this post': '编辑此批注',
    'Delete this post': '删除此批注',
    'Insert a new row before': '在上方插入行',
    'Insert a new row after': '在下方插入行',
    'Delete selected rows': '删除选中行',
    'Insert a new column before': '在左侧插入列',
    'Insert a new column after': '在右侧插入列',
    'Delete selected columns': '删除选中列',
    'Rename this column': '重命名列',
    'Order ascending': '升序',
    'Order descending': '降序',
    'Hide selected columns': '隐藏选中列',
    'Show hidden columns': '显示隐藏列',
    'Hide selected rows': '隐藏选中行',
    'Show hidden rows': '显示隐藏行'
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/pages/Jspreadsheet/index.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>JspreadsheetPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$react$2f$dist$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@jspreadsheet/react/dist/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$comments$2f$dist$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@jspreadsheet/comments/dist/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$search$2f$dist$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@jspreadsheet/search/dist/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$bar$2f$dist$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@jspreadsheet/bar/dist/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$formula$2d$pro$2f$dist$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@jspreadsheet/formula-pro/dist/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$pivot$2f$dist$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@jspreadsheet/pivot/dist/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$bar$2f$dist$2f$formulas$2e$json$2e5b$json$5d2e$cjs__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@jspreadsheet/bar/dist/formulas.json.[json].cjs [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lemonadejs$2f$dist$2f$lemonade$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/lemonadejs/dist/lemonade.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$antd$2f$es$2f$message$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__message$3e$__ = __turbopack_context__.i("[project]/node_modules/antd/es/message/index.js [client] (ecmascript) <export default as message>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$Jspreadsheet$2f$dictionary$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/Jspreadsheet/dictionary.ts [client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
// 批注扩展依赖全局 lemonade
window.lemonade = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lemonadejs$2f$dist$2f$lemonade$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"];
__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$react$2f$dist$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jspreadsheet"].setLicense(// 官方文档一日试用 license；过期后表格会只读。可到 https://jspreadsheet.com 重新生成。
'ZjU5MmI5OTg4NDM1NGQ0YWYzMDU1NGYxMjNkN2EwYzU4ODdjNWI4NDZkNjFkNWJjMWU5ZmE0ZTk3ZjNlMzUzNmZmNDliYjU5ZjEwNDk5ZDIwYTc2MGU1YmU4YWRiMDZlZThjNmU4NTY5NjVlZTAzZjQ4MGJmYzQ3NjA5ZTA3YWMsZXlKamJHbGxiblJKWkNJNklpSXNJbTVoYldVaU9pSktjM0J5WldGa2MyaGxaWFFpTENKa1lYUmxJam94TnpnM09ERTRNall5TENKa2IyMWhhVzRpT2xzaWFuTndjbVZoWkhOb1pXVjBMbU52YlNJc0ltTnZaR1Z6WVc1a1ltOTRMbWx2SWl3aWFuTm9aV3hzTG01bGRDSXNJbU56WWk1aGNIQWlMQ0p6ZEdGamEySnNhWFI2TG1sdklpd2lkMlZpWTI5dWRHRnBibVZ5TG1sdklpd2liRzlqWVd4b2IzTjBJbDBzSW5Cc1lXNGlPaUl6TkNJc0luTmpiM0JsSWpwYkluWTNJaXdpZGpnaUxDSjJPU0lzSW5ZeE1DSXNJbll4TVNJc0luWXhNaUlzSW1Ob1lYSjBjeUlzSW1admNtMXpJaXdpWm05eWJYVnNZU0lzSW5CaGNuTmxjaUlzSW5KbGJtUmxjaUlzSW1OdmJXMWxiblJ6SWl3aWFXMXdiM0owWlhJaUxDSmlZWElpTENKMllXeHBaR0YwYVc5dWN5SXNJbk5sWVhKamFDSXNJbkJ5YVc1MElpd2ljMmhsWlhSeklpd2lZMnhwWlc1MElpd2ljMlZ5ZG1WeUlpd2ljMmhoY0dWeklpd2labTl5YldGMElpd2ljR2wyYjNRaVhTd2laR1Z0YnlJNmRISjFaWDA9');
__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$react$2f$dist$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jspreadsheet"].setDictionary(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$Jspreadsheet$2f$dictionary$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["zhCN"]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$comments$2f$dist$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"])({
    user_id: 1,
    name: '演示用户',
    permission: 2
});
// Edition bar：本地公式建议，避免远程拉取失败
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$bar$2f$dist$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"])({
    suggestions: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$bar$2f$dist$2f$formulas$2e$json$2e5b$json$5d2e$cjs__$5b$client$5d$__$28$ecmascript$29$__["default"]
});
const extensions = {
    formula: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$formula$2d$pro$2f$dist$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"],
    bar: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$bar$2f$dist$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"],
    comments: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$comments$2f$dist$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"],
    search: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$search$2f$dist$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"],
    pivot: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$pivot$2f$dist$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"]
};
/** 插件 onevent 会先于 Worksheet 事件触发，用桥接把变更交给页面 state */ const historyBridge = {
    onChange: (_ws, _x, _y, _oldValue, _newValue)=>{},
    onSelect: (_ws, _px, _py, _ux, _uy)=>{}
};
const cellHistoryPlugin = {
    onevent (event, worksheet, a, b, c, d, e) {
        if (event === 'onchange') {
            historyBridge.onChange(worksheet, b, c, e, d);
            return;
        }
        if (event === 'onafterchanges' && Array.isArray(a)) {
            a.forEach((rec)=>{
                historyBridge.onChange(worksheet, rec.x ?? rec.col, rec.y ?? rec.row, rec.oldValue ?? rec.oldvalue, rec.value ?? rec.newValue ?? rec.v);
            });
            return;
        }
        if (event === 'oneditionend' && e) {
            historyBridge.onChange(worksheet, b, c, undefined, d);
            return;
        }
        if (event === 'onselection') {
            historyBridge.onSelect(worksheet, a, b, c, d);
        }
    }
};
const REGIONS = [
    '华东',
    '华南',
    '华北',
    '西南',
    '西北'
];
const CATEGORIES = [
    '整机',
    '配件',
    '耗材',
    '服务'
];
const STATUS = [
    '待审核',
    '已通过',
    '已驳回'
];
const PIVOT_CATEGORIES = [
    {
        name: 'Furniture',
        children: [
            'Bookcases',
            'Chairs',
            'Furnishings'
        ]
    },
    {
        name: 'Office Supplies',
        children: [
            'Binders',
            'Paper',
            'Storage'
        ]
    },
    {
        name: 'Technology',
        children: [
            'Phones',
            'Accessories',
            'Machines'
        ]
    }
];
const PIVOT_REGIONS = [
    'East',
    'Central',
    'West',
    'South'
];
function cellName(x, y) {
    const col = Number(x);
    const row = Number(y);
    if (!Number.isFinite(col) || !Number.isFinite(row) || col < 0 || row < 0) return '';
    try {
        const name = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$react$2f$dist$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jspreadsheet"].helpers?.getCellNameFromCoords?.(col, row);
        if (name) return name;
    } catch  {
    // fallback below
    }
    let letters = '';
    let n = col;
    do {
        letters = String.fromCharCode(65 + n % 26) + letters;
        n = Math.floor(n / 26) - 1;
    }while (n >= 0)
    return `${letters}${row + 1}`;
}
function buildSeedRows(count) {
    const rows = [];
    for(let i = 0; i < count; i += 1){
        const region = REGIONS[i % REGIONS.length];
        const category = CATEGORIES[i % CATEGORIES.length];
        const qty = Math.floor(Math.random() * 900) + 10;
        const price = Number((Math.random() * 800 + 20).toFixed(2));
        const day = String(i % 28 + 1).padStart(2, '0');
        rows.push([
            `订单-${10000 + i}`,
            region,
            category,
            STATUS[i % STATUS.length],
            `2025-${String(i % 12 + 1).padStart(2, '0')}-${day}`,
            qty,
            price,
            Number((qty * price).toFixed(2)),
            '',
            i % 17 === 0 ? '需要跟进' : '',
            `销售${i % 8 + 1}`,
            i % 2 === 0 ? '线上' : '线下',
            `仓-${i % 5 + 1}`
        ]);
    }
    return rows;
}
/** 透视源数据：Category / SubCategory / Region / Sales / Profit */ function buildPivotSourceData() {
    const header = [
        'Category',
        'SubCategory',
        'Region',
        'Sales',
        'Profit'
    ];
    const rows = [
        header
    ];
    let seed = 1;
    PIVOT_CATEGORIES.forEach((cat)=>{
        cat.children.forEach((sub)=>{
            PIVOT_REGIONS.forEach((region)=>{
                seed += 1;
                const sales = Number((20000 + seed * 137 % 35000 + seed * 11.37).toFixed(2));
                const profit = Number(((seed % 5 - 2) * 800 + seed % 17 * 35.2 - 400).toFixed(2));
                rows.push([
                    cat.name,
                    sub,
                    region,
                    sales,
                    profit
                ]);
            });
        });
    });
    return rows;
}
function getWorksheetList(ref) {
    const current = ref.current;
    if (!current) return [];
    return Array.isArray(current) ? current : [
        current
    ];
}
/** 当前激活工作表（工具栏/附件操作优先作用在当前页） */ function getActiveWorksheet(ref) {
    const list = getWorksheetList(ref);
    if (!list.length) return null;
    const parent = list[0]?.parent;
    const idx = typeof parent?.getWorksheetActive === 'function' ? parent.getWorksheetActive() : 0;
    return list[idx] || list[0];
}
function getWorksheetByName(ref, name) {
    const list = getWorksheetList(ref);
    return list.find((ws)=>ws?.options?.worksheetName === name || ws?.getWorksheetName?.() === name) || null;
}
function JspreadsheetPage() {
    _s();
    const spreadsheet = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [tracks, setTracks] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [historyCell, setHistoryCell] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])('A1');
    const fileInputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const attachTarget = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const orderData = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useMemo"])(()=>buildSeedRows(2000), []);
    const pivotSourceData = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useMemo"])(()=>buildPivotSourceData(), []);
    const pivotSourceRowCount = pivotSourceData.length;
    const columns = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useMemo"])(()=>[
            {
                type: 'text',
                title: '订单号',
                width: 120,
                align: 'left'
            },
            {
                type: 'dropdown',
                title: '区域',
                width: 100,
                source: REGIONS,
                autocomplete: true
            },
            {
                type: 'dropdown',
                title: '品类',
                width: 100,
                source: CATEGORIES
            },
            {
                type: 'dropdown',
                title: '状态',
                width: 100,
                source: STATUS
            },
            {
                type: 'calendar',
                title: '下单日期',
                width: 120,
                format: 'YYYY-MM-DD'
            },
            {
                type: 'numeric',
                title: '数量',
                width: 90,
                mask: '#,##0',
                align: 'right',
                group: 3,
                state: true
            },
            {
                type: 'numeric',
                title: '单价',
                width: 100,
                mask: '#,##0.00',
                align: 'right'
            },
            {
                type: 'numeric',
                title: '金额',
                width: 110,
                mask: '#,##0.00',
                align: 'right'
            },
            {
                type: 'text',
                title: '附件',
                width: 120,
                align: 'left',
                readOnly: false
            },
            {
                type: 'text',
                title: '备注',
                width: 160,
                align: 'left'
            },
            {
                type: 'text',
                title: '销售员',
                width: 90,
                group: 3,
                state: true
            },
            {
                type: 'text',
                title: '渠道',
                width: 90
            },
            {
                type: 'text',
                title: '仓库',
                width: 90
            }
        ], []);
    const nestedHeaders = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useMemo"])(()=>[
            [
                {
                    title: '基础信息',
                    colspan: 5
                },
                {
                    title: '数值指标',
                    colspan: 3
                },
                {
                    title: '扩展字段',
                    colspan: 5
                }
            ]
        ], []);
    /** 多级行组：品类 → 明细，类似透视表可折叠树 */ const orderRows = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        const map = {};
        for(let i = 0; i < 40; i += 5){
            map[i] = {
                group: 4,
                state: true
            };
        }
        for(let i = 0; i < 40; i += 5){
            map[i + 2] = {
                group: 2,
                state: false
            };
        }
        return map;
    }, []);
    const commentsData = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useMemo"])(()=>({
            // 高级批注扩展：必须是对象数组，字符串只会显示红点/title，点不开弹层
            A1: [
                {
                    user_id: 1,
                    name: '演示用户',
                    date: '2025-08-01 10:00:00',
                    comments: '示例批注：可在此讨论订单细节。'
                }
            ],
            D2: [
                {
                    user_id: 1,
                    name: '演示用户',
                    date: '2025-08-02 14:30:00',
                    comments: '状态待确认'
                }
            ]
        }), []);
    /**
   * 透视分析表（参考图片）：
   * - 行维度：Category → SubCategory（多行折叠，▼/▶）
   * - 列维度：Region（多列折叠）
   * - 值：Sales / Profit
   */ const pivotTables = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useMemo"])(()=>[
            {
                anchor: 'A1',
                source: `透视源数据!A1:E${pivotSourceRowCount}`,
                rows: [
                    {
                        columnIndex: 0,
                        sortBy: 'name',
                        ascendingOrder: true
                    },
                    {
                        columnIndex: 1,
                        sortBy: 'name',
                        ascendingOrder: true,
                        collapsed: [
                            'Furnishings',
                            'Paper',
                            'Machines'
                        ]
                    }
                ],
                columns: [
                    {
                        columnIndex: 2,
                        sortBy: 'name',
                        ascendingOrder: true,
                        collapsed: [
                            'Central',
                            'South'
                        ]
                    }
                ],
                cells: [
                    {
                        id: 'pivot-sales',
                        columnIndex: 3,
                        method: 'SUM'
                    },
                    {
                        id: 'pivot-profit',
                        columnIndex: 4,
                        method: 'SUM'
                    }
                ]
            }
        ], [
        pivotSourceRowCount
    ]);
    const pivotSourceColumns = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useMemo"])(()=>[
            {
                type: 'text',
                title: 'Category',
                width: 140
            },
            {
                type: 'text',
                title: 'SubCategory',
                width: 140
            },
            {
                type: 'dropdown',
                title: 'Region',
                width: 110,
                source: PIVOT_REGIONS
            },
            {
                type: 'numeric',
                title: 'Sales',
                width: 120,
                mask: '#,##0.00',
                align: 'right'
            },
            {
                type: 'numeric',
                title: 'Profit',
                width: 120,
                mask: '#,##0.00',
                align: 'right'
            }
        ], []);
    // Spreadsheet React 只初始化一次；用插件 onevent + 挂载后包装 config.onevent 双保险
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const bind = ()=>{
            const list = getWorksheetList(spreadsheet);
            const parent = list[0]?.parent;
            if (!parent?.config) return false;
            if (parent.config.__historyBound) return true;
            const prev = parent.config.onevent;
            parent.config.onevent = function historyOnevent(event, ...rest) {
                cellHistoryPlugin.onevent(event, ...rest);
                return prev?.call(this, event, ...rest);
            };
            parent.config.__historyBound = true;
            return true;
        };
        if (bind()) return undefined;
        const timer = window.setInterval(()=>{
            if (bind()) window.clearInterval(timer);
        }, 50);
        return ()=>window.clearInterval(timer);
    }, []);
    const stringifyValue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])((value)=>{
        if (value == null || value === '') return '';
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        if (Array.isArray(value)) return value.map((item)=>stringifyValue(item)).join(', ');
        if (typeof value === 'object') {
            if ('value' in value) return stringifyValue(value.value);
            try {
                return JSON.stringify(value);
            } catch  {
                return '';
            }
        }
        return String(value);
    }, []);
    const pushTrack = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])((cell, from, to)=>{
        if (!cell) return;
        const fromText = stringifyValue(from);
        const toText = stringifyValue(to);
        if (fromText === toText) return;
        const item = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            cell,
            from: fromText,
            to: toText,
            time: new Date().toLocaleString()
        };
        setTracks((prev)=>{
            const last = prev[0];
            if (last && last.cell === cell && last.from === fromText && last.to === toText) {
                return prev;
            }
            return [
                item,
                ...prev
            ].slice(0, 200);
        });
    }, [
        stringifyValue
    ]);
    const syncAmount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])((worksheet, col, row)=>{
        if (col !== 5 && col !== 6) return;
        const qty = Number(worksheet.getValueFromCoords?.(5, row) ?? 0);
        const price = Number(worksheet.getValueFromCoords?.(6, row) ?? 0);
        if (Number.isNaN(qty) || Number.isNaN(price)) return;
        const amount = Number((qty * price).toFixed(2));
        const prev = worksheet.getValueFromCoords?.(7, row);
        if (Number(prev) === amount) return;
        const ignore = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$react$2f$dist$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jspreadsheet"].history;
        if (ignore) ignore.ignore = true;
        worksheet.setValueFromCoords?.(7, row, amount, true);
        if (ignore) ignore.ignore = false;
    }, []);
    historyBridge.onChange = (worksheet, x, y, oldValue, newValue)=>{
        const col = Number(x);
        const row = Number(y);
        const name = cellName(col, row);
        if (!name) return;
        setHistoryCell(name);
        pushTrack(name, oldValue, newValue);
        syncAmount(worksheet, col, row);
    };
    historyBridge.onSelect = (_worksheet, px, py, ux, uy)=>{
        const start = cellName(Number(px), Number(py));
        const end = cellName(Number(ux), Number(uy));
        if (!start) return;
        setHistoryCell(start === end ? start : `${start}:${end}`);
    };
    // 高级批注扩展写入的是对象数组；不要再压成字符串，否则红三角弹层为空
    const onbeforecomments = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])((_ws, cells)=>{
        const next = {};
        Object.keys(cells || {}).forEach((key)=>{
            const val = cells[key];
            if (val == null || val === '') {
                next[key] = '';
                return;
            }
            if (typeof val === 'string' || Array.isArray(val)) {
                next[key] = val;
                return;
            }
            if (typeof val === 'object' && (val.comments != null || val.text != null)) {
                next[key] = [
                    val
                ];
                return;
            }
            next[key] = '';
        });
        return next;
    }, []);
    const handleAttachFile = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])((e)=>{
        const file = e.target.files?.[0];
        const target = attachTarget.current;
        const ws = getWorksheetByName(spreadsheet, '订单明细') || getActiveWorksheet(spreadsheet);
        e.target.value = '';
        if (!file || !target || !ws) return;
        const reader = new FileReader();
        reader.onload = ()=>{
            const url = String(reader.result || '');
            // 附件列存文件名（可点开看 meta 里的 dataURL）
            ws.setValueFromCoords(8, target.y, file.name, true);
            ws.setMeta(cellName(8, target.y), {
                attachmentName: file.name,
                attachmentType: file.type,
                attachmentSize: file.size,
                attachmentDataUrl: url
            });
            pushTrack(cellName(8, target.y), '', `[附件] ${file.name}`);
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$antd$2f$es$2f$message$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__message$3e$__["message"].success(`已添加附件：${file.name}`);
        };
        reader.readAsDataURL(file);
    }, [
        pushTrack
    ]);
    const contextMenu = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])((instance, x, y, _e, items, section)=>{
        if (section !== 'cell' && section !== 'header') return items;
        items.push({
            type: 'line'
        });
        items.push({
            title: '查看单元格历史',
            icon: 'history',
            onclick: ()=>{
                if (typeof x === 'number' && typeof y === 'number') {
                    setHistoryCell(cellName(x, y));
                }
            }
        });
        items.push({
            title: '添加单元格附件',
            icon: 'attach_file',
            onclick: ()=>{
                if (typeof x !== 'number' || typeof y !== 'number') return;
                attachTarget.current = {
                    x,
                    y
                };
                fileInputRef.current?.click();
            }
        });
        items.push({
            title: '批量复制选区',
            icon: 'content_copy',
            onclick: ()=>{
                instance.copy?.();
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$antd$2f$es$2f$message$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__message$3e$__["message"].success('已复制选区到剪贴板');
            }
        });
        items.push({
            title: '隐藏当前列',
            icon: 'visibility_off',
            onclick: ()=>{
                if (typeof x === 'number') instance.hideColumn(x);
            }
        });
        items.push({
            title: '显示全部隐藏列',
            icon: 'visibility',
            onclick: ()=>{
                const total = instance.getHeaders?.()?.length ?? columns.length;
                instance.showColumn(Array.from({
                    length: total
                }, (_, i)=>i));
            }
        });
        items.push({
            title: '展开行组（下钻）',
            icon: 'unfold_more',
            onclick: ()=>instance.openRowGroup(typeof y === 'number' ? y : undefined)
        });
        items.push({
            title: '折叠行组（上钻）',
            icon: 'unfold_less',
            onclick: ()=>instance.closeRowGroup(typeof y === 'number' ? y : undefined)
        });
        items.push({
            title: '展开列组',
            icon: 'view_column',
            onclick: ()=>instance.openColumnGroup(typeof x === 'number' ? x : undefined)
        });
        items.push({
            title: '折叠列组',
            icon: 'view_week',
            onclick: ()=>instance.closeColumnGroup(typeof x === 'number' ? x : undefined)
        });
        return items;
    }, [
        columns.length
    ]);
    const toolbar = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])((defaultToolbar)=>{
        const ws = ()=>getActiveWorksheet(spreadsheet) || getWorksheetByName(spreadsheet, '订单明细');
        const extraItems = [
            {
                type: 'divisor'
            },
            {
                content: 'content_copy',
                tooltip: '批量复制选区',
                onclick: ()=>{
                    ws()?.copy?.();
                    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$antd$2f$es$2f$message$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__message$3e$__["message"].success('已复制选区');
                }
            },
            {
                content: 'search',
                tooltip: '快速搜索',
                onclick: ()=>{
                    const sheet = ws();
                    sheet?.showSearch?.();
                    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$search$2f$dist$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"]?.(sheet);
                }
            },
            {
                type: 'divisor'
            },
            {
                content: 'unfold_more',
                tooltip: '下钻：展开行组',
                onclick: ()=>ws()?.openRowGroup?.()
            },
            {
                content: 'unfold_less',
                tooltip: '上钻：折叠行组',
                onclick: ()=>ws()?.closeRowGroup?.()
            },
            {
                content: 'view_column',
                tooltip: '展开多列分组',
                onclick: ()=>ws()?.openColumnGroup?.()
            },
            {
                content: 'view_week',
                tooltip: '折叠多列分组',
                onclick: ()=>ws()?.closeColumnGroup?.()
            },
            {
                type: 'divisor'
            },
            {
                content: 'visibility_off',
                tooltip: '隐藏选中列',
                onclick: ()=>{
                    const sheet = ws();
                    const selected = sheet?.getSelectedColumns?.() || [];
                    if (!selected.length) {
                        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$antd$2f$es$2f$message$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__message$3e$__["message"].warning('请先选中列');
                        return;
                    }
                    sheet.hideColumn(selected);
                }
            },
            {
                content: 'visibility',
                tooltip: '显示全部隐藏列',
                onclick: ()=>{
                    const sheet = ws();
                    const total = sheet?.getHeaders?.()?.length ?? columns.length;
                    sheet?.showColumn?.(Array.from({
                        length: total
                    }, (_, i)=>i));
                }
            },
            {
                content: 'width_wide',
                tooltip: '自适应内容宽度',
                onclick: ()=>{
                    ws()?.autoWidth?.();
                    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$antd$2f$es$2f$message$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__message$3e$__["message"].success('已按内容自适应列宽');
                }
            },
            {
                content: 'download',
                tooltip: '导出 CSV',
                onclick: ()=>ws()?.download?.()
            }
        ];
        // 官方约定：回调收到 { items, responsive, ... }，应原地追加，保留撤销/重做等默认项样式
        if (defaultToolbar && Array.isArray(defaultToolbar.items)) {
            defaultToolbar.items.push(...extraItems);
            return defaultToolbar;
        }
        if (Array.isArray(defaultToolbar)) {
            defaultToolbar.push(...extraItems);
            return defaultToolbar;
        }
        return {
            items: extraItems,
            responsive: true
        };
    }, [
        columns.length
    ]);
    const focusCell = historyCell.split(':')[0];
    const cellHistory = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useMemo"])(()=>tracks.filter((item)=>item.cell === focusCell), [
        tracks,
        focusCell
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "jss-page",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "jss-page__hint",
                children: "「订单明细」已集成：批注 / 下钻上钻 / 回撤 / 批量复制 / 多行列折叠 / 自定义右键 / 下拉·日期·数值 / 单元格历史 / 数据追踪 / 快速搜索 / 显隐列 / 附件 / 大数据虚拟滚动 / 列宽拖动 / 自适应列宽。右键单元格可访问更多操作；「透视分析」页可看层级折叠示例。"
            }, void 0, false, {
                fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                lineNumber: 723,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                ref: fileInputRef,
                type: "file",
                accept: "image/*,.pdf,.txt,.csv,.xlsx",
                style: {
                    display: 'none'
                },
                onChange: handleAttachFile
            }, void 0, false, {
                fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                lineNumber: 729,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "jss-page__body",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "jss-page__sheet",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$react$2f$dist$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["Spreadsheet"], {
                            ref: spreadsheet,
                            toolbar: toolbar,
                            bar: true,
                            extensions: extensions,
                            plugins: {
                                cellHistory: cellHistoryPlugin
                            },
                            tabs: true,
                            tableOverflow: true,
                            tableWidth: "100%",
                            tableHeight: "560px",
                            onevent: (event, ...rest)=>{
                                cellHistoryPlugin.onevent(event, ...rest);
                            },
                            onbeforecomments: onbeforecomments,
                            contextMenu: contextMenu,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$react$2f$dist$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["Worksheet"], {
                                    worksheetName: "订单明细",
                                    data: orderData,
                                    columns: columns,
                                    nestedHeaders: nestedHeaders,
                                    rows: orderRows,
                                    comments: commentsData,
                                    allowComments: true,
                                    search: true,
                                    filters: true,
                                    columnResize: true,
                                    columnDrag: true,
                                    rowResize: true,
                                    fillHandle: true,
                                    editable: true,
                                    tableOverflow: true,
                                    tableWidth: "100%",
                                    tableHeight: "560px",
                                    virtualizationX: true,
                                    virtualizationY: true,
                                    pagination: false
                                }, void 0, false, {
                                    fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                                    lineNumber: 755,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$react$2f$dist$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["Worksheet"], {
                                    worksheetName: "透视分析",
                                    pivotTables: pivotTables,
                                    minDimensions: [
                                        16,
                                        28
                                    ]
                                }, void 0, false, {
                                    fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                                    lineNumber: 777,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$jspreadsheet$2f$react$2f$dist$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["Worksheet"], {
                                    worksheetName: "透视源数据",
                                    data: pivotSourceData,
                                    columns: pivotSourceColumns,
                                    columnResize: true,
                                    tableOverflow: true,
                                    tableWidth: "100%",
                                    tableHeight: "560px"
                                }, void 0, false, {
                                    fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                                    lineNumber: 782,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                            lineNumber: 739,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                        lineNumber: 738,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("aside", {
                        className: "jss-page__side",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                className: "jss-panel",
                                style: {
                                    flex: 1.2
                                },
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jss-panel__title",
                                        children: "数据追踪（最近变更）"
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                                        lineNumber: 796,
                                        columnNumber: 13
                                    }, this),
                                    tracks.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jss-panel__empty",
                                        children: "编辑任意单元格后，变更会记录在这里。"
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                                        lineNumber: 798,
                                        columnNumber: 15
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                        className: "jss-panel__list",
                                        children: tracks.slice(0, 40).map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                className: "jss-panel__item",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                                children: item.cell
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                                                                lineNumber: 804,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "jss-panel__meta",
                                                                children: [
                                                                    " · ",
                                                                    item.time
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                                                                lineNumber: 805,
                                                                columnNumber: 23
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                                                        lineNumber: 803,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        children: [
                                                            item.from || '∅',
                                                            " → ",
                                                            item.to || '∅'
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                                                        lineNumber: 807,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, item.id, true, {
                                                fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                                                lineNumber: 802,
                                                columnNumber: 19
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                                        lineNumber: 800,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                                lineNumber: 795,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                className: "jss-panel",
                                style: {
                                    flex: 1
                                },
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jss-panel__title",
                                        children: [
                                            "单元格历史 · ",
                                            focusCell || historyCell
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                                        lineNumber: 817,
                                        columnNumber: 13
                                    }, this),
                                    cellHistory.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jss-panel__empty",
                                        children: "双击编辑当前单元格并确认后，这里会列出该格的变更历史。"
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                                        lineNumber: 819,
                                        columnNumber: 15
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                        className: "jss-panel__list",
                                        children: cellHistory.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                className: "jss-panel__item",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "jss-panel__meta",
                                                        children: item.time
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                                                        lineNumber: 826,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        children: [
                                                            item.from || '∅',
                                                            " → ",
                                                            item.to || '∅'
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                                                        lineNumber: 827,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, item.id, true, {
                                                fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                                                lineNumber: 825,
                                                columnNumber: 19
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                                        lineNumber: 823,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                                lineNumber: 816,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                        lineNumber: 794,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
                lineNumber: 737,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/pages/Jspreadsheet/index.tsx",
        lineNumber: 722,
        columnNumber: 5
    }, this);
}
_s(JspreadsheetPage, "cjiOZk77vehcDKFVtiOIaklm8WQ=");
_c = JspreadsheetPage;
var _c;
__turbopack_context__.k.register(_c, "JspreadsheetPage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_pages_Jspreadsheet_f4a44ddc.async.js.map