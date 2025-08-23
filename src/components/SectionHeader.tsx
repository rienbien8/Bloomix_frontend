import { Star, Play } from "./Icons";

type Props = {
  title: string;
  onMore?: () => void;
  icon?: "star" | "play";
  iconColor?: string;
};

export default function SectionHeader({
  title,
  onMore,
  icon = "star",
  iconColor = "text-pink-500",
}: Props) {
  const IconComponent = icon === "play" ? Play : Star;

  return (
    <div className="max-w-md mx-auto px-4 mt-5 mb-2 flex items-center justify-between">
      <div className="text-gray-800 font-semibold flex items-center gap-2">
        <IconComponent className={`w-5 h-5 ${iconColor}`} />
        <span>{title}</span>
      </div>
      <button
        className="text-sm text-brand-dark hover:underline"
        onClick={onMore}
      >
        一覧へ
      </button>
    </div>
  );
}
