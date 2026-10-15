/** The MergeUp mark: two branches merge and rise. The same drawing as public/logo.svg, in a flat green. */
export function Logo({ size }: { size: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#1F883D" />
      <path
        d="M20 45c0-9 12-9 12-17M44 45c0-9-12-9-12-17M32 28V15M25 21.5l7-7 7 7"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="47" r="4.6" fill="#FFFFFF" />
      <circle cx="44" cy="47" r="4.6" fill="#FFFFFF" />
    </svg>
  );
}
