import type { Content } from "../modules/types";

type Props = { content: Content };

export default function ContentCard({ content }: Props) {
  // 再生用のURLを生成
  const getPlayUrl = () => {
    if (content.media_type === "youtube" && content.youtube_id) {
      return `https://www.youtube.com/watch?v=${content.youtube_id}`;
    }
    if (content.media_url) {
      return content.media_url;
    }
    return null;
  };

  const playUrl = getPlayUrl();

  // 推し名を取得（APIから取得できない場合のフォールバック）
  const getOshiName = () => {
    if (content.oshi_name) {
      return content.oshi_name;
    }

    // タイトルから推し名を推測
    const title = content.title.toLowerCase();
    if (title.includes("snow man") || title.includes("snowman")) {
      return "SNOW MAN";
    }
    if (title.includes("向井康二")) {
      return "向井康二";
    }
    if (title.includes("宮舘涼太")) {
      return "宮舘涼太";
    }
    if (title.includes("岩本照")) {
      return "岩本照";
    }
    if (title.includes("目黒蓮")) {
      return "目黒蓮";
    }
    if (title.includes("阿部亮平")) {
      return "阿部亮平";
    }
    if (title.includes("佐久間大介")) {
      return "佐久間大介";
    }
    if (title.includes("ラウール")) {
      return "ラウール";
    }
    if (title.includes("渡辺翔太")) {
      return "渡辺翔太";
    }
    if (title.includes("深澤辰哉")) {
      return "深澤辰哉";
    }
    if (title.includes("木村")) {
      return "木村拓哉";
    }
    if (title.includes("嵐")) {
      return "嵐";
    }

    return content.media_type === "youtube" ? "YouTube" : "コンテンツ";
  };

  const oshiName = getOshiName();

  return (
    <div className="bg-white rounded-xl shadow-card p-3 flex items-center gap-3">
      <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
        {content.thumbnail_url ? (
          <img
            src={content.thumbnail_url}
            alt={content.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-gray-400 text-xs">No Image</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-gray-900 font-medium line-clamp-2 mb-1">
          {content.title}
        </div>
        <div className="text-xs text-gray-600 mb-1">
          {/* 推しの名前を表示 */}
          {oshiName}
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <span>♬</span>
          {content.duration_min ? `${content.duration_min}分` : "時間不明"}
        </div>
      </div>
      {playUrl ? (
        <a
          href={playUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto rounded-full px-3 py-2 text-xs text-white transition-colors"
          style={{ backgroundColor: "#71C9CE" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#5BB5BB")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "#71C9CE")
          }
          aria-label="再生"
        >
          ▶︎
        </a>
      ) : (
        <button
          className="ml-auto rounded-full bg-gray-300 px-3 py-2 text-xs text-gray-500 cursor-not-allowed"
          aria-label="再生不可"
          disabled
        >
          ▶︎
        </button>
      )}
    </div>
  );
}
