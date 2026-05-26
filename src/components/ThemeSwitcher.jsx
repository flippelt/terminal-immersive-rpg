export default function ThemeSwitcher({ themes, current, onSelect }) {
  return (
    <div className="theme-switcher">
      {themes.map((t) => (
        <button
          key={t.id}
          className={t.id === current ? 'active' : ''}
          onClick={() => onSelect(t)}
          title={t.name}
        >
          {t.id}
        </button>
      ))}
    </div>
  )
}
