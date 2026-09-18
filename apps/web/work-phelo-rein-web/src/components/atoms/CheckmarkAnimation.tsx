/**
 * Animated checkmark: a dot expands into a spinning arc, the arc closes into a
 * full circle, turns green, and a checkmark draws in the centre. The draw-in
 * sequence runs once and settles on the finished state. `loop` controls only
 * the gentle settle-bounce afterwards — true (default) repeats it, false lets
 * it bounce once and rest.
 *
 * Keyframes / classes live in globals.css under the `cm-` prefix.
 */
export function CheckmarkAnimation({ size = 96, loop = true }: { size?: number; loop?: boolean }) {
  return (
    <div
      className="cm-anim"
      style={{
        width: size,
        height: size,
        animationIterationCount: loop ? 'infinite' : 1,
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 200 200"
        role="img"
        aria-label="Success checkmark"
      >
        <g className="cm-anim-spin">
          <circle
            cx="100"
            cy="100"
            r="70"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            pathLength={100}
            className="cm-anim-arc"
          />
        </g>
        <circle cx="100" cy="100" r="7" className="cm-anim-dot" />
        <path
          d="M72,102 L92,122 L132,78"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={100}
          className="cm-anim-check"
        />
      </svg>
    </div>
  );
}
