import type { ContentItem } from "../modules/types";

type Props = {
  item: ContentItem;
  onClick?: () => void;   // カード全体タップ
  onPlay?: () => void;    // 右の丸ボタン
  className?: string;
};

export default function ContentListItem({ item, onClick, onPlay, className }: Props) {
  const minutes = item.duration_sec ? Math.round(item.duration_sec / 60) : null;

  return (
    <div
      role="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)] active:opacity-90 ${className || ""}`}
    >
      {/* 左：サムネ（無ければプレースホルダ） */}
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-200" />

      {/* 中央：タイトル & 補足 */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-zinc-900">
          {item.title}
        </div>
        <div className="text-xs text-zinc-500">
          {minutes !== null ? `${minutes}分` : "-"}
        </div>
      </div>

      {/* 右：アクション（▶ 再生など） */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPlay?.();
        }}
        aria-label="再生"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-700"
      >
        ▶
      </button>
    </div>
  );
}
