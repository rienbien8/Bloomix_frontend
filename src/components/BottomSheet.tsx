"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  heightPct?: number; // 70 がおすすめ
};

export default function BottomSheet({
  open,
  onClose,
  children,
  title,
  heightPct = 70,
}: Props) {
  const startY = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!open) setOffset(0);
  }, [open]);

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    setOffset(Math.max(0, dy));
  };
  const onTouchEnd = () => {
    if (offset > 80) onClose();
    setOffset(0);
    startY.current = null;
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition ${
          open ? "bg-black/40" : "pointer-events-none bg-transparent"
        }`}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed left-0 right-0 z-50 mx-auto"
        style={{
          bottom: open ? 0 : "-100%",
          height: `${heightPct}vh`,
          transform: `translateY(${offset}px)`,
          transition: offset ? "none" : "bottom 200ms ease-out",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="h-full w-full rounded-t-2xl bg-white shadow-xl">
          <div className="flex items-center justify-center pt-2">
            <div className="h-1.5 w-16 rounded-full bg-zinc-300" />
          </div>
          {title && (
            <div className="px-4 py-2 text-center text-sm font-medium text-zinc-600">
              {title}
            </div>
          )}
          <div className="h-[calc(100%-48px)] overflow-y-auto px-4 pb-6 pt-2">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
