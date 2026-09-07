/**
 * Generates initials from a full display name or username.
 * e.g., "John Doe" -> "JD", "Alice" -> "A"
 */
export function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Deterministic color palette for avatar fallbacks
 */
const AVATAR_PALETTE = [
  { bg: 'from-indigo-600 to-violet-700', text: 'text-white' },
  { bg: 'from-rose-500 to-pink-600', text: 'text-white' },
  { bg: 'from-amber-500 to-orange-600', text: 'text-white' },
  { bg: 'from-emerald-500 to-teal-700', text: 'text-white' },
  { bg: 'from-cyan-500 to-blue-600', text: 'text-white' },
  { bg: 'from-fuchsia-600 to-purple-700', text: 'text-white' },
  { bg: 'from-sky-500 to-indigo-600', text: 'text-white' },
  { bg: 'from-lime-600 to-emerald-700', text: 'text-white' },
];

/**
 * Returns a deterministic gradient class pairing for a string
 */
export function getAvatarGradient(identifier) {
  if (!identifier) return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}
