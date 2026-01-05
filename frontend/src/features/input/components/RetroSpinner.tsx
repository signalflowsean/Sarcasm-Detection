/**
 * Retro loading spinner component matching the VU meter aesthetic.
 * Used for speech recognition loading states.
 */
export function RetroSpinner() {
  return (
    <svg
      className="retro-spinner"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="10"
        cy="10"
        r="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="25 15"
        opacity="0.6"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 10 10"
          to="360 10 10"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </circle>
      <circle
        cx="10"
        cy="10"
        r="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
      >
        <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0.8;0.4" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

export default RetroSpinner
