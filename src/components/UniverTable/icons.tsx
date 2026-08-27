import { ComponentManager } from '@univerjs/ui';

// 新增批注icon
export const AddCommentIcon = () => (
  <svg
    className="icon"
    viewBox="0 0 1024 1024"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="currentColor"
    style={{ verticalAlign: 'middle' }}
  >
    <path
      d="M526.56128 168.29952a11.65312 11.65312 0 0 1 11.65312 11.65312v58.25536a11.65312 11.65312 0 0 1-11.65312 11.65312H162.47296v489.33376h107.77088v119.58272l136.0896-119.58272h449.36704V590.6432a11.65312 11.65312 0 0 1 11.65312-11.65312h58.25536a11.65312 11.65312 0 0 1 11.65312 11.65312v160.19968c0 38.6048-31.29856 69.90336-69.90336 69.90336h-430.2848l-171.01824 150.2976a46.60224 46.60224 0 0 1-64.6912-3.06176l-1.0752-1.18272a46.60736 46.60736 0 0 1-11.55584-28.88192l-0.04096-1.88416v-115.28704h-37.86752c-38.6048 0-69.90336-31.29856-69.90336-69.90336V238.20288c0-38.6048 31.29856-69.90336 69.90336-69.90336h375.73632z m-107.76576 378.65472a11.65312 11.65312 0 0 1 11.65312 11.65312v58.25536a11.65312 11.65312 0 0 1-11.65312 11.65312H226.55488a11.65312 11.65312 0 0 1-11.65312-11.65312v-58.25536a11.65312 11.65312 0 0 1 11.65312-11.65312h192.24064z m396.12416-419.4304a11.65312 11.65312 0 0 1 11.65312 11.65312l-0.00512 145.63328h145.64352a11.65312 11.65312 0 0 1 11.65312 11.65312V354.7136a11.65312 11.65312 0 0 1-11.65312 11.65312h-145.64352L826.5728 512a11.65312 11.65312 0 0 1-11.65312 11.65312h-58.25536A11.65312 11.65312 0 0 1 745.0112 512l-0.00512-145.63328h-145.62816a11.65312 11.65312 0 0 1-11.65312-11.65312V296.45824a11.65312 11.65312 0 0 1 11.65312-11.65312h145.62816l0.00512-145.63328a11.65312 11.65312 0 0 1 11.65312-11.65312h58.25536v0.00512z m-262.144 262.144a11.65312 11.65312 0 0 1 11.65312 11.65312V459.5712a11.65312 11.65312 0 0 1-11.65312 11.65312H226.55488a11.65312 11.65312 0 0 1-11.65312-11.65312V401.31584a11.65312 11.65312 0 0 1 11.65312-11.65312h326.2208z"
    />
  </svg>
);

// 删除批注icon
export const DeleteCommentIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    className="icon"
    viewBox="0 0 1024 1024"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="currentColor"
    style={{ verticalAlign: 'middle' }}
  >
    <path d="M299.885714 936.228571l-117.028571-117.028571H102.4c-43.885714 0-73.142857-29.257143-73.142857-73.142857V190.171429c0-43.885714 29.257143-73.142857 73.142857-73.142858h460.8c21.942857 0 36.571429 14.628571 36.571429 36.571429s-21.942857 36.571429-43.885715 36.571429H102.4v555.885714h109.714286l87.771428 87.771428 87.771429-87.771428h475.428571v-292.571429c0-21.942857 14.628571-36.571429 36.571429-36.571428s36.571429 14.628571 36.571428 36.571428v292.571429c0 43.885714-29.257143 73.142857-73.142857 73.142857H416.914286l-117.028572 117.028571z" />
    <path d="M446.171429 614.4H292.571429c-21.942857 0-36.571429-14.628571-36.571429-36.571429s14.628571-36.571429 36.571429-36.571428h153.6c21.942857 0 36.571429 14.628571 36.571428 36.571428s-14.628571 36.571429-36.571428 36.571429zM607.085714 409.6H292.571429c-21.942857 0-36.571429-14.628571-36.571429-36.571429s14.628571-36.571429 36.571429-36.571428h314.514285c21.942857 0 36.571429 14.628571 36.571429 36.571428s-14.628571 36.571429-36.571429 36.571429zM958.171429 270.628571h-292.571429c-21.942857 0-36.571429-14.628571-36.571429-36.571428s14.628571-36.571429 36.571429-36.571429h292.571429c21.942857 0 36.571429 14.628571 36.571428 36.571429s-14.628571 36.571429-36.571428 36.571428z" />
  </svg>
);

// 附件 icon（通用）
export const AttachmentIcon = () => (
  <svg
    className="icon"
    viewBox="0 0 1024 1024"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="currentColor"
    style={{ verticalAlign: 'middle' }}
  >
    <path d="M704 128c-70.4 0-128 57.6-128 128v448c0 88-72 160-160 160s-160-72-160-160V256h64v448c0 52.8 43.2 96 96 96s96-43.2 96-96V256c0-88 72-160 160-160s160 72 160 160v480c0 123.2-100.8 224-224 224s-224-100.8-224-224V320h64v416c0 88 72 160 160 160s160-72 160-160V256c0-70.4-57.6-128-128-128z" />
  </svg>
);

