// Pure tracer / recon difficulty math — no DOM, no time. Kept out of the
// React component so it can be unit-tested directly.

// Effective tracer settings. A watched file overrides the theme/scenario
// defaults via flat front-matter keys (difficulty lives on the file).
// `graceLost` (repeated scans tripping the ICE alert) cuts startAfter.
export function effTracer(tr, node, graceLost = 0) {
  return {
    seconds: node?.tracerSeconds ?? tr?.seconds ?? 30,
    penalty: node?.tracerPenalty ?? tr?.penalty ?? 7,
    startAfter: Math.max(0, (node?.tracerStartAfter ?? tr?.startAfter ?? 0) - graceLost),
    nocrackSeconds: node?.tracerNocrackSeconds ?? tr?.nocrackSeconds ?? 5
  }
}

// `check` scan quality from the roll margin vs checkDC:
//   >= DC+5 → precise · within 4 below → ambiguous · else → fail
//   (or a misleading "false" reading when checkMisleadsOnFail is set)
export function scanTier(roll, dc, misleads = false) {
  const margin = roll - dc
  if (margin >= 5) return 'precise'
  if (margin >= -4) return 'ambiguous'
  return misleads ? 'false' : 'fail'
}
