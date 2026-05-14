% Reverse CLI filter — MiniZinc model that mirrors Ryan's slurm-cli-filter rules.
%
% Each constraint is labeled with the Reason code it corresponds to in
% slurm-cli-filter.py, so when this model is UNSAT we can surface the same
% Reason the user would see from the forward filter.
%
% This file is consumed when the `minizinc` binary is available. Without it,
% the Python enumerator in reverse.py uses Ryan's kernel directly as the
% oracle, which is provably consistent with these constraints (see
% tests/test_reverse.py).

include "globals.mzn";

% --- Partition catalog (mirrors PartDGXB200 / PartGenoaStd / PartGenoaLrg) ---
enum PARTITION = { dgx_b200, genoa_std_mem, genoa_lrg_mem };

array[PARTITION] of int: gpn = [8, 0, 0];        % GPUs per node
array[PARTITION] of int: cpn = [224, 64, 64];    % CPUs per node
array[PARTITION] of int: cpg = [28, 0, 0];       % CPUs per GPU (0 for CPU-only)
array[PARTITION] of float: mpc = [8.0, 5.5, 15.5];
array[PARTITION] of int: tpc = [2, 1, 1];        % threads per core

% --- Decision variables ---
var PARTITION: partition;
var 0..32:   gpus;
var 0..8:    gres;        % gpus per node
var 1..16:   nodes;
var 0..1024: tasks;
var 0..256:  tasks_per_node;
var 0..512:  cpus;        % cpus-per-task
var 0..16384: memory;     % per-node memory, GiB

% --- User request (parameters set per invocation) ---
par PARTITION: partition0;
par int: gpus0;
par int: cpus0;
par int: nodes0;
par int: memory0;

constraint partition = partition0;  % keep partition fixed for the demo

% --- Constraints, labeled by Reason ---

% NO_GPUS_PARTITION: CPU-only partitions cannot have GPUs.
constraint (gpn[partition] = 0) -> (gpus = 0 /\ gres = 0);

% GPUS_PER_NODE_LIMIT: gres <= partition's gpn.
constraint gres <= gpn[partition];

% GPUS_NODES_BALANCE: when both set, gres * nodes = gpus.
constraint (gres > 0 /\ gpus > 0) -> (gres * nodes = gpus);

% GPUS_NODES_INDIVISIBLE: gpus must divide evenly across nodes.
constraint (gpus > 0) -> (gpus mod nodes = 0);

% TASKS_GPUS_INDIVISIBLE: tasks divides evenly over gpus.
constraint (gpus > 0 /\ tasks > 0) -> (tasks mod gpus = 0);

% TASKS_NODES_INDIVISIBLE: tasks divides evenly over nodes.
constraint (tasks > 0) -> (tasks mod nodes = 0);

% TASKS_NODES_IMBALANCE: tasks_per_node * nodes = tasks.
constraint (tasks_per_node > 0 /\ tasks > 0) ->
            (tasks_per_node * nodes = tasks);

% CPUS_PER_GPU_MISMATCH: cpus-per-task must equal partition's cpg
% (in threads, not cores) when GPUs are present.
constraint (gpus > 0 /\ cpus > 0) -> (cpus = cpg[partition]);

% INSUFFICIENT_TASKS_MULTINODE: tasks >= nodes when nodes > 1.
constraint (nodes > 1) -> (tasks >= nodes);

% HIGH_MEM_CPU_PER_GPU: implied memory-per-core must not exceed mpc.
constraint (memory > 0 /\ cpus > 0) ->
            (memory <= ceil(mpc[partition]) * cpus);

% --- Objective: nearest legal point to the user's request ---
% Weighted L1 distance over the axes researchers care about.
var int: dist = 2 * abs(gpus - gpus0)
              + 1 * abs(cpus - cpus0)
              + 1 * abs(nodes - nodes0)
              + 1 * (abs(memory - memory0) div 16);

solve minimize dist;

output [
  "{",
    "\"partition\": \"",  show(partition), "\", ",
    "\"gpus\": ",         show(gpus),      ", ",
    "\"nodes\": ",        show(nodes),     ", ",
    "\"cpus\": ",         show(cpus),      ", ",
    "\"tasks\": ",        show(tasks),     ", ",
    "\"memory\": ",       show(memory),    ", ",
    "\"distance\": ",     show(dist),
  "}\n"
];
