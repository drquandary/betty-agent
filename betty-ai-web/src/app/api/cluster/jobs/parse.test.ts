import { describe, expect, it } from 'vitest';
import { parseSqueue } from './parse';

// The route uses `squeue -u <user> -h -o "%i|%P|%j|%T|%M|%L|%R"`, so the `-h`
// flag suppresses headers. The parser sees only data rows. Field order is:
//   jobId | partition | name | state | elapsed | timeLeft | reasonOrNode

const REAL_OUTPUT = `
12345|dgx-b200|train_llama|RUNNING|1:23:45|6:36:15|gpu-node-03
12346|dgx-b200-mig|eval_bench|PENDING|0:00|2:00:00|(Resources)
12347_3|compute|array_step|RUNNING|0:05:12|0:54:48|cpu-node-12
`.trim();

describe('parseSqueue', () => {
  it('returns [] on empty input', () => {
    expect(parseSqueue('')).toEqual([]);
  });

  it('returns [] when stdout is whitespace only', () => {
    expect(parseSqueue('   \n\n\t\n')).toEqual([]);
  });

  it('parses a realistic multi-row squeue output', () => {
    const jobs = parseSqueue(REAL_OUTPUT);
    expect(jobs).toHaveLength(3);
    expect(jobs.map((j) => j.jobId)).toEqual(['12345', '12346', '12347_3']);
  });

  it('preserves all seven fields per row', () => {
    const jobs = parseSqueue(REAL_OUTPUT);
    expect(jobs[0]).toEqual({
      jobId: '12345',
      partition: 'dgx-b200',
      name: 'train_llama',
      state: 'RUNNING',
      elapsed: '1:23:45',
      timeLeft: '6:36:15',
      reasonOrNode: 'gpu-node-03',
    });
  });

  it('preserves SLURM array notation in the jobId', () => {
    const jobs = parseSqueue('12347_3|compute|arr|RUNNING|0:01|0:59|cpu-01');
    expect(jobs).toHaveLength(1);
    expect(jobs[0].jobId).toBe('12347_3');
  });

  it('preserves parenthesized reasons (e.g. "(Resources)")', () => {
    const jobs = parseSqueue('12346|dgx-b200|j|PENDING|0:00|2:00:00|(Resources)');
    expect(jobs[0].reasonOrNode).toBe('(Resources)');
  });

  it('skips trailing blank lines without emitting empty rows', () => {
    const stdout = '12345|dgx-b200|j|RUNNING|0:01|0:59|node-01\n\n\n';
    expect(parseSqueue(stdout)).toHaveLength(1);
  });

  it('skips a stray non-pipe line in the middle of valid rows', () => {
    const stdout = [
      '12345|dgx-b200|j1|RUNNING|0:01|0:59|node-01',
      'random noise without any delimiter',
      '12346|dgx-b200|j2|PENDING|0:00|1:00|(Priority)',
    ].join('\n');
    const jobs = parseSqueue(stdout);
    expect(jobs).toHaveLength(2);
    expect(jobs.map((j) => j.jobId)).toEqual(['12345', '12346']);
  });

  // The route passes `-h` to squeue so headers are suppressed at the source.
  // Still, defend against an upstream change: if a header row ever sneaks in,
  // the parser will treat it as data because it contains pipes. Documenting
  // current behavior here.
  // FIXME: parser cannot distinguish a header row ("JOBID|PARTITION|...") from
  // a data row — it would produce a SqueueJob with jobId="JOBID". The route
  // currently prevents this via `-h`; if `-h` is removed, this parser needs
  // an explicit header-skip pass.
  it('treats a leading header row as data (route relies on squeue -h)', () => {
    const stdout = [
      'JOBID|PARTITION|NAME|STATE|TIME|TIME_LEFT|NODELIST(REASON)',
      '12345|dgx-b200|j1|RUNNING|0:01|0:59|node-01',
    ].join('\n');
    const jobs = parseSqueue(stdout);
    expect(jobs).toHaveLength(2);
    expect(jobs[0].jobId).toBe('JOBID');
  });

  // FIXME: a `|` embedded in a job name (rare but legal in slurm) will be
  // split as if it were a delimiter, shifting all later fields left. Current
  // parser has no escaping. Documenting; fix is out of scope.
  it('splits on every | — embedded pipes in name corrupt later fields', () => {
    // Job name contains a literal pipe: `bad|name`. squeue -o doesn't escape.
    const line = '99999|dgx-b200|bad|name|RUNNING|0:01|0:59|node-01';
    const [job] = parseSqueue(line);
    // The parser sees 8 fields and assigns left-to-right, dropping the last.
    expect(job.jobId).toBe('99999');
    expect(job.partition).toBe('dgx-b200');
    expect(job.name).toBe('bad'); // truncated at the embedded pipe
    expect(job.state).toBe('name'); // shifted left
    // Later fields are now misaligned by one position.
    expect(job.elapsed).toBe('RUNNING');
  });

  it('handles missing trailing fields by filling empty strings', () => {
    // Only 3 fields supplied; remaining four should be ''.
    const jobs = parseSqueue('12345|dgx-b200|partial');
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toEqual({
      jobId: '12345',
      partition: 'dgx-b200',
      name: 'partial',
      state: '',
      elapsed: '',
      timeLeft: '',
      reasonOrNode: '',
    });
  });

  it('preserves empty middle fields rather than collapsing them', () => {
    // squeue can legitimately emit an empty reason (e.g. for a running job).
    const jobs = parseSqueue('12345|dgx-b200|j||0:01|0:59|');
    expect(jobs[0].state).toBe('');
    expect(jobs[0].reasonOrNode).toBe('');
  });

  it('trims surrounding whitespace from each line before parsing', () => {
    const stdout = '   12345|dgx-b200|j|RUNNING|0:01|0:59|node-01   ';
    const jobs = parseSqueue(stdout);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].jobId).toBe('12345');
    expect(jobs[0].reasonOrNode).toBe('node-01');
  });
});
