// The one shared avatar — Shell.jsx's own TopBar account icon and the reference mockups' owner/
// agent initials (ActionHeaderCard's "Me", AgentsOnThisPanel's per-agent rows) were each a
// one-off `<span className="rounded-full ...">` with no way for a second call site to reuse either
// the sizing scale or the initials logic. Never fabricates a name or role of its own (Shell.jsx's
// TopBar deliberately still passes no `name`, since this app has no real session to source one from
// honestly) — falls back to a generic person icon exactly as it always has.
function initialsOf(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const SIZE = {
  sm: { box: 'h-6 w-6', text: 'text-[9px]', icon: 'text-[10px]' },
  md: { box: 'h-8 w-8', text: 'text-[11px]', icon: 'text-[13px]' },
  lg: { box: 'h-10 w-10', text: 'text-[13px]', icon: 'text-[15px]' },
};

const TONE = {
  brand: 'bg-rf-brand-blue-500 text-white',
  neutral: 'bg-rf-surface-sunken text-rf-text-tertiary',
};

/**
 * @param {string} [name] - when given, renders up to two initials; otherwise renders `icon`.
 * @param {string} [icon] - a Font Awesome class string, used only when `name` is absent.
 * @param {'sm'|'md'|'lg'} [size]
 * @param {'brand'|'neutral'} [tone] - `brand` for a real named owner/agent (the reference's "module
 *   hue" convention); `neutral` for the anonymous fallback.
 */
export default function Avatar({ name, icon = 'fa-solid fa-user', size = 'md', tone = 'brand', className = '' }) {
  const s = SIZE[size] ?? SIZE.md;
  const initials = name ? initialsOf(name) : '';
  const t = TONE[tone] ?? TONE.brand;

  return (
    <span
      role="img"
      aria-label={name || 'Unknown'}
      title={name || undefined}
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${s.box} ${initials ? s.text : ''} ${t} ${className}`}
    >
      {initials ? initials : <i className={`${icon} ${s.icon}`} aria-hidden="true" />}
    </span>
  );
}
