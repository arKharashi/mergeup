/**
 * The MergeUp mark: two branches, navy and green, merge into one that rises as an arrow.
 * The same drawing as public/logo.svg. Colours come from --brand-ink and --brand-green.
 */
export function Logo({ size }: { size: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 340 340" aria-hidden="true">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path className="ink" d="M178 128.5C178 159 164 179 142 189C122 198 93 205 85 231" strokeWidth="30" />
        <circle className="ink" cx="56.5" cy="263.5" r="35.5" strokeWidth="26" />
        <path className="go" d="M178 129C178 163.5 193 183 215 193C228 199 248 211 254 226" strokeWidth="31" />
        <path className="go" d="M178 101V129" strokeWidth="32.5" />
        <circle className="go" cx="284" cy="263.5" r="35.5" strokeWidth="26" />
        <path className="go fill" d="M178 39.5L120 98.5H236.5Z" strokeWidth="14" />
      </g>
    </svg>
  );
}
