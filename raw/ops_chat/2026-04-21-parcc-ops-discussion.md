# PARCC Ops Discussion — 2026-04-21

> Verbatim capture of a Slack/chat discussion between PARCC admins
> (Jaime Combariza, Kenneth Chaney, Jeff Vadala / jvadala) covering a
> GPU oversubscription incident on dgx002, SLURM gres.conf concerns,
> node-state shorthand, the `interact` script, an unrelated stray
> processes issue on dgx024, Nsight, Dell ETA, and an open question
> about SelectTypeParameters.

---

i need to add knowlege to the betty agent based on all this, help me plan a way to do this I am checking, I think VAST told me we needed to do it at the tenant level as this is a tenant setting

on dgx002, it seems two jobs are using gpu-5!!!  (inyoun and ttz2). I am not sure if a user is asking for device 5 explicitly.

Combariza, Jaime E.
on dgx002, it seems two jobs are using gpu-5!!!  (inyoun and ttz2). I am not sure if a user is asking for device 5 explicitly.
I can see this oversubscription issue now. The SLURM_CONF is correct but I can't find the gres.conf on the compute node. I will try to figure out why.

We should be using AutoDetect=nvml

poking around and it looks like both jobs are getting cuda_visible_devices 0, probably a cgroups issue since autodetect=nvml is set

Hmm I wonder if it is related to not having UniqueIds on the GRES. cgroup plugins are successfully loaded on that node.


[2026-04-17T10:17:54.937] debug:  Gres GPU plugin: Merging configured GRES with system GPUs
[2026-04-17T10:17:54.937] debug2: gres/gpu: _merge_system_gres_conf: gres_list_conf:
[2026-04-17T10:17:54.937] debug2:     GRES[gpu] Type:B200 Count:8 Cores(224):(null)  Links:(null) Flags:HAS_TYPE,ENV_NVML,ENV_RSMI,ENV_ONEAPI,ENV_OPENCL,ENV_DEFAULT File:(null) UniqueId:(null)
[2026-04-17T10:17:54.937] debug:  gres/gpu: _merge_system_gres_conf: Including the following GPU matched between system and configuration:
[2026-04-17T10:17:54.937] debug:      GRES[gpu] Type:B200 Count:1 Cores(224):0-55  Links:-1,0,0,0,0,0,0,0 Flags:HAS_FILE,HAS_TYPE,ENV_NVML File:/dev/nvidia0 UniqueId:(null)
[2026-04-17T10:17:54.937] debug:  gres/gpu: _merge_system_gres_conf: Including the following GPU matched between system and configuration:
[2026-04-17T10:17:54.937] debug:      GRES[gpu] Type:B200 Count:1 Cores(224):0-55  Links:0,-1,0,0,0,0,0,0 Flags:HAS_FILE,HAS_TYPE,ENV_NVML File:/dev/nvidia1 UniqueId:(null)
[2026-04-17T10:17:54.937] debug:  gres/gpu: _merge_system_gres_conf: Including the following GPU matched between system and configuration:
[2026-04-17T10:17:54.937] debug:      GRES[gpu] Type:B200 Count:1 Cores(224):0-55  Links:0,0,-1,0,0,0,0,0 Flags:HAS_FILE,HAS_TYPE,ENV_NVML File:/dev/nvidia2 UniqueId:(null)
[2026-04-17T10:17:54.937] debug:  gres/gpu: _merge_system_gres_conf: Including the following GPU matched between system and configuration:
[2026-04-17T10:17:54.937] debug:      GRES[gpu] Type:B200 Count:1 Cores(224):0-55  Links:0,0,0,-1,0,0,0,0 Flags:HAS_FILE,HAS_TYPE,ENV_NVML File:/dev/nvidia3 UniqueId:(null)
[2026-04-17T10:17:54.937] debug:  gres/gpu: _merge_system_gres_conf: Including the following GPU matched between system and configuration:
[2026-04-17T10:17:54.937] debug:      GRES[gpu] Type:B200 Count:1 Cores(224):56-111  Links:0,0,0,0,-1,0,0,0 Flags:HAS_FILE,HAS_TYPE,ENV_NVML File:/dev/nvidia4 UniqueId:(null)
[2026-04-17T10:17:54.937] debug:  gres/gpu: _merge_system_gres_conf: Including the following GPU matched between system and configuration:
[2026-04-17T10:17:54.937] debug:      GRES[gpu] Type:B200 Count:1 Cores(224):56-111  Links:0,0,0,0,0,-1,0,0 Flags:HAS_FILE,HAS_TYPE,ENV_NVML File:/dev/nvidia5 UniqueId:(null)
[2026-04-17T10:17:54.937] debug:  gres/gpu: _merge_system_gres_conf: Including the following GPU matched between system and configuration:
[2026-04-17T10:17:54.937] debug:      GRES[gpu] Type:B200 Count:1 Cores(224):56-111  Links:0,0,0,0,0,0,-1,0 Flags:HAS_FILE,HAS_TYPE,ENV_NVML File:/dev/nvidia6 UniqueId:(null)
[2026-04-17T10:17:54.937] debug:  gres/gpu: _merge_system_gres_conf: Including the following GPU matched between system and configuration:
[2026-04-17T10:17:54.937] debug:      GRES[gpu] Type:B200 Count:1 Cores(224):56-111  Links:0,0,0,0,0,0,0,-1 Flags:HAS_FILE,HAS_TYPE,ENV_NVML File:/dev/nvidia7 UniqueId:(null)

