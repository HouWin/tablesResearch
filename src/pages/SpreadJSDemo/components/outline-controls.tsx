import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import type {
  DataMode,
  OutlineDimension,
  OutlineSnapshot,
} from '../spreadsheet/model';

function OutlineControlCard({
  dimension,
  title,
  description,
  expanded,
  total,
  disabled,
  onSetAll,
}: {
  dimension: OutlineDimension;
  title: string;
  description: string;
  expanded: number;
  total: number;
  disabled: boolean;
  onSetAll: (dimension: OutlineDimension, expanded: boolean) => void;
}) {
  return (
    <section className={`integrated-outline-card is-${dimension}`}>
      <div>
        <strong>{title}</strong>
        <small>{description}</small>
      </div>
      <span aria-label={`${expanded} 个分组已展开，共 ${total} 个`}>
        {expanded}/{total} 展开
      </span>
      <div className="integrated-outline-actions">
        <button
          type="button"
          disabled={disabled || total === 0 || expanded === total}
          aria-label={`${title}：全部展开`}
          onClick={() => onSetAll(dimension, true)}
        >
          <ChevronDown size={13} />
          全部展开
        </button>
        <button
          type="button"
          disabled={disabled || expanded === 0}
          aria-label={`${title}：全部收起`}
          onClick={() => onSetAll(dimension, false)}
        >
          <ChevronRight size={13} />
          全部收起
        </button>
      </div>
    </section>
  );
}

export function OutlineControls({
  snapshot,
  dataMode,
  disabled,
  onSetAll,
  onReset,
}: {
  snapshot: OutlineSnapshot;
  dataMode: DataMode;
  disabled: boolean;
  onSetAll: (dimension: OutlineDimension, expanded: boolean) => void;
  onReset: () => void;
}) {
  return (
    <div
      className={`integrated-outline-controls${disabled ? ' is-disabled' : ''}`}
      role="group"
      aria-label="组织与科目层级控制"
    >
      <OutlineControlCard
        dimension="product"
        title="组织层级"
        description={
          dataMode === 'stress'
            ? '10 个组织群 / 100 个责任中心'
            : '集团 / 公司 / 部门三级组织结构'
        }
        expanded={snapshot.productExpanded}
        total={snapshot.productTotal}
        disabled={disabled}
        onSetAll={onSetAll}
      />
      <OutlineControlCard
        dimension="region"
        title="科目层级"
        description={
          dataMode === 'stress'
            ? '每个责任中心独立维护科目状态'
            : '每个组织分别维护费用科目展开状态'
        }
        expanded={snapshot.regionExpanded}
        total={snapshot.regionTotal}
        disabled={disabled}
        onSetAll={onSetAll}
      />
      <button
        type="button"
        className="integrated-outline-reset"
        disabled={disabled}
        onClick={onReset}
        title={
          dataMode === 'stress'
            ? '恢复组织树与科目树全部收起'
            : '恢复 Excel 对应的默认展开状态'
        }
      >
        <RotateCcw size={14} />
        恢复默认
      </button>
    </div>
  );
}
