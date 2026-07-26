export type FitInput = {
  trust_tier?: string | null;
  risk_tier?: string | null;
  verification_status?: string | null;
};

export type FitFactor = { factor: string; value: string; delta: number };
export type FitResult = { score: number; base: number; factors: FitFactor[]; explanation: string };

const BASE = 40;
const MIN = 5;
const MAX = 99;

export function fitScore(input: FitInput): FitResult {
  const factors: FitFactor[] = [];
  let score = BASE;

  const trust = (input.trust_tier ?? '').toLowerCase();
  let trustDelta = 0;
  if (trust.includes('premium')) trustDelta = 25;
  else if (trust.includes('verified candidate')) trustDelta = 15;
  else if (trust.includes('listed')) trustDelta = 5;
  if (trust || trustDelta) factors.push({ factor: 'trust_tier', value: input.trust_tier ?? 'unknown', delta: trustDelta });
  score += trustDelta;

  const risk = (input.risk_tier ?? '').toLowerCase();
  let riskDelta = 0;
  if (risk === 'low') riskDelta = 5;
  else if (risk.includes('moderate')) riskDelta = -10;
  else if (risk.includes('high') || risk.includes('blocked')) riskDelta = -30;
  if (risk || riskDelta) factors.push({ factor: 'risk_tier', value: input.risk_tier ?? 'unknown', delta: riskDelta });
  score += riskDelta;

  const verification = (input.verification_status ?? '').toLowerCase();
  let verificationDelta = 0;
  if (verification === 'verified') verificationDelta = 15;
  else if (verification.includes('partially')) verificationDelta = 8;
  else if (verification.includes('unable')) verificationDelta = -10;
  if (verification || verificationDelta) {
    factors.push({ factor: 'verification_status', value: input.verification_status ?? 'unknown', delta: verificationDelta });
  }
  score += verificationDelta;

  const clamped = Math.max(MIN, Math.min(MAX, score));
  const parts = factors.filter((factor) => factor.delta !== 0)
    .map((factor) => `${factor.value} ${factor.delta > 0 ? '+' : ''}${factor.delta}`);

  return {
    score: clamped,
    base: BASE,
    factors,
    explanation: parts.length
      ? `Base ${BASE}, ${parts.join(', ')} = ${clamped}`
      : `Base ${BASE}, no scoring signals recorded = ${clamped}`,
  };
}

export function byFitDescending<T extends FitInput & { canonical_name?: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const difference = fitScore(b).score - fitScore(a).score;
    return difference || (a.canonical_name ?? '').localeCompare(b.canonical_name ?? '');
  });
}