If there's an easy way to recreate this, it will be much easier to test.

gres.conf is not symlinked to the same location as slurm.conf in /etc/slurm … usually they are bundled together but I don't know if /etc/slurm is the ground truth

On Modules.  If I use explicitly salloc -p genoa.. --pth bash  it seems the session sources Lmod correctly. If I use the script "interact"  it does not even though it executes the same command, odd but checking

At, /bin/bash -i will do it

So since the interact script has "-i", it's basically reloading the profile, the same way that it would be loaded when you go to the login node. Is there a reason we would want that? usually people want to sort of "drop in" to an interactive session and inherit everything they've already loaded. That's why the default behavior with all srun is to just inherit everything from the BASH environment and not kick off the profile again.

Chaney, Kenneth P  if you have time could you check dgx024?  ldugan is running some processes but no slurm job.  I am pretty suer this morning it was allocated just to jojolee.

Looking at the process tree right now

I'll reach out because this look a bit weird and non standard to me

           5359912  dgx-b200     bash  jojolee  R   17:27:39      1 dgx024

There is a slurm job there though

does anyone know what the "mix-" state (sinfo) is?

That will show up if not all of the resources for a node are in use. It is in-between idle and alloc.

really!! then what is the difference between "mix" and "mix-"

and I did check yesterday and some nodes had. 8 gpus in use and still showed as mix.

Let me look at what the dash means

That is curious

A * means that the node can't communicate with the controller

It seems like a dash means that the node is actively being planned. But I'm curious why it wouldn't just say PLANNED. What I use parcc_sfree.py --by node, I see it as MIXED+PLANNED


*
The node is presently not responding and will not be allocated any new work. If the node remains non-responsive, it will be placed in the DOWN state (except in the case of COMPLETING, DRAINED, DRAINING, FAIL, FAILING nodes).
~
The node is presently in powered off.
#
The node is presently being powered up or configured.
!
The node is pending power down.
%
The node is presently being powered down.
$
The node is currently in a reservation with a flag value of "maintenance".
@
The node is pending reboot.
^
The node reboot was issued.
-
The node is planned by the backfill scheduler for a higher priority job.

The slurm docs mention these shorthand state codes that are modifiers to the listed state

Just FYI I am trying a simple test to reproduce the GPU oversubscription problem, submitting to nodes with state alloc, and it's not letting me in (go figure it did this momentarily but I had a typo! and now I cannot reproduce the issue). Perhaps there is some other reason SLURM was letting jobs double book the GPUs on Friday. My original theory was missing /etc/slurm/gres.conf.

I forgot to ask about GPU profiling, Nsight. The plan was to install/activate it on a GPU node and have the users test it.  I think Ahead needed to do soemthing

I got email back from Dell. Dellis trying to get approval for the quote sent to us. However, they do agree the ETA is very concerning.

so I am going through my suggestions for slurm.conf. Quite different.  Should we be using SelectTypeParameters=CR_Pack_Nodes (It is set to CR_Core_Memory

This is when I would like to have a test cluster
