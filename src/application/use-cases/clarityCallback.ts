// callback_data grammar for the post-report clarity score ("clr:").
//
//   clr:<cycleKey>:<1-5>
//
// cycleKey is the ended cycle's start date (YYYY-MM-DD), so a tap on an old
// report scores that cycle, not the current one. Dependency-free like car:.

const CLR = /^clr:(\d{4}-\d{2}-\d{2}):([1-5])$/;

export const clarityCb = (cycleKey: string, score: number): string =>
  `clr:${cycleKey}:${score}`;

export function parseClarityCallback(
  data: string,
): { cycleKey: string; score: number } | null {
  const m = CLR.exec(data);
  return m ? { cycleKey: m[1]!, score: Number(m[2]) } : null;
}
