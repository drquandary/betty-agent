# raw/slurm_logs/ — Slurm log capture area

> Drop raw Slurm log files into `inbox/`. Run
> `make -C betty-ai/scheduling all` to parse + extract features.
> Parsed files land in `processed/`; originals move to `archive/`.

## Directory layout

```
raw/slurm_logs/
├── inbox/       <- new log files land here (via collect-slurm-logs.sh or manual scp)
├── processed/   <- JSON output from the parsers (gitignored)
└── archive/     <- raw files after successful parse (gitignored)
```

## Getting log files into inbox/

### Automated (preferred)

```bash
./betty-ai-web/scripts/collect-slurm-logs.sh
```

Requires a live SSH ControlMaster to Betty (do `ssh login.betty.parcc.upenn.edu`
once in a Terminal first to approve Duo).

### Manual

Run these on Betty, then scp the outputs into `inbox/`:

```bash
sinfo > sinfo-$(date +%Y%m%d%H%M).log
scontrol show reservation > scontrol-show-res-$(date +%Y%m%d%H%M).log
scontrol show nodes -o    > scontrol-show-nodes-$(date +%Y%m%d%H%M).log
sacct -a -S "$(date -d '7 days ago' +%Y-%m-%d)" -X --parsable2 \
  -o JobID,User,Account,Partition,QOS,Submit,Eligible,Start,End,\
Elapsed,Planned,State,ExitCode,ReqTRES,AllocTRES,ReqMem,ReqCPUS,ReqNodes,NodeList,Reason \
  > sacct-week-$(date +%Y%m%d%H%M).tsv
```

The `sacct` command's `-X --parsable2 -o <fields>` are not optional — the
default output omits `Eligible/Start/End`, without which we cannot compute
queue wait times.

## Filename conventions

The ingest dispatcher routes files by prefix:

| Prefix                  | Parser                    |
|-------------------------|---------------------------|
| `sinfo-*`               | `parse_sinfo`             |
| `scontrol-show-res-*`   | `parse_scontrol_res`      |
| `scontrol-show-nodes-*` | `parse_scontrol_nodes`    |
| `sacct-*`               | `parse_sacct`             |

Files not matching any prefix are logged and skipped.

## See also

- [`betty-ai/scheduling/README.md`](../../betty-ai/scheduling/README.md)
- [`betty-ai-web/scripts/collect-slurm-logs.sh`](../../betty-ai-web/scripts/collect-slurm-logs.sh)
- [`raw/docs/2026-04-24-scheduling-plan-v2-constrained-agent.md`](../docs/2026-04-24-scheduling-plan-v2-constrained-agent.md)
