type Props = {
  title: string;
  onClickMore?: () => void; // onClickMore を追加
};

const SectionHeader: React.FC<Props> = ({ title, onClickMore }) => {
  return (
    <div className="max-w-md mx-auto px-4 mt-5 mb-2 flex items-center justify-between">
      <div className="text-gray-800 font-semibold flex items-center gap-2">
        <span className="text-pink-500">☆</span>
        <span>{title}</span>
      </div>
      {onClickMore && (
        <button
          className="text-sm text-brand-dark hover:underline"
          onClick={onClickMore}
        >
          一覧へ
        </button>
      )}
    </div>
  );
};

export default SectionHeader;