// 添加附件 icon（回形针 + 加号）
export const AddAttachmentIcon = () => (
  <svg
    className="icon"
    viewBox="0 0 1024 1024"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="currentColor"
    style={{ verticalAlign: 'middle' }}
  >
    <path d="M704 128c-70.4 0-128 57.6-128 128v448c0 88-72 160-160 160s-160-72-160-160V256h64v448c0 52.8 43.2 96 96 96s96-43.2 96-96V256c0-88 72-160 160-160s160 72 160 160v480c0 123.2-100.8 224-224 224s-224-100.8-224-224V320h64v416c0 88 72 160 160 160s160-72 160-160V256c0-70.4-57.6-128-128-128z" />
    <path d="M832 192h-64v-64c0-17.6-14.4-32-32-32s-32 14.4-32 32v64h-64c-17.6 0-32 14.4-32 32s14.4 32 32 32h64v64c0 17.6 14.4 32 32 32s32-14.4 32-32v-64h64c17.6 0 32-14.4 32-32s-14.4-32-32-32z" />
  </svg>
);

// 查看附件 icon（文件夹/文档列表）
export const ViewAttachmentIcon = () => (
  <svg
    className="icon"
    viewBox="0 0 1024 1024"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="currentColor"
    style={{ verticalAlign: 'middle' }}
  >
    <path d="M832 384H576V128H192c-17.6 0-32 14.4-32 32v704c0 17.6 14.4 32 32 32h640c17.6 0 32-14.4 32-32V416c0-17.6-14.4-32-32-32zM640 192v192h192L640 192zM192 864V192h320v256c0 17.6 14.4 32 32 32h256v384H192z" />
    <path d="M320 512h384c17.6 0 32-14.4 32-32s-14.4-32-32-32H320c-17.6 0-32 14.4-32 32s14.4 32 32 32zM320 640h256c17.6 0 32-14.4 32-32s-14.4-32-32-32H320c-17.6 0-32 14.4-32 32s14.4 32 32 32z" />
  </svg>
);

// 清空附件 icon（回形针 + 删除线）
export const ClearAttachmentIcon = () => (
  <svg
    className="icon"
    viewBox="0 0 1024 1024"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="currentColor"
    style={{ verticalAlign: 'middle' }}
  >
    <path d="M704 128c-70.4 0-128 57.6-128 128v448c0 88-72 160-160 160s-160-72-160-160V256h64v448c0 52.8 43.2 96 96 96s96-43.2 96-96V256c0-88 72-160 160-160s160 72 160 160v480c0 123.2-100.8 224-224 224s-224-100.8-224-224V320h64v416c0 88 72 160 160 160s160-72 160-160V256c0-70.4-57.6-128-128-128z" />
    <path d="M128 128l768 768 45.3-45.3L173.3 82.7 128 128z" />
  </svg>
);

// 复制 icon
export const CopyIcon = () => (
  <svg
    className="icon"
    viewBox="0 0 1024 1024"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="currentColor"
    style={{ verticalAlign: 'middle' }}
  >
    <path d="M768 128H320c-70.4 0-128 57.6-128 128v448c0 17.6 14.4 32 32 32s32-14.4 32-32V256c0-35.2 28.8-64 64-64h448c17.6 0 32-14.4 32-32s-14.4-32-32-32z" />
    <path d="M832 256H448c-70.4 0-128 57.6-128 128v512c0 70.4 57.6 128 128 128h384c70.4 0 128-57.6 128-128V384c0-70.4-57.6-128-128-128z m64 640c0 35.2-28.8 64-64 64H448c-35.2 0-64-28.8-64-64V384c0-35.2 28.8-64 64-64h384c35.2 0 64 28.8 64 64v512z" />
  </svg>
);

// 粘贴 icon
export const PasteIcon = () => (
  <svg
    className="icon"
    viewBox="0 0 1024 1024"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="currentColor"
    style={{ verticalAlign: 'middle' }}
  >
    <path d="M704 128h-64V96c0-17.6-14.4-32-32-32H416c-17.6 0-32 14.4-32 32v32h-64c-70.4 0-128 57.6-128 128v640c0 70.4 57.6 128 128 128h512c70.4 0 128-57.6 128-128V256c0-70.4-57.6-128-128-128zM416 128h192v64H416V128z m320 768H288c-35.2 0-64-28.8-64-64V256c0-35.2 28.8-64 64-64h64v32c0 17.6 14.4 32 32 32h192c17.6 0 32-14.4 32-32v-32h64c35.2 0 64 28.8 64 64v576c0 35.2-28.8 64-64 64z" />
    <path d="M384 448h256c17.6 0 32-14.4 32-32s-14.4-32-32-32H384c-17.6 0-32 14.4-32 32s14.4 32 32 32zM384 608h256c17.6 0 32-14.4 32-32s-14.4-32-32-32H384c-17.6 0-32 14.4-32 32s14.4 32 32 32zM384 768h160c17.6 0 32-14.4 32-32s-14.4-32-32-32H384c-17.6 0-32 14.4-32 32s14.4 32 32 32z" />
  </svg>
);

