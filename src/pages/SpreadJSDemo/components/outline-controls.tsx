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
      aria-label="产品与区域层级控制"
    >
      <OutlineControlCard
        dimension="product"
        title="产品层级"
        description={
          dataMode === 'stress'
            ? '10 个事业群 / 100 条产品线；产品线与首个区域同行展示'
            : '家具 / 办公用品 / 技术产品；属性列跟随产品'
        }
        expanded={snapshot.productExpanded}
        total={snapshot.productTotal}
        disabled={disabled}
        onSetAll={onSetAll}
      />
      <OutlineControlCard
        dimension="region"
        title="区域层级"
        description={
          dataMode === 'stress'
            ? '每个事业群 / 产品线独立维护区域状态'
            : '每个产品分别维护区域展开状态'
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
            ? '恢复产品树与区域树全部收起'
            : '恢复产品树默认展开、区域树全部收起'
        }
      >
        <RotateCcw size={14} />
        恢复默认
      </button>
    </div>
  );
}
