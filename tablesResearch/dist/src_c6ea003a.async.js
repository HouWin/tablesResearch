(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/components/UniverTable/attachment.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ATTACHMENT_META_KEY",
    ()=>ATTACHMENT_META_KEY,
    "appendCellAttachments",
    ()=>appendCellAttachments,
    "applyInitialAttachments",
    ()=>applyInitialAttachments,
    "clearCellAttachments",
    ()=>clearCellAttachments,
    "createAttachmentId",
    ()=>createAttachmentId,
    "defaultUploadAttachment",
    ()=>defaultUploadAttachment,
    "formatFileSize",
    ()=>formatFileSize,
    "getCellAttachments",
    ()=>getCellAttachments,
    "pickFiles",
    ()=>pickFiles,
    "removeCellAttachment",
    ()=>removeCellAttachment,
    "setCellAttachments",
    ()=>setCellAttachments,
    "showAttachmentsModal",
    ()=>showAttachmentsModal,
    "syncAttachmentNote",
    ()=>syncAttachmentNote,
    "uploadAndAttachToCell",
    ()=>uploadAndAttachToCell
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$antd$2f$es$2f$modal$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Modal$3e$__ = __turbopack_context__.i("[project]/node_modules/antd/es/modal/index.js [client] (ecmascript) <export default as Modal>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$antd$2f$es$2f$message$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__message$3e$__ = __turbopack_context__.i("[project]/node_modules/antd/es/message/index.js [client] (ecmascript) <export default as message>");
;
;
const ATTACHMENT_META_KEY = 'etableAttachments';
const pickFiles = (multiple = true, accept)=>{
    return new Promise((resolve)=>{
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = multiple;
        if (accept) {
            input.accept = accept;
        }
        input.style.display = 'none';
        document.body.appendChild(input);
        input.onchange = ()=>{
            const files = Array.from(input.files || []);
            document.body.removeChild(input);
            resolve(files);
        };
        input.oncancel = ()=>{
            document.body.removeChild(input);
            resolve([]);
        };
        input.click();
    });
};
const createAttachmentId = ()=>{
    return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};
const defaultUploadAttachment = async (file)=>{
    return {
        id: createAttachmentId(),
        name: file.name,
        url: URL.createObjectURL(file),
        size: file.size,
        mimeType: file.type || undefined,
        uploadedAt: new Date().toISOString()
    };
};
const getCellAttachments = (range)=>{
    if (!range?.getCustomMetaData) {
        return [];
    }
    try {
        const meta = range.getCustomMetaData() || {};
        const list = meta[ATTACHMENT_META_KEY];
        return Array.isArray(list) ? list : [];
    } catch  {
        return [];
    }
};
const syncAttachmentNote = (range, files)=>{
    try {
        if (!files.length) {
            if (typeof range.deleteNote === 'function') {
                const note = range.getNote?.();
                const text = typeof note === 'string' ? note : note?.note;
                if (typeof text === 'string' && text.startsWith('📎')) {
                    range.deleteNote();
                }
            }
            return;
        }
        if (typeof range.createOrUpdateNote === 'function') {
            range.createOrUpdateNote({
                note: files.map((file)=>`📎 ${file.name}`).join('\n'),
                width: 240,
                height: Math.min(40 + files.length * 22, 160),
                show: false
            });
        }
    } catch (error) {
        console.warn('[ETable] sync attachment note failed', error);
    }
};
const setCellAttachments = (range, files)=>{
    if (!range?.setCustomMetaData) {
        console.warn('[ETable] setCustomMetaData unavailable');
        return;
    }
    const prev = range.getCustomMetaData?.() || {};
    range.setCustomMetaData({
        ...prev,
        [ATTACHMENT_META_KEY]: files
    });
    syncAttachmentNote(range, files);
};
const appendCellAttachments = (range, incoming)=>{
    const current = getCellAttachments(range);
    const next = [
        ...current,
        ...incoming
    ];
    setCellAttachments(range, next);
    return next;
};
const clearCellAttachments = (range)=>{
    setCellAttachments(range, []);
};
const removeCellAttachment = (range, attachmentId)=>{
    const next = getCellAttachments(range).filter((item)=>item.id !== attachmentId);
    setCellAttachments(range, next);
    return next;
};
const formatFileSize = (size)=>{
    if (size === undefined || size === null || Number.isNaN(size)) {
        return '';
    }
    if (size < 1024) {
        return `${size} B`;
    }
    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
};
const showAttachmentsModal = (cell, files)=>{
    if (!files.length) {
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$antd$2f$es$2f$message$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__message$3e$__["message"].info(`单元格 ${cell} 暂无附件`);
        return;
    }
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$antd$2f$es$2f$modal$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Modal$3e$__["Modal"].info({
        title: `单元格附件（${cell}）`,
        width: 480,
        okText: '关闭',
        content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["createElement"])('div', {
            style: {
                maxHeight: 360,
                overflow: 'auto'
            }
        }, files.map((file)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["createElement"])('div', {
                key: file.id,
                style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '8px 0',
                    borderBottom: '1px solid #f0f0f0'
                }
            }, /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["createElement"])('div', {
                style: {
                    minWidth: 0
                }
            }, /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["createElement"])('div', {
                style: {
                    fontWeight: 500,
                    wordBreak: 'break-all'
                }
            }, `📎 ${file.name}`), /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["createElement"])('div', {
                style: {
                    color: '#8c8c8c',
                    fontSize: 12
                }
            }, [
                formatFileSize(file.size),
                file.mimeType
            ].filter(Boolean).join(' · '))), /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["createElement"])('a', {
                href: file.url,
                target: '_blank',
                rel: 'noreferrer',
                download: file.name
            }, '下载'))))
    });
};
const uploadAndAttachToCell = async (params)=>{
    const { range, cell, onUpload, accept, multiple = true } = params;
    if (!range) {
        return [];
    }
    const picked = await pickFiles(multiple, accept);
    if (!picked.length) {
        return getCellAttachments(range);
    }
    const uploaded = [];
    for (const file of picked){
        try {
            if (onUpload) {
                const result = await onUpload(file, cell);
                if (Array.isArray(result)) {
                    uploaded.push(...result);
                } else if (result) {
                    uploaded.push(result);
                }
            } else {
                uploaded.push(await defaultUploadAttachment(file));
            }
        } catch (error) {
            console.error('[ETable] upload attachment failed', error);
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$antd$2f$es$2f$message$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__message$3e$__["message"].error(`上传失败：${file.name}`);
        }
    }
    if (!uploaded.length) {
        return getCellAttachments(range);
    }
    const next = appendCellAttachments(range, uploaded);
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$antd$2f$es$2f$message$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__message$3e$__["message"].success(`已添加 ${uploaded.length} 个附件到 ${cell}`);
    return next;
};
const applyInitialAttachments = (worksheet, attachments = [])=>{
    if (!worksheet || !attachments.length) {
        return;
    }
    attachments.forEach((item)=>{
        if (!item?.cell || !item.files?.length) {
            return;
        }
        try {
            const range = worksheet.getRange(item.cell);
            setCellAttachments(range, item.files);
        } catch (error) {
            console.warn('[ETable] apply attachment failed', item, error);
        }
    });
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/UniverTable/contextMenu.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createContextMenuItem",
    ()=>createContextMenuItem,
    "createContextMenuSeparator",
    ()=>createContextMenuSeparator,
    "createContextSubmenu",
    ()=>createContextSubmenu,
    "customizeContextMenu",
    ()=>customizeContextMenu,
    "defaultContextMenuItems",
    ()=>defaultContextMenuItems
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$icons$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/UniverTable/icons.tsx [client] (ecmascript)"); // 引入注册函数
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$attachment$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/UniverTable/attachment.ts [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$antd$2f$es$2f$message$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__message$3e$__ = __turbopack_context__.i("[project]/node_modules/antd/es/message/index.js [client] (ecmascript) <export default as message>");
;
;
;
const defaultContextMenuItems = [
    {
        id: 'etable-copy',
        title: '复制内容',
        action: async ({ univerAPI })=>{
            await univerAPI.copy();
        }
    },
    {
        id: 'etable-paste',
        title: '粘贴数据',
        action: async ({ univerAPI })=>{
            await univerAPI.paste();
        }
    },
    {
        type: 'separator'
    },
    {
        id: 'etable-add-comment',
        title: '新增批注',
        icon: 'AddCommentIcon',
        action: async ({ univerAPI, range })=>{
            if (!range) {
                return;
            }
            const richText = univerAPI.newRichText().insertText('请输入批注内容');
            const comment = univerAPI.newTheadComment().setContent(richText).setPersonId('current-user').setDateTime(new Date());
            await range.addCommentAsync(comment);
        }
    },
    {
        id: 'etable-delete-comment',
        title: '删除批注',
        icon: 'DeleteCommentIcon',
        action: async ({ range })=>{
            if (!range) {
                return;
            }
            const comment = range.getComment();
            if (!comment) {
                return;
            }
            await comment.deleteAsync();
        },
        hidden: ({ range })=>{
            if (!range) {
                return true;
            }
            return !range.getComment();
        }
    },
    {
        type: 'separator'
    },
    {
        id: 'etable-add-attachment',
        title: '添加附件',
        icon: 'AttachmentIcon',
        action: async ({ range, cell, onUploadAttachment, onAttachmentsChange })=>{
            if (!range) {
                return;
            }
            const files = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$attachment$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["uploadAndAttachToCell"])({
                range,
                cell,
                onUpload: onUploadAttachment
            });
            onAttachmentsChange?.(cell, files);
        }
    },
    {
        id: 'etable-view-attachment',
        title: '查看附件',
        icon: 'AttachmentIcon',
        action: ({ range, cell })=>{
            if (!range) {
                return;
            }
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$attachment$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["showAttachmentsModal"])(cell, (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$attachment$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getCellAttachments"])(range));
        },
        hidden: ({ range })=>{
            if (!range) {
                return true;
            }
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$attachment$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getCellAttachments"])(range).length === 0;
        }
    },
    {
        id: 'etable-clear-attachment',
        title: '清空附件',
        icon: 'AttachmentIcon',
        action: ({ range, cell, onAttachmentsChange })=>{
            if (!range) {
                return;
            }
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$attachment$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["clearCellAttachments"])(range);
            onAttachmentsChange?.(cell, []);
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$antd$2f$es$2f$message$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__message$3e$__["message"].success(`已清空 ${cell} 的附件`);
        },
        hidden: ({ range })=>{
            if (!range) {
                return true;
            }
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$attachment$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getCellAttachments"])(range).length === 0;
        }
    },
    {
        type: 'separator'
    },
    {
        id: 'etable-delete-row',
        title: '删除当前行',
        action: ({ worksheet, row })=>{
            if (!worksheet || row < 0) {
                return;
            }
            worksheet.getRange(row, 0, 1, worksheet.getColumnCount()).clear();
        }
    }
];
/**
 * 获取当前选区
 */ const getCurrentSelection = (univerAPI, worksheet)=>{
    try {
        // 优先使用 Univer 当前选区
        if (univerAPI?.getActiveWorkbook) {
            const workbook = univerAPI.getActiveWorkbook();
            const activeSheet = workbook?.getActiveSheet?.();
            if (activeSheet) {
                worksheet = activeSheet;
            }
        }
        // 获取当前选择
        const selection = worksheet?.getSelection?.();
        if (!selection) {
            return {
                selection: null,
                range: null,
                row: 0,
                column: 0,
                cell: 'A1'
            };
        }
        // 获取当前 Range
        let range = null;
        try {
            range = selection.getActiveRange?.();
        } catch  {
            range = null;
        }
        /**
     * 如果当前版本没有 getActiveRange，
     * 尝试直接获取 Range
     */ if (!range) {
            try {
                range = selection.getRange?.();
            } catch  {
                range = null;
            }
        }
        let row = 0;
        let column = 0;
        try {
            row = range?.getRow?.() ?? 0;
        } catch  {
            row = 0;
        }
        try {
            column = range?.getColumn?.() ?? 0;
        } catch  {
            column = 0;
        }
        const cell = numberToColumnName(column) + String(row + 1);
        return {
            selection,
            range,
            row,
            column,
            cell
        };
    } catch (error) {
        console.warn('[ETable] get current selection failed', error);
        return {
            selection: null,
            range: null,
            row: 0,
            column: 0,
            cell: 'A1'
        };
    }
};
/**
 * 列数字转 Excel 列名
 *
 * 0  -> A
 * 1  -> B
 * 25 -> Z
 * 26 -> AA
 */ const numberToColumnName = (column)=>{
    let result = '';
    let value = column + 1;
    while(value > 0){
        const remainder = (value - 1) % 26;
        result = String.fromCharCode(65 + remainder) + result;
        value = Math.floor((value - 1) / 26);
    }
    return result;
};
/**
 * 创建菜单上下文
 */ const createMenuContext = (univerAPI, worksheet, extras)=>{
    const current = getCurrentSelection(univerAPI, worksheet);
    return {
        univerAPI,
        worksheet,
        selection: current.selection,
        range: current.range,
        row: current.row,
        column: current.column,
        cell: current.cell,
        onUploadAttachment: extras?.onUploadAttachment,
        onAttachmentsChange: extras?.onAttachmentsChange
    };
};
/**
 * 判断菜单是否隐藏
 */ const isMenuHidden = (item, context)=>{
    if (typeof item.hidden === 'function') {
        return item.hidden(context);
    }
    return item.hidden === true;
};
/**
 * 判断菜单是否禁用
 */ const isMenuDisabled = (item, context)=>{
    if (typeof item.disabled === 'function') {
        return item.disabled(context);
    }
    return item.disabled === true;
};
/**
 * 注册普通菜单
 */ const registerMenu = (univerAPI, worksheet, item, extras)=>{
    const menu = univerAPI.createMenu({
        id: item.id,
        title: item.title,
        icon: item.icon,
        action: async ()=>{
            const context = createMenuContext(univerAPI, worksheet, extras);
            // 动态判断
            if (isMenuHidden(item, context)) {
                return;
            }
            if (isMenuDisabled(item, context)) {
                return;
            }
            try {
                await item.action?.(context);
            } catch (error) {
                console.error(`[ETable] context menu "${item.id}" failed`, error);
            }
        }
    });
    /**
   * Univer Facade API 会在 appendTo 后
   * 将菜单真正添加到 UI。
   */ menu.appendTo(item.position ?? 'contextMenu.others');
    return menu;
};
/**
 * 注册子菜单
 */ const registerSubmenu = (univerAPI, worksheet, submenu, extras)=>{
    const root = univerAPI.createSubmenu({
        id: submenu.id,
        title: submenu.title
    });
    submenu.items.forEach((item)=>{
        // 1. 判断分隔线
        if ('type' in item && item.type === 'separator') {
            root.addSeparator();
            return;
        }
        // 2. 判断子菜单
        if ('type' in item && item.type === 'submenu') {
            const child = registerSubmenu(univerAPI, worksheet, item, extras);
            root.addSubmenu(child);
            return;
        }
        // 3. 普通菜单
        const menuItem = item;
        const menu = univerAPI.createMenu({
            id: menuItem.id,
            title: menuItem.title,
            icon: menuItem.icon,
            action: async ()=>{
                const context = createMenuContext(univerAPI, worksheet, extras);
                if (isMenuHidden(menuItem, context)) return;
                if (isMenuDisabled(menuItem, context)) return;
                try {
                    await menuItem.action?.(context);
                } catch (error) {
                    console.error(`[ETable] context submenu "${menuItem.id}" failed`, error);
                }
            }
        });
        root.addSubmenu(menu);
    });
    root.appendTo('contextMenu.others');
    return root;
};
const customizeContextMenu = (univerAPI, worksheet, items = defaultContextMenuItems, extras)=>{
    if (!univerAPI || !worksheet || !Array.isArray(items) || !items.length) {
        return;
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$icons$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["registerAllIcons"])(univerAPI);
    items.forEach((item)=>{
        // 分隔线
        if ('type' in item && item.type === 'separator') {
            return;
        }
        // 子菜单
        if ('type' in item && item.type === 'submenu') {
            registerSubmenu(univerAPI, worksheet, item, extras);
            return;
        }
        // 普通菜单
        registerMenu(univerAPI, worksheet, item, extras);
    });
};
const createContextMenuItem = (item)=>{
    return item;
};
const createContextMenuSeparator = ()=>{
    return {
        type: 'separator'
    };
};
const createContextSubmenu = (id, title, items)=>{
    return {
        type: 'submenu',
        id,
        title,
        items
    };
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/UniverTable/header.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "customizeColumnHeaders",
    ()=>customizeColumnHeaders,
    "getHeaderDepth",
    ()=>getHeaderDepth,
    "getLeafColumns",
    ()=>getLeafColumns
]);
const getLeafColumns = (columns)=>{
    const leaves = [];
    const traverse = (cols)=>{
        for (const col of cols){
            if (col.children && col.children.length > 0) {
                traverse(col.children);
            } else {
                leaves.push(col);
            }
        }
    };
    traverse(columns);
    return leaves;
};
const getHeaderDepth = (columns)=>{
    let max = 0;
    for (const col of columns){
        if (col.children && col.children.length > 0) {
            max = Math.max(max, getHeaderDepth(col.children));
        }
    }
    return max + 1;
};
const customizeColumnHeaders = (worksheet, columns)=>{
    if (!worksheet || !columns || !columns.length) return;
    const leafColumns = getLeafColumns(columns);
    // 1. 构造列头 Name 映射配置 { 0: "组织机构", 1: "预算项目", ... }
    const columnsCfg = {};
    leafColumns.forEach((col, index)=>{
        columnsCfg[index] = col.title;
    });
    // 2. 优先调用 Univer 原生暴露的 customizeColumnHeader 接口
    try {
        if (typeof worksheet.customizeColumnHeader === 'function') {
            worksheet.customizeColumnHeader({
                columnsCfg,
                treeSchema: columns
            });
            return;
        }
    } catch (e) {
        console.warn('[ETable] worksheet.customizeColumnHeader failed:', e);
    }
    // 3. Fallback：如果采用传统 columnsCfg 传入
    try {
        const rawCustom = worksheet.getWorkbook?.()?.getCustomColumnHeader?.();
        if (rawCustom && typeof rawCustom.setColumnTitle === 'function') {
            Object.keys(columnsCfg).forEach((colIdx)=>{
                rawCustom.setColumnTitle(Number(colIdx), columnsCfg[Number(colIdx)]);
            });
        }
    } catch (e) {
    // ignore
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/UniverTable/icons.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AddCommentIcon",
    ()=>AddCommentIcon,
    "AttachmentIcon",
    ()=>AttachmentIcon,
    "DeleteCommentIcon",
    ()=>DeleteCommentIcon,
    "registerAllIcons",
    ()=>registerAllIcons
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
/*
 * @Author: 知恩gg lichao.zhao@dxdstech.com
 * @Date: 2026-08-25 10:33:39
 * @LastEditors: 知恩gg lichao.zhao@dxdstech.com
 * @LastEditTime: 2026-08-25 17:55:00
 * @FilePath: /table/tablesResearch/src/components/UniverTable/icons.tsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$ui$2f$lib$2f$es$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@univerjs/ui/lib/es/index.js [client] (ecmascript)");
;
;
const AddCommentIcon = ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        className: "icon",
        viewBox: "0 0 1024 1024",
        version: "1.1",
        xmlns: "http://www.w3.org/2000/svg",
        width: "1em",
        height: "1em",
        fill: "currentColor",
        style: {
            verticalAlign: 'middle'
        },
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
            d: "M526.56128 168.29952a11.65312 11.65312 0 0 1 11.65312 11.65312v58.25536a11.65312 11.65312 0 0 1-11.65312 11.65312H162.47296v489.33376h107.77088v119.58272l136.0896-119.58272h449.36704V590.6432a11.65312 11.65312 0 0 1 11.65312-11.65312h58.25536a11.65312 11.65312 0 0 1 11.65312 11.65312v160.19968c0 38.6048-31.29856 69.90336-69.90336 69.90336h-430.2848l-171.01824 150.2976a46.60224 46.60224 0 0 1-64.6912-3.06176l-1.0752-1.18272a46.60736 46.60736 0 0 1-11.55584-28.88192l-0.04096-1.88416v-115.28704h-37.86752c-38.6048 0-69.90336-31.29856-69.90336-69.90336V238.20288c0-38.6048 31.29856-69.90336 69.90336-69.90336h375.73632z m-107.76576 378.65472a11.65312 11.65312 0 0 1 11.65312 11.65312v58.25536a11.65312 11.65312 0 0 1-11.65312 11.65312H226.55488a11.65312 11.65312 0 0 1-11.65312-11.65312v-58.25536a11.65312 11.65312 0 0 1 11.65312-11.65312h192.24064z m396.12416-419.4304a11.65312 11.65312 0 0 1 11.65312 11.65312l-0.00512 145.63328h145.64352a11.65312 11.65312 0 0 1 11.65312 11.65312V354.7136a11.65312 11.65312 0 0 1-11.65312 11.65312h-145.64352L826.5728 512a11.65312 11.65312 0 0 1-11.65312 11.65312h-58.25536A11.65312 11.65312 0 0 1 745.0112 512l-0.00512-145.63328h-145.62816a11.65312 11.65312 0 0 1-11.65312-11.65312V296.45824a11.65312 11.65312 0 0 1 11.65312-11.65312h145.62816l0.00512-145.63328a11.65312 11.65312 0 0 1 11.65312-11.65312h58.25536v0.00512z m-262.144 262.144a11.65312 11.65312 0 0 1 11.65312 11.65312V459.5712a11.65312 11.65312 0 0 1-11.65312 11.65312H226.55488a11.65312 11.65312 0 0 1-11.65312-11.65312V401.31584a11.65312 11.65312 0 0 1 11.65312-11.65312h326.2208z"
        }, void 0, false, {
            fileName: "[project]/src/components/UniverTable/icons.tsx",
            lineNumber: 23,
            columnNumber: 5
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/src/components/UniverTable/icons.tsx",
        lineNumber: 13,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
_c = AddCommentIcon;
const DeleteCommentIcon = (props)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        className: "icon",
        viewBox: "0 0 1024 1024",
        version: "1.1",
        xmlns: "http://www.w3.org/2000/svg",
        width: "1em",
        height: "1em",
        fill: "currentColor",
        style: {
            verticalAlign: 'middle'
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M299.885714 936.228571l-117.028571-117.028571H102.4c-43.885714 0-73.142857-29.257143-73.142857-73.142857V190.171429c0-43.885714 29.257143-73.142857 73.142857-73.142858h460.8c21.942857 0 36.571429 14.628571 36.571429 36.571429s-21.942857 36.571429-43.885715 36.571429H102.4v555.885714h109.714286l87.771428 87.771428 87.771429-87.771428h475.428571v-292.571429c0-21.942857 14.628571-36.571429 36.571429-36.571428s36.571429 14.628571 36.571428 36.571428v292.571429c0 43.885714-29.257143 73.142857-73.142857 73.142857H416.914286l-117.028572 117.028571z"
            }, void 0, false, {
                fileName: "[project]/src/components/UniverTable/icons.tsx",
                lineNumber: 41,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: "M446.171429 614.4H292.571429c-21.942857 0-36.571429-14.628571-36.571429-36.571429s14.628571-36.571429 36.571429-36.571428h153.6c21.942857 0 36.571429 14.628571 36.571428 36.571428s-14.628571 36.571429-36.571428 36.571429zM607.085714 409.6H292.571429c-21.942857 0-36.571429-14.628571-36.571429-36.571429s14.628571-36.571429 36.571429-36.571428h314.514285c21.942857 0 36.571429 14.628571 36.571429 36.571428s-14.628571 36.571429-36.571429 36.571429zM958.171429 270.628571h-292.571429c-21.942857 0-36.571429-14.628571-36.571429-36.571428s14.628571-36.571429 36.571429-36.571429h292.571429c21.942857 0 36.571429 14.628571 36.571428 36.571429s-14.628571 36.571429-36.571428 36.571428z"
            }, void 0, false, {
                fileName: "[project]/src/components/UniverTable/icons.tsx",
                lineNumber: 42,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/UniverTable/icons.tsx",
        lineNumber: 31,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
_c1 = DeleteCommentIcon;
const AttachmentIcon = ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        className: "icon",
        viewBox: "0 0 1024 1024",
        version: "1.1",
        xmlns: "http://www.w3.org/2000/svg",
        width: "1em",
        height: "1em",
        fill: "currentColor",
        style: {
            verticalAlign: 'middle'
        },
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
            d: "M704 128c-70.4 0-128 57.6-128 128v448c0 88-72 160-160 160s-160-72-160-160V256h64v448c0 52.8 43.2 96 96 96s96-43.2 96-96V256c0-88 72-160 160-160s160 72 160 160v480c0 123.2-100.8 224-224 224s-224-100.8-224-224V320h64v416c0 88 72 160 160 160s160-72 160-160V256c0-70.4-57.6-128-128-128z"
        }, void 0, false, {
            fileName: "[project]/src/components/UniverTable/icons.tsx",
            lineNumber: 58,
            columnNumber: 5
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/src/components/UniverTable/icons.tsx",
        lineNumber: 48,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
_c2 = AttachmentIcon;
const registerAllIcons = (univerAPI)=>{
    if (!univerAPI) return;
    try {
        // 途径 1: Facade API 自带注册 (部分 0.2.x+ 支持)
        if (typeof univerAPI.registerIcon === 'function') {
            univerAPI.registerIcon('AddCommentIcon', AddCommentIcon);
            univerAPI.registerIcon('DeleteCommentIcon', DeleteCommentIcon);
            univerAPI.registerIcon('AttachmentIcon', AttachmentIcon);
            return;
        }
        // 途径 2: 深度获取 UI 层的 ComponentManager
        const injector = univerAPI.__getInjector?.() || univerAPI.getGlobalContext?.()?.injector || univerAPI._injector;
        if (injector) {
            const componentManager = injector.get(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$ui$2f$lib$2f$es$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["ComponentManager"]);
            if (componentManager) {
                componentManager.register('AddCommentIcon', AddCommentIcon);
                componentManager.register('DeleteCommentIcon', DeleteCommentIcon);
                componentManager.register('AttachmentIcon', AttachmentIcon);
                console.log('[ETable] Icon registered via ComponentManager');
            } else {
                console.warn('[ETable] ComponentManager not found in injector');
            }
        }
    } catch (error) {
        console.error('[ETable] Failed to register icons:', error);
    }
};
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "AddCommentIcon");
__turbopack_context__.k.register(_c1, "DeleteCommentIcon");
__turbopack_context__.k.register(_c2, "AttachmentIcon");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/UniverTable/index.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "buildTreeColumnGroups",
    ()=>(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$tree$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ ?? __turbopack_context__.i("[project]/src/components/UniverTable/tree.ts [client] (ecmascript)"))["buildTreeColumnGroups"],
    "buildTreeColumns",
    ()=>(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$tree$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ ?? __turbopack_context__.i("[project]/src/components/UniverTable/tree.ts [client] (ecmascript)"))["buildTreeColumns"],
    "default",
    ()=>(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$index$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ ?? __turbopack_context__.i("[project]/src/components/UniverTable/index.tsx [client] (ecmascript) <locals>"))["default"],
    "flattenTreeData",
    ()=>(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$tree$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ ?? __turbopack_context__.i("[project]/src/components/UniverTable/tree.ts [client] (ecmascript)"))["flattenTreeData"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$index$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/src/components/UniverTable/index.tsx [client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$tree$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/UniverTable/tree.ts [client] (ecmascript)");
}),
"[project]/src/components/UniverTable/index.tsx [client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$presets$2f$lib$2f$es$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@univerjs/presets/lib/es/index.js [client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$core$2f$lib$2f$es$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@univerjs/core/lib/es/index.js [client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$preset$2d$sheets$2d$advanced$2f$lib$2f$es$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@univerjs/preset-sheets-advanced/lib/es/index.js [client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$preset$2d$sheets$2d$core$2f$lib$2f$es$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@univerjs/preset-sheets-core/lib/es/index.js [client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$preset$2d$sheets$2d$thread$2d$comment$2f$lib$2f$es$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@univerjs/preset-sheets-thread-comment/lib/es/index.js [client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$preset$2d$sheets$2d$note$2f$lib$2f$es$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@univerjs/preset-sheets-note/lib/es/index.js [client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$outline$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/UniverTable/outline.ts [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$renderer$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/UniverTable/renderer.ts [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$tree$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/UniverTable/tree.ts [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$contextMenu$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/UniverTable/contextMenu.ts [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$attachment$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/UniverTable/attachment.ts [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$icons$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/UniverTable/icons.tsx [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$header$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/UniverTable/header.tsx [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$preset$2d$sheets$2d$thread$2d$comment$2f$lib$2f$es$2f$locales$2f$zh$2d$CN$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@univerjs/preset-sheets-thread-comment/lib/es/locales/zh-CN.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$preset$2d$sheets$2d$advanced$2f$lib$2f$es$2f$locales$2f$zh$2d$CN$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@univerjs/preset-sheets-advanced/lib/es/locales/zh-CN.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$preset$2d$sheets$2d$core$2f$lib$2f$es$2f$locales$2f$zh$2d$CN$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@univerjs/preset-sheets-core/lib/es/locales/zh-CN.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$preset$2d$sheets$2d$note$2f$lib$2f$es$2f$locales$2f$zh$2d$CN$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@univerjs/preset-sheets-note/lib/es/locales/zh-CN.js [client] (ecmascript)");
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
;
;
/**
* Table
*
* 基于 Univer 封装的通用电子表格组件。
*
* =========================================================
* 已有功能
* =========================================================
*
* 1. 多级表头
* 2. 自定义原生列头
* 3. 自定义列宽
* 4. 自定义行高
* 5. 表格数据
* 6. 单元格合并
* 7. 行分组
* 8. 列分组
* 9. 行冻结
* 10. 列冻结
* 11. 网格线控制
* 12. 单元格批注
* 13. Univer API 暴露
* 14. 树形数据 + 属性层折叠（treeData）
* 15. 列分组折叠（columnGroups / treeConfig.columnGroups）
* 16. 单元格附件
*/ const Table = /*#__PURE__*/ _s((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["forwardRef"])(_c = _s((props, ref)=>{
    _s();
    // 取组件参数
    const { columns: propsColumns = [], rows: propsRows = [], merges: propsMerges = [], rowGroups: propsRowGroups = [], columnGroups: propsColumnGroups = [], treeData, treeConfig, options = {}, comments = [], attachments = [], onUploadAttachment, onAttachmentsChange, onReady } = props;
    const onUploadAttachmentRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRef"])(onUploadAttachment);
    const onAttachmentsChangeRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRef"])(onAttachmentsChange);
    onUploadAttachmentRef.current = onUploadAttachment;
    onAttachmentsChangeRef.current = onAttachmentsChange;
    /**
   * 优先使用 treeData 自动展平；
   * 否则回退到外部传入的 columns / rows / merges / rowGroups / columnGroups。
   */ const flattened = treeData && treeConfig ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$tree$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["flattenTreeData"])(treeData, treeConfig) : null;
    const columns = flattened?.columns ?? propsColumns;
    const rows = flattened?.rows ?? propsRows;
    const merges = flattened?.merges ?? propsMerges;
    const rowGroups = flattened?.rowGroups ?? propsRowGroups;
    const columnGroups = flattened?.columnGroups?.length ? flattened.columnGroups : propsColumnGroups;
    // 表格基础配置
    const { name = 'Table', // 默认列宽
    defaultColumnWidth = 110, // 默认行高
    defaultRowHeight = 30, // 是否显示网格线
    showGridLines = true, // 冻结行数量
    freezeRows, // 冻结列数量
    freezeColumns, // 是否自定义 Univer 原生列头
    customizeColumnHeader = true, // 扩展选项：自定义右键菜单项（不传则使用默认的 defaultContextMenuItems）
    contextMenuItems = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$contextMenu$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["defaultContextMenuItems"], // 扩展选项：是否启用自定义右键菜单
    enableContextMenu = true } = options;
    // Univer DOM 容器
    const containerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    // Univer API
    const univerAPIRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    // Workbook
    const workbookRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    // Worksheet
    const worksheetRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    //  对外暴露API
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useImperativeHandle"])(ref, ()=>({
            // Univer API
            getUniverAPI () {
                return univerAPIRef.current;
            },
            // Workbook
            getWorkbook () {
                return workbookRef.current;
            },
            // Worksheet
            getWorksheet () {
                return worksheetRef.current;
            },
            // 行分组
            getRowOutlines () {
                const worksheet = worksheetRef.current;
                if (!worksheet) {
                    return [];
                }
                ;
                return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$outline$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getRowOutlines"])(worksheet);
            },
            // 折叠指定行分组
            collapseRowGroup (id) {
                const worksheet = worksheetRef.current;
                if (!worksheet) {
                    return;
                }
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$outline$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setOutlineCollapsed"])(worksheet, id, true);
            },
            // 展开指定行分组
            expandRowGroup (id) {
                const worksheet = worksheetRef.current;
                if (!worksheet) {
                    return;
                }
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$outline$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setOutlineCollapsed"])(worksheet, id, false);
            },
            // 一次性折叠所有行分组
            collapseAllRows () {
                const worksheet = worksheetRef.current;
                if (!worksheet) {
                    return;
                }
                const groups = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$outline$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getRowOutlines"])(worksheet);
                groups.forEach((group)=>{
                    worksheet.setDimensionOutlineCollapsed(group.id, true);
                });
            },
            // 一次性展开所有行分组
            expandAllRows () {
                const worksheet = worksheetRef.current;
                if (!worksheet) {
                    return;
                }
                const groups = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$outline$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getRowOutlines"])(worksheet);
                groups.forEach((group)=>{
                    worksheet.setDimensionOutlineCollapsed(group.id, false);
                });
            },
            // 列分组
            getColumnOutlines () {
                const worksheet = worksheetRef.current;
                if (!worksheet) {
                    return [];
                }
                return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$outline$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getColumnOutlines"])(worksheet);
            },
            // 折叠指定列分组
            collapseColumnGroup (id) {
                const worksheet = worksheetRef.current;
                if (!worksheet) {
                    return;
                }
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$outline$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setOutlineCollapsed"])(worksheet, id, true);
            },
            // 展开指定列分组
            expandColumnGroup (id) {
                const worksheet = worksheetRef.current;
                if (!worksheet) {
                    return;
                }
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$outline$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setOutlineCollapsed"])(worksheet, id, false);
            },
            // 一次性折叠所有列分组
            collapseAllColumns () {
                const worksheet = worksheetRef.current;
                if (!worksheet) {
                    return;
                }
                const groups = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$outline$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getColumnOutlines"])(worksheet);
                groups.forEach((group)=>{
                    worksheet.setDimensionOutlineCollapsed(group.id, true);
                });
            },
            // 一次性展开所有列分组
            expandAllColumns () {
                const worksheet = worksheetRef.current;
                if (!worksheet) {
                    return;
                }
                const groups = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$outline$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getColumnOutlines"])(worksheet);
                groups.forEach((group)=>{
                    worksheet.setDimensionOutlineCollapsed(group.id, false);
                });
            },
            // 批注
            async addComment (cell, content, userId = 'current-user') {
                const univerAPI = univerAPIRef.current;
                const worksheet = worksheetRef.current;
                if (!univerAPI || !worksheet) {
                    return null;
                }
                // 创建富文本
                const richText = univerAPI.newRichText().insertText(content);
                // 创建 Thread Comment
                const commentBuilder = univerAPI.newTheadComment().setContent(richText).setPersonId(userId).setDateTime(new Date());
                // 获取单元格
                const range = worksheet.getRange(cell);
                // 添加批注
                return range.addCommentAsync(commentBuilder);
            },
            // 获取全部单元格批注
            getComments () {
                const worksheet = worksheetRef.current;
                if (!worksheet) {
                    return [];
                }
                return worksheet.getComments();
            },
            // 获取指定单元格的批注
            getComment (cell) {
                const worksheet = worksheetRef.current;
                if (!worksheet) {
                    return null;
                }
                return worksheet.getRange(cell).getComment();
            },
            // 删除指定单元格的批注
            async deleteComment (cell) {
                const worksheet = worksheetRef.current;
                if (!worksheet) {
                    return false;
                }
                const comment = worksheet.getRange(cell).getComment();
                if (!comment) {
                    return false;
                }
                return comment.deleteAsync();
            },
            // 删除当前 Worksheet中的全部批注
            async clearComments () {
                const worksheet = worksheetRef.current;
                if (!worksheet) {
                    return;
                }
                const comments = worksheet.getComments();
                await Promise.all(comments.map((comment)=>comment.deleteAsync()));
            },
            // 添加附件（弹文件选择）
            async addAttachment (cell) {
                const worksheet = worksheetRef.current;
                if (!worksheet || !cell) {
                    return [];
                }
                const range = worksheet.getRange(cell);
                const files = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$attachment$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["uploadAndAttachToCell"])({
                    range,
                    cell,
                    onUpload: onUploadAttachmentRef.current
                });
                onAttachmentsChangeRef.current?.(cell, files);
                return files;
            },
            // 设置附件列表
            setAttachments (cell, files) {
                const worksheet = worksheetRef.current;
                if (!worksheet || !cell) {
                    return;
                }
                const range = worksheet.getRange(cell);
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$attachment$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["setCellAttachments"])(range, files || []);
                onAttachmentsChangeRef.current?.(cell, files || []);
            },
            // 获取附件
            getAttachments (cell) {
                const worksheet = worksheetRef.current;
                if (!worksheet || !cell) {
                    return [];
                }
                return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$attachment$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getCellAttachments"])(worksheet.getRange(cell));
            },
            // 删除单个附件
            removeAttachment (cell, attachmentId) {
                const worksheet = worksheetRef.current;
                if (!worksheet || !cell) {
                    return [];
                }
                const next = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$attachment$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["removeCellAttachment"])(worksheet.getRange(cell), attachmentId);
                onAttachmentsChangeRef.current?.(cell, next);
                return next;
            },
            // 清空附件
            clearAttachments (cell) {
                const worksheet = worksheetRef.current;
                if (!worksheet || !cell) {
                    return;
                }
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$attachment$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["clearCellAttachments"])(worksheet.getRange(cell));
                onAttachmentsChangeRef.current?.(cell, []);
            },
            // 查看附件弹窗
            viewAttachments (cell) {
                const worksheet = worksheetRef.current;
                if (!worksheet || !cell) {
                    return;
                }
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$attachment$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["showAttachmentsModal"])(cell, (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$attachment$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getCellAttachments"])(worksheet.getRange(cell)));
            }
        }), []);
    // 初始化 Univer
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        // 没有 DOM 容器，不初始化
        if (!containerRef.current) {
            return;
        }
        // 防止重复初始化
        if (univerAPIRef.current) {
            return;
        }
        // 创建 Univer
        const { univerAPI } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$presets$2f$lib$2f$es$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createUniver"])({
            // 中文
            locale: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$core$2f$lib$2f$es$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["LocaleType"].ZH_CN,
            // 中文语言包
            locales: {
                [__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$core$2f$lib$2f$es$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["LocaleType"].ZH_CN]: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$core$2f$lib$2f$es$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["mergeLocales"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$preset$2d$sheets$2d$core$2f$lib$2f$es$2f$locales$2f$zh$2d$CN$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"], __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$preset$2d$sheets$2d$advanced$2f$lib$2f$es$2f$locales$2f$zh$2d$CN$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"], __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$preset$2d$sheets$2d$thread$2d$comment$2f$lib$2f$es$2f$locales$2f$zh$2d$CN$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"], __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$preset$2d$sheets$2d$note$2f$lib$2f$es$2f$locales$2f$zh$2d$CN$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"])
            },
            // Preset
            presets: [
                // Core
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$preset$2d$sheets$2d$core$2f$lib$2f$es$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["UniverSheetsCorePreset"])({
                    container: containerRef.current
                }),
                // Advanced
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$preset$2d$sheets$2d$advanced$2f$lib$2f$es$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["UniverSheetsAdvancedPreset"])(),
                // Thread Comment
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$preset$2d$sheets$2d$thread$2d$comment$2f$lib$2f$es$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["UniverSheetsThreadCommentPreset"])(),
                // Note（附件角标）
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$univerjs$2f$preset$2d$sheets$2d$note$2f$lib$2f$es$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["UniverSheetsNotePreset"])()
            ]
        });
        // 保存 Univer API
        univerAPIRef.current = univerAPI;
        // 创建 Workbook
        const workbook = univerAPI.createWorkbook({
            name
        });
        workbookRef.current = workbook;
        // 获取 Worksheet
        const worksheet = workbook.getActiveSheet();
        if (!worksheet) {
            return;
        }
        worksheetRef.current = worksheet;
        // 1. 网格线
        worksheet.setHiddenGridlines(!showGridLines);
        // 2. 渲染业务多级表头
        const { leafColumns, maxDepth } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$renderer$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["renderHeader"])(worksheet, columns);
        // 3. ⭐ 自定义 Univer 原生列头
        if (customizeColumnHeader && leafColumns.length) {
            const columnsCfg = {};
            leafColumns.forEach((column, index)=>{
                columnsCfg[index] = column.title;
            });
            // 延迟到当前渲染完成后执行。
            requestAnimationFrame(()=>{
                try {
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$header$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["customizeColumnHeaders"])(worksheet, leafColumns);
                } catch (error) {
                    console.warn('[Table] customize column header failed', error);
                    // 兼容当前代码。如果当前版本的 Worksheet直接支持 customizeColumnHeader，则继续使用原生 API。
                    try {
                        worksheet.customizeColumnHeader?.({
                            columnsCfg
                        });
                    } catch (fallbackError) {
                        console.warn('[Table] fallback customize column header failed', fallbackError);
                    }
                }
            });
        }
        // 4. 设置列宽
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$renderer$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["renderColumnWidths"])(worksheet, leafColumns, defaultColumnWidth);
        // 5. 设置表头行高
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$renderer$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["renderRowHeights"])(worksheet, 0, maxDepth, defaultRowHeight);
        // 6. 渲染数据
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$renderer$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["renderData"])(worksheet, rows, leafColumns, maxDepth);
        // 7. 设置数据行高
        if (rows.length) {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$renderer$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["renderRowHeights"])(worksheet, maxDepth, rows.length, defaultRowHeight);
        }
        // 8. 自定义合并（row 相对于数据区，需加上表头深度）
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$renderer$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["renderMerges"])(worksheet, merges, maxDepth);
        // 9. 行分组
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$outline$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["createRowOutlines"])(worksheet, rowGroups, maxDepth);
        // 10. 列分组
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$outline$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["createColumnOutlines"])(worksheet, columnGroups);
        // 11. 冻结行
        if (typeof freezeRows === 'number') {
            worksheet.setFrozenRows(freezeRows);
        } else if (maxDepth > 0) {
            worksheet.setFrozenRows(maxDepth);
        }
        // 12. 冻结列
        if (typeof freezeColumns === 'number') {
            worksheet.setFrozenColumns(freezeColumns);
        }
        // 13. 初始化批注
        if (comments.length) {
            Promise.all(comments.map(async (comment)=>{
                try {
                    const { cell, content, userId = 'current-user', dateTime, id, threadId } = comment;
                    // 没有单元格或者内容  直接跳过
                    if (!cell || !content) {
                        return;
                    }
                    // 创建富文本
                    const richText = univerAPI.newRichText().insertText(content);
                    // 创建批注
                    let builder = univerAPI.newTheadComment().setContent(richText).setPersonId(userId).setDateTime(dateTime ? new Date(dateTime) : new Date());
                    // 设置批注 ID
                    if (id) {
                        builder = builder.setId(id);
                    }
                    // 设置 Thread ID
                    if (threadId) {
                        builder = builder.setThreadId(threadId);
                    }
                    // 获取单元格
                    const range = worksheet.getRange(cell);
                    // 添加批注
                    await range.addCommentAsync(builder);
                } catch (error) {
                    console.warn('[Table] add comment failed', error);
                }
            }));
        }
        // 13.4 初始化附件
        try {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$attachment$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["applyInitialAttachments"])(worksheet, attachments);
        } catch (error) {
            console.warn('[Table] apply attachments failed', error);
        }
        // 13.5 注册自定义右键菜单
        if (enableContextMenu && contextMenuItems && contextMenuItems.length) {
            try {
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$contextMenu$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["customizeContextMenu"])(univerAPI, worksheet, contextMenuItems, {
                    onUploadAttachment: async (file, cell)=>{
                        if (onUploadAttachmentRef.current) {
                            return onUploadAttachmentRef.current(file, cell);
                        }
                        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$attachment$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["defaultUploadAttachment"])(file);
                    },
                    onAttachmentsChange: (cell, files)=>{
                        onAttachmentsChangeRef.current?.(cell, files);
                    }
                });
            } catch (error) {
                console.warn('[Table] register context menu failed', error);
            }
        }
        // 14. 初始化完成
        onReady?.({
            univerAPI,
            workbook,
            worksheet
        });
        // 15. 销毁
        return ()=>{
            try {
                univerAPI.dispose();
            } catch (error) {
                console.warn('[Table] dispose failed', error);
            }
            univerAPIRef.current = null;
            workbookRef.current = null;
            worksheetRef.current = null;
        };
    }, []);
    // 注册icon图标
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const univerAPI = univerAPIRef.current;
        const worksheet = worksheetRef.current;
        if (univerAPI && worksheet) {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$icons$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["registerAllIcons"])(univerAPI);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$contextMenu$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["customizeContextMenu"])(univerAPI, worksheet, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$contextMenu$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["defaultContextMenuItems"], {
                onUploadAttachment: async (file, cell)=>{
                    if (onUploadAttachmentRef.current) {
                        return onUploadAttachmentRef.current(file, cell);
                    }
                    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$attachment$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["defaultUploadAttachment"])(file);
                },
                onAttachmentsChange: (cell, files)=>{
                    onAttachmentsChangeRef.current?.(cell, files);
                }
            });
        }
    }, [
        univerAPIRef.current,
        worksheetRef.current
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        style: {
            width: '100%',
            height: '100%',
            minHeight: 600
        },
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            ref: containerRef,
            style: {
                width: '100%',
                height: '100%'
            }
        }, void 0, false, {
            fileName: "[project]/src/components/UniverTable/index.tsx",
            lineNumber: 547,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/src/components/UniverTable/index.tsx",
        lineNumber: 546,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
}, "7O/9sVnuJzB0AMOjER6UxrS1l9M=")), "7O/9sVnuJzB0AMOjER6UxrS1l9M=");
_c1 = Table;
Table.displayName = 'Table';
;
var __TURBOPACK__default__export__ = Table;
var _c, _c1;
__turbopack_context__.k.register(_c, "Table$forwardRef");
__turbopack_context__.k.register(_c1, "Table");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/UniverTable/layout.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "buildHeaderLayout",
    ()=>buildHeaderLayout
]);
/**
 * =========================================================
 * 获取最大表头深度
 * =========================================================
 *
 * 例如：
 *
 * 2026年度预算
 *   └── 上半年
 *       └── 第一季度
 *           └── 1月
 *
 * 深度：
 *
 * 2026年度预算 = 1
 * 上半年       = 2
 * 第一季度     = 3
 * 1月          = 4
 *
 * 最终 maxDepth = 4
 */ const getMaxDepth = (columns)=>{
    if (!columns.length) {
        return 0;
    }
    const getDepth = (column)=>{
        if (!column.children?.length) {
            return 1;
        }
        return 1 + Math.max(...column.children.map(getDepth));
    };
    return Math.max(...columns.map(getDepth));
};
/**
 * =========================================================
 * 获取叶子列数量
 * =========================================================
 *
 * 一个没有 children 的列，
 * 就是一个真正的数据列。
 *
 * 例如：
 *
 * 第一季度
 * ├── 1月
 * ├── 2月
 * └── 3月
 *
 * 第一季度的 leafCount = 3
 */ const getLeafCount = (column)=>{
    if (!column.children?.length) {
        return 1;
    }
    return column.children.reduce((total, child)=>{
        return total + getLeafCount(child);
    }, 0);
};
const buildHeaderLayout = (columns = [])=>{
    // 没有配置列
    if (!columns.length) {
        return {
            layouts: [],
            leafColumns: [],
            maxDepth: 0
        };
    }
    // 最大深度。
    const maxDepth = getMaxDepth(columns);
    // 所有叶子列
    const leafColumns = [];
    // 最终布局。
    const layouts = [];
    /**
   * 当前叶子列位置。
   *
   * 例如：
   *
   * 组织机构 = 0
   * 预算项目 = 1
   * 费用科目 = 2
   * 1月       = 3
   * 2月       = 4
   * ...
   */ let currentColumn = 0;
    /**
   * =======================================================
   * 递归处理列
   * =======================================================
   */ const walk = (column, depth)=>{
        /**
     * 当前节点所在行。
     *
     * depth 从 0 开始。
     */ const startRow = depth;
        /**
     * -----------------------------------------------------
     * 叶子节点
     * -----------------------------------------------------
     *
     * 例如：
     *
     * 组织机构
     * 预算项目
     * 费用科目
     * 1月
     * 2月
     *
     * 没有 children。
     */ if (!column.children?.length) {
            const startColumn = currentColumn;
            //  叶子列
            leafColumns.push(column);
            /**
       * ⭐ 关键：
       *
       * 叶子节点需要纵向合并到最大深度。
       *
       * 例如：
       *
       * maxDepth = 4
       *
       * 组织机构：
       *
       * row 0
       * row 1
       * row 2
       * row 3
       *
       * rowSpan = 4
       */ const rowSpan = maxDepth - depth;
            layouts.push({
                title: column.title,
                startRow,
                startColumn,
                rowSpan,
                columnSpan: 1,
                column
            });
            // 下一列
            currentColumn += 1;
            return;
        }
        /**
     * -----------------------------------------------------
     * 父节点
     * -----------------------------------------------------
     *
     * 例如：
     *
     * 2026年度预算
     *
     * children：
     *
     * 上半年
     * 下半年
     */ const startColumn = currentColumn;
        /**
     * 当前节点下面有多少个叶子列。
     *
     * 2026年度预算：
     *
     * 12
     *
     * 上半年：
     *
     * 6
     *
     * 第一季度：
     *
     * 3
     */ const columnSpan = getLeafCount(column);
        /**
     * 当前父节点先记录下来。
     *
     * children 后面再递归。
     */ layouts.push({
            title: column.title,
            startRow,
            startColumn,
            rowSpan: 1,
            columnSpan,
            column
        });
        /**
     * 递归处理子节点。
     */ column.children.forEach((child)=>{
            walk(child, depth + 1);
        });
    };
    /**
   * 从根节点开始。
   */ columns.forEach((column)=>{
        walk(column, 0);
    });
    return {
        layouts,
        leafColumns,
        maxDepth
    };
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/UniverTable/outline.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createColumnOutlines",
    ()=>createColumnOutlines,
    "createRowOutlines",
    ()=>createRowOutlines,
    "getColumnOutlines",
    ()=>getColumnOutlines,
    "getRowOutlines",
    ()=>getRowOutlines,
    "setOutlineCollapsed",
    ()=>setOutlineCollapsed
]);
const createRowOutlines = (worksheet, groups = [], dataStartRow)=>{
    groups.forEach((group)=>{
        /**
     * 无效分组直接跳过。
     */ if (group.count <= 0) {
            return;
        }
        try {
            /**
       * 创建 Univer 原生行大纲。
       *
       * start：
       * 分组开始行。
       *
       * count：
       * 分组包含的行数。
       */ const outline = worksheet.addRowOutline(dataStartRow + group.startRow, group.count);
            /**
       * 如果配置了 collapsed，
       * 则在创建完成后将当前分组设置为折叠状态。
       */ if (group.collapsed) {
                const outlines = worksheet.getDimensionOutlines('row');
                const target = outlines?.find((item)=>item.start === dataStartRow + group.startRow && item.end === dataStartRow + group.startRow + group.count - 1);
                if (target) {
                    worksheet.setDimensionOutlineCollapsed(target.id, true);
                }
            }
        } catch (error) {
            /**
       * 单个分组创建失败时不影响其他分组继续创建。
       */ console.error('[ETable] create row outline failed', group, error);
        }
        /**
     * 递归创建子行分组。
     *
     * 通过递归支持多层嵌套的行分组结构。
     */ if (group.children?.length) {
            createRowOutlines(worksheet, group.children, dataStartRow);
        }
    });
};
const createColumnOutlines = (worksheet, groups = [])=>{
    groups.forEach((group)=>{
        /**
     * 无效分组直接跳过。
     */ if (group.count <= 0) {
            return;
        }
        try {
            /**
       * 创建 Univer 原生列大纲。
       *
       * startColumn：
       * 分组开始列。
       *
       * count：
       * 分组包含的列数。
       */ worksheet.addColumnOutline(group.startColumn, group.count);
            /**
       * 初始化列分组折叠状态。
       */ if (group.collapsed) {
                const outlines = worksheet.getDimensionOutlines('column');
                const target = outlines?.find((item)=>item.start === group.startColumn && item.end === group.startColumn + group.count - 1);
                if (target) {
                    worksheet.setDimensionOutlineCollapsed(target.id, true);
                }
            }
        } catch (error) {
            /**
       * 单个列分组创建失败时不影响其他分组。
       */ console.error('[ETable] create column outline failed', group, error);
        }
        /**
     * 递归创建子列分组。
     */ if (group.children?.length) {
            createColumnOutlines(worksheet, group.children);
        }
    });
};
const getRowOutlines = (worksheet)=>{
    return worksheet.getDimensionOutlines('row') || [];
};
const getColumnOutlines = (worksheet)=>{
    return worksheet.getDimensionOutlines('column') || [];
};
const setOutlineCollapsed = (worksheet, id, collapsed)=>{
    worksheet.setDimensionOutlineCollapsed(id, collapsed);
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/UniverTable/renderer.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "columnIndexToLetter",
    ()=>columnIndexToLetter,
    "flattenColumns",
    ()=>flattenColumns,
    "renderColumnWidths",
    ()=>renderColumnWidths,
    "renderData",
    ()=>renderData,
    "renderHeader",
    ()=>renderHeader,
    "renderMerges",
    ()=>renderMerges,
    "renderRowHeights",
    ()=>renderRowHeights
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$layout$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/UniverTable/layout.ts [client] (ecmascript)");
;
const renderHeader = (worksheet, columns = [])=>{
    /**
   * 没有列配置时直接返回。
   */ if (!worksheet || !columns.length) {
        return {
            leafColumns: [],
            maxDepth: 0
        };
    }
    /**
   * -------------------------------------------------------
   * 统一通过 layout.ts 计算布局
   * -------------------------------------------------------
   *
   * layout.ts 应负责计算：
   *
   * startRow
   * startColumn
   * rowSpan
   * columnSpan
   * title
   *
   * 特别是：
   *
   * 组织机构
   * 预算项目
   * 费用科目
   *
   * 这种没有 children 的叶子节点，
   * 应该由 layout.ts 自动计算：
   *
   * rowSpan = maxDepth
   */ const { layouts, leafColumns, maxDepth } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$layout$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["buildHeaderLayout"])(columns);
    // 写入表头
    layouts.forEach((item)=>{
        // 防止非法布局数据影响整个表格。
        if (item.startRow < 0 || item.startColumn < 0 || item.rowSpan <= 0 || item.columnSpan <= 0) {
            return;
        }
        // 获取当前表头区域。
        const range = worksheet.getRange(item.startRow, item.startColumn, item.rowSpan, item.columnSpan);
        // 写入标题。
        range.setValue(item.title);
        /**
     * -----------------------------------------------------
     * 执行表头合并
     * -----------------------------------------------------
     *
     * 例如：
     *
     * 2026年度预算
     * ├── 上半年
     * └── 下半年
     *
     * 需要横向合并。
     *
     * 而：
     *
     * 组织机构
     *
     * 需要纵向合并。
     */ if (item.rowSpan > 1 || item.columnSpan > 1) {
            try {
                range.merge();
            } catch (error) {
                /**
         * 单个表头合并失败，
         * 不影响其他表头。
         */ console.warn('[ETable] header merge failed', {
                    item,
                    error
                });
            }
        }
    });
    return {
        leafColumns,
        maxDepth
    };
};
const renderData = (worksheet, rows = [], leafColumns = [], startRow)=>{
    /**
   * 没有数据或者没有叶子列，
   * 不执行任何操作。
   */ if (!worksheet || !rows.length || !leafColumns.length) {
        return;
    }
    /**
   * 防止传入非法起始行。
   */ if (startRow < 0) {
        return;
    }
    /**
   * -------------------------------------------------------
   * 转换为二维数组
   * -------------------------------------------------------
   *
   * Univer：
   *
   * range.setValues([
   *   [...],
   *   [...],
   * ]);
   *
   * 因此先按照叶子列顺序生成二维数组。
   */ const values = rows.map((row)=>{
        return leafColumns.map((column)=>{
            const cell = row.data?.[column.id];
            // 兼容对象类型数据
            if (cell !== null && typeof cell === 'object') {
                return cell.value ?? null;
            }
            // undefined 统一转换成 null。
            return cell ?? null;
        });
    });
    // 批量写入 不逐个单元格 setValue，避免大量 API 调用。
    worksheet.getRange(startRow, 0, values.length, leafColumns.length).setValues(values);
    //  设置单独行高
    rows.forEach((row, index)=>{
        if (typeof row.height === 'number') {
            worksheet.setRowHeight(startRow + index, row.height);
        }
    });
};
const renderColumnWidths = (worksheet, leafColumns = [], defaultWidth = 110)=>{
    if (!worksheet || !leafColumns.length) {
        return;
    }
    leafColumns.forEach((column, index)=>{
        const width = typeof column.width === 'number' ? column.width : defaultWidth;
        // 防止非法列宽。
        if (width <= 0) {
            return;
        }
        worksheet.setColumnWidth(index, width);
    });
};
const renderRowHeights = (worksheet, startRow, count, height)=>{
    if (!worksheet || count <= 0 || height <= 0) {
        return;
    }
    worksheet.setRowHeights(startRow, count, height);
};
const renderMerges = (worksheet, merges = [], dataStartRow = 0)=>{
    if (!worksheet || !merges.length) {
        return;
    }
    merges.forEach((merge)=>{
        // 参数校验
        if (merge.row < 0 || merge.column < 0 || merge.rowSpan <= 0 || merge.columnSpan <= 0) {
            return;
        }
        const startRow = dataStartRow + merge.row;
        // 获取区域。
        const range = worksheet.getRange(startRow, merge.column, merge.rowSpan, merge.columnSpan);
        // 如果配置了 value，先写入左上角。
        if (merge.value !== undefined) {
            range.setValue(merge.value);
        }
        // 单个单元格无需 merge。
        if (merge.rowSpan === 1 && merge.columnSpan === 1) {
            return;
        }
        // 执行合并。
        try {
            range.merge();
        } catch (error) {
            console.warn('[ETable] custom merge failed', {
                merge,
                error
            });
        }
    });
};
const columnIndexToLetter = (index)=>{
    // 非法索引直接返回空字符串。
    if (!Number.isInteger(index) || index < 0) {
        return '';
    }
    let result = '';
    let current = index;
    while(current >= 0){
        result = String.fromCharCode(current % 26 + 65) + result;
        current = Math.floor(current / 26) - 1;
    }
    return result;
};
const flattenColumns = (columns = [])=>{
    if (!columns.length) {
        return [];
    }
    const result = [];
    // 递归遍历列树。
    const walk = (items)=>{
        items.forEach((column)=>{
            // 有子节点：继续向下。
            if (column.children?.length) {
                walk(column.children);
                return;
            }
            // 没有子节点：当前节点就是叶子列。
            result.push(column);
        });
    };
    walk(columns);
    return result;
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/UniverTable/tree.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "buildTreeColumnGroups",
    ()=>buildTreeColumnGroups,
    "buildTreeColumns",
    ()=>buildTreeColumns,
    "flattenTreeData",
    ()=>flattenTreeData
]);
const buildTreeColumns = (config)=>{
    return [
        ...config.dimensions.map((item)=>({
                id: item.field,
                title: item.title,
                width: item.width
            })),
        {
            id: config.attribute.field,
            title: config.attribute.title,
            width: config.attribute.width
        },
        ...config.measures.map((item)=>({
                id: item.field,
                title: item.title,
                width: item.width
            }))
    ];
};
const buildTreeColumnGroups = (groups = [], fieldColumnIndex)=>{
    const result = [];
    groups.forEach((group)=>{
        const indices = group.fields.map((field)=>fieldColumnIndex.get(field)).filter((index)=>typeof index === 'number');
        if (!indices.length) {
            console.warn('[ETable] column group fields not found', group);
            return;
        }
        const startColumn = Math.min(...indices);
        const endColumn = Math.max(...indices);
        const count = endColumn - startColumn + 1;
        if (count <= 0) {
            return;
        }
        result.push({
            id: group.id,
            startColumn,
            count,
            collapsed: group.collapsed,
            children: group.children?.length ? buildTreeColumnGroups(group.children, fieldColumnIndex) : undefined
        });
    });
    return result;
};
const flattenTreeData = (treeData = [], config)=>{
    const columns = buildTreeColumns(config);
    const rows = [];
    const rowGroups = [];
    const merges = [];
    const labelMode = config.labelMode ?? 'single';
    const dimensionFields = config.dimensions.map((item)=>item.field);
    const attributeField = config.attribute.field;
    const fieldColumnIndex = new Map();
    columns.forEach((column, index)=>{
        fieldColumnIndex.set(column.id, index);
    });
    const columnGroups = buildTreeColumnGroups(config.columnGroups ?? [], fieldColumnIndex);
    let currentRow = 0;
    const getLabelField = (depth)=>{
        if (!dimensionFields.length) {
            return undefined;
        }
        if (labelMode === 'single') {
            return dimensionFields[0];
        }
        return dimensionFields[Math.min(depth, dimensionFields.length - 1)];
    };
    const pushMerge = (field, startRow, count, value)=>{
        if (count <= 1) {
            return;
        }
        const column = fieldColumnIndex.get(field);
        if (column === undefined) {
            return;
        }
        merges.push({
            id: `merge-${field}-${startRow}`,
            row: startRow,
            column,
            rowSpan: count,
            columnSpan: 1,
            value
        });
    };
    const buildData = (path, attributeLabel, values)=>{
        const data = {
            ...path
        };
        data[attributeField] = attributeLabel;
        if (values) {
            Object.assign(data, values);
        }
        return data;
    };
    const emitAttribute = (attr, path)=>{
        const hasDetails = Boolean(attr.children?.length);
        if (!hasDetails) {
            rows.push({
                id: attr.id,
                data: buildData(path, attr.label, attr.values)
            });
            currentRow += 1;
            return null;
        }
        rows.push({
            id: attr.id,
            data: buildData(path, attr.label, attr.values)
        });
        currentRow += 1;
        const detailStart = currentRow;
        attr.children.forEach((detail)=>{
            rows.push({
                id: detail.id,
                data: buildData(path, detail.label, detail.values)
            });
            currentRow += 1;
        });
        const detailCount = currentRow - detailStart;
        if (detailCount <= 0) {
            return null;
        }
        return {
            id: `${attr.id}-details`,
            startRow: detailStart,
            count: detailCount,
            collapsed: attr.collapsed ?? config.collapseAttributes ?? true
        };
    };
    const walk = (nodes, depth, parentPath)=>{
        const groups = [];
        nodes.forEach((node)=>{
            const labelField = getLabelField(depth);
            const path = {
                ...parentPath
            };
            if (labelField) {
                path[labelField] = node.label;
            }
            if (node.data) {
                Object.assign(path, node.data);
            }
            const hasChildren = Boolean(node.children?.length);
            const hasAttributes = Boolean(node.attributes?.length);
            if (!hasChildren && !hasAttributes) {
                rows.push({
                    id: node.id,
                    data: buildData(path, '', undefined)
                });
                currentRow += 1;
                return;
            }
            const summaryStart = currentRow;
            rows.push({
                id: node.id,
                data: buildData(path, '', undefined)
            });
            currentRow += 1;
            const detailStart = currentRow;
            const childGroups = [];
            if (hasChildren) {
                childGroups.push(...walk(node.children, depth + 1, path));
            }
            if (hasAttributes) {
                node.attributes.forEach((attr)=>{
                    const attrGroup = emitAttribute(attr, path);
                    if (attrGroup) {
                        childGroups.push(attrGroup);
                    }
                });
            }
            const totalCount = currentRow - summaryStart;
            const detailCount = currentRow - detailStart;
            /**
       * 叶子（属性层）：维度值在汇总行与属性行上一致，做纵向合并。
       * 非叶子：子节点会改写同列 label，只保留汇总行自己的值，不做跨子节点合并。
       */ if (hasAttributes && !hasChildren) {
                if (labelField && totalCount > 1) {
                    pushMerge(labelField, summaryStart, totalCount, node.label);
                }
                if (node.data) {
                    Object.entries(node.data).forEach(([key, value])=>{
                        if (key !== labelField && fieldColumnIndex.has(key)) {
                            pushMerge(key, summaryStart, totalCount, value);
                        }
                    });
                }
            }
            if (detailCount > 0) {
                groups.push({
                    id: node.id,
                    startRow: detailStart,
                    count: detailCount,
                    collapsed: node.collapsed,
                    children: childGroups.length ? childGroups : undefined
                });
            }
        });
        return groups;
    };
    rowGroups.push(...walk(treeData, 0, {}));
    return {
        columns,
        rows,
        rowGroups,
        columnGroups,
        merges
    };
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/pages/UniverTable/index.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$index$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/UniverTable/index.tsx [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$contextMenu$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/UniverTable/contextMenu.ts [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$antd$2f$es$2f$message$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__message$3e$__ = __turbopack_context__.i("[project]/node_modules/antd/es/message/index.js [client] (ecmascript) <export default as message>");
;
;
;
;
/**
 * =========================================================
 * 树形 + 属性 示例（行折叠 + 列折叠 + 单元格附件）
 * =========================================================
 *
 * 行：Category 树 + Region 属性层（左侧大纲）
 * 列：Region 两列一组、Sales/Profit 指标一组（顶部大纲）
 * 附件：右键单元格 → 添加附件 / 查看附件 / 清空附件
 */ const treeConfig = {
    labelMode: 'single',
    collapseAttributes: true,
    dimensions: [
        {
            field: 'category',
            title: 'Category',
            width: 140
        },
        {
            field: 'region',
            title: 'Region',
            width: 100
        }
    ],
    attribute: {
        field: 'attribute',
        title: 'Region',
        width: 120
    },
    measures: [
        {
            field: 'sales',
            title: 'Sales',
            width: 120
        },
        {
            field: 'profit',
            title: 'Profit',
            width: 120
        }
    ],
    columnGroups: [
        {
            id: 'region-cols',
            fields: [
                'region',
                'attribute'
            ]
        },
        {
            id: 'metrics',
            fields: [
                'sales',
                'profit'
            ]
        }
    ]
};
const money = (n)=>`$${n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
const regionAttributes = (prefix, eastSales, eastProfit, withEastDetails = false)=>[
        {
            id: `${prefix}-attr-east`,
            label: 'East',
            values: {
                sales: money(eastSales),
                profit: money(eastProfit)
            },
            collapsed: true,
            children: withEastDetails ? [
                {
                    id: `${prefix}-east-d1`,
                    label: 'East / Retail',
                    values: {
                        sales: money(eastSales * 0.6),
                        profit: money(Number((eastProfit * 0.6).toFixed(2)))
                    }
                },
                {
                    id: `${prefix}-east-d2`,
                    label: 'East / Wholesale',
                    values: {
                        sales: money(eastSales * 0.4),
                        profit: money(Number((eastProfit * 0.4).toFixed(2)))
                    }
                }
            ] : undefined
        },
        {
            id: `${prefix}-attr-central`,
            label: 'Central'
        },
        {
            id: `${prefix}-attr-west`,
            label: 'West'
        },
        {
            id: `${prefix}-attr-south`,
            label: 'South'
        }
    ];
const treeData = [
    {
        id: 'furniture',
        label: 'Furniture',
        children: [
            {
                id: 'bookcases',
                label: 'Bookcases',
                data: {
                    region: 'East'
                },
                attributes: regionAttributes('bookcases', 43819.33, -1167.63, true)
            },
            {
                id: 'chairs',
                label: 'Chairs',
                data: {
                    region: 'East'
                },
                attributes: regionAttributes('chairs', 98621.45, 5240.18)
            },
            {
                id: 'furnishings',
                label: 'Furnishings',
                data: {
                    region: 'East'
                },
                attributes: regionAttributes('furnishings', 21540.9, 832.4)
            }
        ]
    }
];
/**
 * 演示附件：挂在 Bookcases / East 的 Sales 单元格
 * 表头 1 行 + 数据 index 2 → Excel D4
 */ const demoAttachments = [
    {
        cell: 'D4',
        files: [
            {
                id: 'demo-att-1',
                name: 'bookcases-east-sales.pdf',
                url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
                size: 13264,
                mimeType: 'application/pdf',
                uploadedAt: new Date().toISOString()
            }
        ]
    }
];
const defaultOptions = {
    name: 'Sales by Category',
    defaultColumnWidth: 110,
    defaultRowHeight: 32,
    showGridLines: true,
    freezeRows: 1,
    freezeColumns: 1,
    customizeColumnHeader: true,
    contextMenuItems: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$contextMenu$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["defaultContextMenuItems"],
    enableContextMenu: true
};
const UniverTablePage = ()=>{
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        style: {
            width: '100%',
            height: 'calc(100vh - 100px)'
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    padding: '8px 12px',
                    color: '#595959',
                    fontSize: 13
                },
                children: "右键单元格可「添加附件 / 查看附件 / 清空附件」。D4 已预置演示附件。"
            }, void 0, false, {
                fileName: "[project]/src/pages/UniverTable/index.tsx",
                lineNumber: 148,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$UniverTable$2f$index$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["default"], {
                treeData: treeData,
                treeConfig: treeConfig,
                attachments: demoAttachments,
                options: defaultOptions,
                onAttachmentsChange: (cell, files)=>{
                    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$antd$2f$es$2f$message$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__message$3e$__["message"].info(`${cell} 附件数量：${files.length}`);
                }
            }, void 0, false, {
                fileName: "[project]/src/pages/UniverTable/index.tsx",
                lineNumber: 151,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/src/pages/UniverTable/index.tsx",
        lineNumber: 147,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_c = UniverTablePage;
var __TURBOPACK__default__export__ = UniverTablePage;
var _c;
__turbopack_context__.k.register(_c, "UniverTablePage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_c6ea003a.async.js.map