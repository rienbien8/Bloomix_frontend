import React from "react";

type Props = {
  artist: {
    id: string;
    name: string;
    spotsCount: number;
    iconUrl?: string;
  };
  isFollowing: boolean;
  onToggleFollow: () => void;
};

export default function ArtistCard({
  artist,
  isFollowing,
  onToggleFollow,
}: Props) {
  if (!artist) return null; // props未定義防止

  return (
    <div className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-md">
      {artist.iconUrl ? (
        <img
          src={artist.iconUrl}
          alt={artist.name}
          className="w-12 h-12 rounded-full"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-gray-200 grid place-items-center">
          🎵
        </div>
      )}
      <div className="flex-1">
        <div className="font-bold">{artist.name}</div>
        <div className="text-sm text-gray-500">
          登録スポット数: {artist.spotsCount}
        </div>
      </div>
      <button
        onClick={onToggleFollow}
        className={`px-3 py-1 rounded-full text-sm font-medium ${
          isFollowing ? "bg-gray-200 text-white" : "bg-gray-200 text-gray-700"
        }`}
      >
        {isFollowing ? "💗" : "🤍"}
      </button>
    </div>
  );
}
