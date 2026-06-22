interface TopHeaderProps {
  onSearch: () => void;
}

export function TopHeader({ onSearch }: TopHeaderProps) {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="header-left">
          <span className="app-name">农场主的鸡窝</span>
        </div>
        <button className="header-search" onClick={onSearch} type="button">
          搜索基金…
        </button>
      </div>
    </header>
  );
}
