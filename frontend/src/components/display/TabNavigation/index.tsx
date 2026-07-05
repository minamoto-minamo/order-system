/** タブ切替ナビゲーション（下線インジケーター付き） */

interface TabNavigationProps {
  tabs: { key: string; label: string }[];
  activeTab: string;
  onChange: (key: string) => void;
  /** コンテナに追加するクラス（背景色の上書き等） */
  className?: string;
}

export function TabNavigation({ tabs, activeTab, onChange, className = "" }: TabNavigationProps) {
  return (
    <div className={`flex border-b border-divider shrink-0 ${className}`}>
      {tabs.map(t => (
        <button
          key={t.key}
          // アクティブタブは下線 + 太字、非アクティブはグレー
          className={`flex-1 py-2.75 text-note border-none bg-transparent cursor-pointer border-b-2 ${activeTab === t.key ? "text-ink font-medium border-ink" : "text-muted border-transparent"}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
