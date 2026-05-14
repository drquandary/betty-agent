/**
 * Parser for `squeue -u <user> -h -o "%i|%P|%j|%T|%M|%L|%R"`.
 *
 * Lives outside route.ts because Next.js 15 rejects any non-route export from
 * a route module during build-time type validation.
 */

export interface SqueueJob {
  jobId: string;
  partition: string;
  name: string;
  state: string;
  elapsed: string;
  timeLeft: string;
  reasonOrNode: string;
}

export function parseSqueue(stdout: string): SqueueJob[] {
  return stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l.includes('|'))
    .map((line) => {
      const [jobId = '', partition = '', name = '', state = '', elapsed = '', timeLeft = '', reasonOrNode = ''] =
        line.split('|');
      return { jobId, partition, name, state, elapsed, timeLeft, reasonOrNode };
    });
}