// 单元格历史 icon（时钟）
export const CellHistoryIcon = () => (
  <svg
    className="icon"
    viewBox="0 0 1024 1024"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="currentColor"
    style={{ verticalAlign: 'middle' }}
  >
    <path d="M512 96C282.624 96 96 282.624 96 512s186.624 416 416 416 416-186.624 416-416S741.376 96 512 96z m0 768c-194.133333 0-352-157.866667-352-352s157.866667-352 352-352 352 157.866667 352 352-157.866667 352-352 352z" />
    <path d="M544 320h-64v224c0 11.733333 6.4 22.4 16.64 28.16l160 96 34.133333-55.466667L544 521.6V320z" />
  </svg>
);

// 数据追踪 icon（分支树）
export const DataTraceIcon = () => (
  <svg
    className="icon"
    viewBox="0 0 1024 1024"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="currentColor"
    style={{ verticalAlign: 'middle' }}
  >
    <path d="M192 160h192v128H192V160z m448 0h192v128H640V160zM192 736h192v128H192V736z m448 0h192v128H640V736z" />
    <path d="M256 288v160h512V288h-64v96H320V288H256zM480 448h64v160h-64V448zM256 608v128h64v-64h384v64h64V608H256z" />
  </svg>
);

// 下钻 icon（向下展开）
export const DrillDownIcon = () => (
  <svg
    className="icon"
    viewBox="0 0 1024 1024"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="currentColor"
    style={{ verticalAlign: 'middle' }}
  >
    <path d="M512 704L192 320h640L512 704z" />
    <path d="M192 192h640v64H192V192z" />
  </svg>
);

// 上钻 icon（向上收起）
export const DrillUpIcon = () => (
  <svg
    className="icon"
    viewBox="0 0 1024 1024"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="currentColor"
    style={{ verticalAlign: 'middle' }}
  >
    <path d="M512 320l320 384H192L512 320z" />
    <path d="M192 768h640v64H192v-64z" />
  </svg>
);

// 快速搜索 icon（放大镜）
export const QuickSearchIcon = () => (
  <svg
    className="icon"
    viewBox="0 0 1024 1024"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="currentColor"
    style={{ verticalAlign: 'middle' }}
  >
    <path d="M469.333333 170.666667c-164.266667 0-298.666667 134.4-298.666666 298.666666s134.4 298.666667 298.666666 298.666667 298.666667-134.4 298.666667-298.666667-134.4-298.666667-298.666667-298.666666z m0 533.333333c-129.066667 0-234.666667-105.6-234.666666-234.666667s105.6-234.666667 234.666666-234.666666 234.666667 105.6 234.666667 234.666666-105.6 234.666667-234.666667 234.666667z" />
    <path d="M789.333333 748.8l-113.066666-113.066667-45.226667 45.226667 113.066667 113.066667c12.8 12.8 33.066667 12.8 45.226666 0 12.8-12.8 12.8-33.066667 0-45.226667z" />
  </svg>
);

const ICON_MAP = {
  AddCommentIcon,
  DeleteCommentIcon,
  AttachmentIcon,
  AddAttachmentIcon,
  ViewAttachmentIcon,
  ClearAttachmentIcon,
  CopyIcon,
  PasteIcon,
  CellHistoryIcon,
  DataTraceIcon,
  DrillDownIcon,
  DrillUpIcon,
  QuickSearchIcon,
} as const;

// 2. 增强版的图标注册函数
export const registerAllIcons = (univerAPI: any) => {
  if (!univerAPI) return;
  try {
    // 途径 1: Facade API 自带注册 (部分 0.2.x+ 支持)
    if (typeof univerAPI.registerIcon === 'function') {
      Object.entries(ICON_MAP).forEach(([name, Icon]) => {
        univerAPI.registerIcon(name, Icon);
      });
      return;
    }
    // 途径 2: 深度获取 UI 层的 ComponentManager
    const injector = univerAPI.__getInjector?.() || univerAPI.getGlobalContext?.()?.injector || univerAPI._injector;
    if (injector) {
      const componentManager = injector.get(ComponentManager);
      if (componentManager) {
        Object.entries(ICON_MAP).forEach(([name, Icon]) => {
          componentManager.register(name, Icon);
        });
        console.log('[ETable] Icon registered via ComponentManager');
      } else {
        console.warn('[ETable] ComponentManager not found in injector');
      }
    }
  } catch (error) {
    console.error('[ETable] Failed to register icons:', error);
  }
};
