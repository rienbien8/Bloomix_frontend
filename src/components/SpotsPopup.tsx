"use client";

import { useState } from "react";
import SpotCard from "./SpotCard";
import type { Spot } from "../modules/types";

type Props = {
  spots: Spot[] | null;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
};

export default function SpotsPopup({
  spots,
  isOpen,
  onClose,
  title = "スポット一覧",
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景オーバーレイ */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* ポップアップ本体 */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* スポット一覧 */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          {spots && spots.length > 0 ? (
            <div className="space-y-3">
              {spots.map((spot) => (
                <SpotCard key={spot.id} spot={spot} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              スポットが見つかりません
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
