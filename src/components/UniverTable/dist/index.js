"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var react_1 = require("react");
var presets_1 = require("@univerjs/presets");
var preset_sheets_advanced_1 = require("@univerjs/preset-sheets-advanced");
var preset_sheets_core_1 = require("@univerjs/preset-sheets-core");
var preset_sheets_thread_comment_1 = require("@univerjs/preset-sheets-thread-comment");
var outline_1 = require("./outline");
var renderer_1 = require("./renderer");
var contextMenu_1 = require("./contextMenu");
var icons_1 = require("./icons");
var header_1 = require("./header");
var zh_CN_1 = require("@univerjs/preset-sheets-thread-comment/locales/zh-CN");
var zh_CN_2 = require("@univerjs/preset-sheets-advanced/locales/zh-CN");
var zh_CN_3 = require("@univerjs/preset-sheets-core/locales/zh-CN");
require("@univerjs/preset-sheets-advanced/lib/index.css");
require("@univerjs/preset-sheets-core/lib/index.css");
require("@univerjs/preset-sheets-thread-comment/lib/index.css");
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
*/
var Table = react_1.forwardRef(function (props, ref) {
    // 取组件参数
    var _a = props.columns, columns = _a === void 0 ? [] : _a, _b = props.rows, rows = _b === void 0 ? [] : _b, _c = props.merges, merges = _c === void 0 ? [] : _c, _d = props.rowGroups, rowGroups = _d === void 0 ? [] : _d, _e = props.columnGroups, columnGroups = _e === void 0 ? [] : _e, _f = props.options, options = _f === void 0 ? {} : _f, _g = props.comments, comments = _g === void 0 ? [] : _g, onReady = props.onReady;
    // 表格基础配置
    var _h = options, _j = _h.name, name = _j === void 0 ? 'Table' : _j, 
    // 默认列宽
    _k = _h.defaultColumnWidth, 
    // 默认列宽
    defaultColumnWidth = _k === void 0 ? 110 : _k, 
    // 默认行高
    _l = _h.defaultRowHeight, 
    // 默认行高
    defaultRowHeight = _l === void 0 ? 30 : _l, 
    // 是否显示网格线
    _m = _h.showGridLines, 
    // 是否显示网格线
    showGridLines = _m === void 0 ? true : _m, 
    // 冻结行数量
    freezeRows = _h.freezeRows, 
    // 冻结列数量
    freezeColumns = _h.freezeColumns, 
    // 是否自定义 Univer 原生列头
    _o = _h.customizeColumnHeader, 
    // 是否自定义 Univer 原生列头
    customizeColumnHeader = _o === void 0 ? true : _o, 
    // 扩展选项：自定义右键菜单项（不传则使用默认的 defaultContextMenuItems）
    _p = _h.contextMenuItems, 
    // 扩展选项：自定义右键菜单项（不传则使用默认的 defaultContextMenuItems）
    contextMenuItems = _p === void 0 ? contextMenu_1.defaultContextMenuItems : _p, 
    // 扩展选项：是否启用自定义右键菜单
    _q = _h.enableContextMenu, 
    // 扩展选项：是否启用自定义右键菜单
    enableContextMenu = _q === void 0 ? true : _q;
    // Univer DOM 容器
    var containerRef = react_1.useRef(null);
    // Univer API
    var univerAPIRef = react_1.useRef(null);
    // Workbook
    var workbookRef = react_1.useRef(null);
    // Worksheet
    var worksheetRef = react_1.useRef(null);
    //  对外暴露API
    react_1.useImperativeHandle(ref, function () { return ({
        // Univer API
        getUniverAPI: function () {
            return univerAPIRef.current;
        },
        // Workbook
        getWorkbook: function () {
            return workbookRef.current;
        },
        // Worksheet
        getWorksheet: function () {
            return worksheetRef.current;
        },
        // 行分组
        getRowOutlines: function () {
            var worksheet = worksheetRef.current;
            if (!worksheet) {
                return [];
            }
            ;
            return outline_1.getRowOutlines(worksheet);
        },
        // 折叠指定行分组
        collapseRowGroup: function (id) {
            var worksheet = worksheetRef.current;
            if (!worksheet) {
                return;
            }
            outline_1.setOutlineCollapsed(worksheet, id, true);
        },
        // 展开指定行分组
        expandRowGroup: function (id) {
            var worksheet = worksheetRef.current;
            if (!worksheet) {
                return;
            }
            outline_1.setOutlineCollapsed(worksheet, id, false);
        },
        // 一次性折叠所有行分组
        collapseAllRows: function () {
            var worksheet = worksheetRef.current;
            if (!worksheet) {
                return;
            }
            var groups = outline_1.getRowOutlines(worksheet);
            groups.forEach(function (group) {
                worksheet.setDimensionOutlineCollapsed(group.id, true);
            });
        },
        // 一次性展开所有行分组
        expandAllRows: function () {
            var worksheet = worksheetRef.current;
            if (!worksheet) {
                return;
            }
            var groups = outline_1.getRowOutlines(worksheet);
            groups.forEach(function (group) {
                worksheet.setDimensionOutlineCollapsed(group.id, false);
            });
        },
        // 列分组
        getColumnOutlines: function () {
            var worksheet = worksheetRef.current;
            if (!worksheet) {
                return [];
            }
            return outline_1.getColumnOutlines(worksheet);
        },
        // 折叠指定列分组
        collapseColumnGroup: function (id) {
            var worksheet = worksheetRef.current;
            if (!worksheet) {
                return;
            }
            outline_1.setOutlineCollapsed(worksheet, id, true);
        },
        // 展开指定列分组
        expandColumnGroup: function (id) {
            var worksheet = worksheetRef.current;
            if (!worksheet) {
                return;
            }
            outline_1.setOutlineCollapsed(worksheet, id, false);
        },
        // 一次性折叠所有列分组
        collapseAllColumns: function () {
            var worksheet = worksheetRef.current;
            if (!worksheet) {
                return;
            }
            var groups = outline_1.getColumnOutlines(worksheet);
            groups.forEach(function (group) {
                worksheet.setDimensionOutlineCollapsed(group.id, true);
            });
        },
        // 一次性展开所有列分组
        expandAllColumns: function () {
            var worksheet = worksheetRef.current;
            if (!worksheet) {
                return;
            }
            var groups = outline_1.getColumnOutlines(worksheet);
            groups.forEach(function (group) {
                worksheet.setDimensionOutlineCollapsed(group.id, false);
            });
        },
        // 批注
        addComment: function (cell, content, userId) {
            if (userId === void 0) { userId = 'current-user'; }
            return __awaiter(this, void 0, void 0, function () {
                var univerAPI, worksheet, richText, commentBuilder, range;
                return __generator(this, function (_a) {
                    univerAPI = univerAPIRef.current;
                    worksheet = worksheetRef.current;
                    if (!univerAPI || !worksheet) {
                        return [2 /*return*/, null];
                    }
                    richText = univerAPI.newRichText().insertText(content);
                    commentBuilder = univerAPI.newTheadComment().setContent(richText).setPersonId(userId).setDateTime(new Date());
                    range = worksheet.getRange(cell);
                    // 添加批注
                    return [2 /*return*/, range.addCommentAsync(commentBuilder)];
                });
            });
        },
        // 获取全部单元格批注
        getComments: function () {
            var worksheet = worksheetRef.current;
            if (!worksheet) {
                return [];
            }
            return worksheet.getComments();
        },
        // 获取指定单元格的批注
        getComment: function (cell) {
            var worksheet = worksheetRef.current;
            if (!worksheet) {
                return null;
            }
            return worksheet.getRange(cell).getComment();
        },
        // 删除指定单元格的批注
        deleteComment: function (cell) {
            return __awaiter(this, void 0, void 0, function () {
                var worksheet, comment;
                return __generator(this, function (_a) {
                    worksheet = worksheetRef.current;
                    if (!worksheet) {
                        return [2 /*return*/, false];
                    }
                    comment = worksheet.getRange(cell).getComment();
                    if (!comment) {
                        return [2 /*return*/, false];
                    }
                    return [2 /*return*/, comment.deleteAsync()];
                });
            });
        },
        // 删除当前 Worksheet中的全部批注
        clearComments: function () {
            return __awaiter(this, void 0, void 0, function () {
                var worksheet, comments;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            worksheet = worksheetRef.current;
                            if (!worksheet) {
                                return [2 /*return*/];
                            }
                            comments = worksheet.getComments();
                            return [4 /*yield*/, Promise.all(comments.map(function (comment) { return comment.deleteAsync(); }))];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        }
    }); }, []);
    // 初始化 Univer
    react_1.useEffect(function () {
        var _a;
        // 没有 DOM 容器，不初始化
        if (!containerRef.current) {
            return;
        }
        // 防止重复初始化
        if (univerAPIRef.current) {
            return;
        }
        // 创建 Univer
        var univerAPI = presets_1.createUniver({
            // 中文
            locale: presets_1.LocaleType.ZH_CN,
            // 中文语言包
            locales: (_a = {}, _a[presets_1.LocaleType.ZH_CN] = presets_1.mergeLocales(zh_CN_3["default"], zh_CN_2["default"], zh_CN_1["default"]), _a),
            // Preset
            presets: [
                // Core
                preset_sheets_core_1.UniverSheetsCorePreset({ container: containerRef.current }),
                // Advanced
                preset_sheets_advanced_1.UniverSheetsAdvancedPreset(),
                // Thread Comment
                preset_sheets_thread_comment_1.UniverSheetsThreadCommentPreset(),
            ]
        }).univerAPI;
        // 保存 Univer API
        univerAPIRef.current = univerAPI;
        // 创建 Workbook
        var workbook = univerAPI.createWorkbook({ name: name });
        workbookRef.current = workbook;
        // 获取 Worksheet
        var worksheet = workbook.getActiveSheet();
        if (!worksheet) {
            return;
        }
        worksheetRef.current = worksheet;
        // 1. 网格线
        worksheet.setHiddenGridlines(!showGridLines);
        // 2. 渲染业务多级表头
        var _b = renderer_1.renderHeader(worksheet, columns), leafColumns = _b.leafColumns, maxDepth = _b.maxDepth;
        // 3. ⭐ 自定义 Univer 原生列头
        if (customizeColumnHeader && leafColumns.length) {
            var columnsCfg_1 = {};
            leafColumns.forEach(function (column, index) {
                columnsCfg_1[index] = column.title;
            });
            // 延迟到当前渲染完成后执行。
            requestAnimationFrame(function () {
                var _a;
                try {
                    header_1.customizeColumnHeaders(worksheet, leafColumns);
                }
                catch (error) {
                    console.warn('[Table] customize column header failed', error);
                    // 兼容当前代码。如果当前版本的 Worksheet直接支持 customizeColumnHeader，则继续使用原生 API。
                    try {
                        (_a = worksheet.customizeColumnHeader) === null || _a === void 0 ? void 0 : _a.call(worksheet, { columnsCfg: columnsCfg_1 });
                    }
                    catch (fallbackError) {
                        console.warn('[Table] fallback customize column header failed', fallbackError);
                    }
                }
            });
        }
        // 4. 设置列宽
        renderer_1.renderColumnWidths(worksheet, leafColumns, defaultColumnWidth);
        // 5. 设置表头行高
        renderer_1.renderRowHeights(worksheet, 0, maxDepth, defaultRowHeight);
        // 6. 渲染数据
        renderer_1.renderData(worksheet, rows, leafColumns, maxDepth);
        // 7. 设置数据行高
        if (rows.length) {
            renderer_1.renderRowHeights(worksheet, maxDepth, rows.length, defaultRowHeight);
        }
        // 8. 自定义合并
        renderer_1.renderMerges(worksheet, merges);
        // 9. 行分组
        outline_1.createRowOutlines(worksheet, rowGroups, maxDepth);
        // 10. 列分组
        outline_1.createColumnOutlines(worksheet, columnGroups);
        // 11. 冻结行
        if (typeof freezeRows === 'number') {
            worksheet.setFrozenRows(freezeRows);
        }
        else if (maxDepth > 0) {
            worksheet.setFrozenRows(maxDepth);
        }
        // 12. 冻结列
        if (typeof freezeColumns === 'number') {
            worksheet.setFrozenColumns(freezeColumns);
        }
        // 13. 初始化批注
        if (comments.length) {
            Promise.all(comments.map(function (comment) { return __awaiter(void 0, void 0, void 0, function () {
                var cell, content, _a, userId, dateTime, id, threadId, richText, builder, range, error_1;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 2, , 3]);
                            cell = comment.cell, content = comment.content, _a = comment.userId, userId = _a === void 0 ? 'current-user' : _a, dateTime = comment.dateTime, id = comment.id, threadId = comment.threadId;
                            // 没有单元格或者内容  直接跳过
                            if (!cell || !content) {
                                return [2 /*return*/];
                            }
                            richText = univerAPI.newRichText().insertText(content);
                            builder = univerAPI.newTheadComment().setContent(richText).setPersonId(userId).setDateTime(dateTime ? new Date(dateTime) : new Date());
                            // 设置批注 ID
                            if (id) {
                                builder = builder.setId(id);
                            }
                            // 设置 Thread ID
                            if (threadId) {
                                builder = builder.setThreadId(threadId);
                            }
                            range = worksheet.getRange(cell);
                            // 添加批注
                            return [4 /*yield*/, range.addCommentAsync(builder)];
                        case 1:
                            // 添加批注
                            _b.sent();
                            return [3 /*break*/, 3];
                        case 2:
                            error_1 = _b.sent();
                            console.warn('[Table] add comment failed', error_1);
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); }));
        }
        // 13.5 注册自定义右键菜单
        if (enableContextMenu && contextMenuItems && contextMenuItems.length) {
            try {
                contextMenu_1.customizeContextMenu(univerAPI, worksheet, contextMenuItems);
            }
            catch (error) {
                console.warn('[Table] register context menu failed', error);
            }
        }
        // 14. 初始化完成
        onReady === null || onReady === void 0 ? void 0 : onReady({ univerAPI: univerAPI, workbook: workbook, worksheet: worksheet });
        // 15. 销毁
        return function () {
            try {
                univerAPI.dispose();
            }
            catch (error) {
                console.warn('[Table] dispose failed', error);
            }
            univerAPIRef.current = null;
            workbookRef.current = null;
            worksheetRef.current = null;
        };
    }, []);
    // 注册icon图标
    react_1.useEffect(function () {
        var univerAPI = univerAPIRef.current;
        var worksheet = worksheetRef.current;
        if (univerAPI) {
            // 初始化时注册一次图标
            icons_1.registerAllIcons(univerAPI);
            // 挂载自定义右键菜单
            contextMenu_1.customizeContextMenu(univerAPI, worksheet);
        }
    }, [univerAPIRef.current, worksheetRef.current]);
    return (React.createElement("div", { style: { width: '100%', height: '100%', minHeight: 600 } },
        React.createElement("div", { ref: containerRef, style: { width: '100%', height: '100%' } })));
});
Table.displayName = 'Table';
exports["default"] = Table;
