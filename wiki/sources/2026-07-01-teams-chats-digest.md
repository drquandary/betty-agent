---
type: source
tags: [teams, digest, bradley, claude-science, rse, parcc-skills, tokens-as-a-service, permissions, vast, nfs4-acl, hardware, mig]
created: 2026-07-01
updated: 2026-07-01
related: [claude-science, ryan-bradley, jeffrey-vadala, parcc-skills-modules, parcc-tokens-as-a-service, vast-group-permissions, vast-storage, betty-cluster, jamie-schnaitter, kenneth-chaney, jaime-combariza]
status: current
---

# Teams Chats Digest — 2026-07-01

## One-line summary
Bradley↔Vadala 1:1 (2026-07-01T11:37–11:45Z): after a delayed-message mix-up, two real threads — the **ParccSkills 404** for Ryan is still unresolved (Jeffrey "idk why"), and a **Claude Science / RSE-positioning** discussion (Ryan wants PARCC's RSE services to respond to the "grad students will 10x with Claude Science" claim; Jeffrey notes the users are grad students; demo at their next sync).

## Source
- Digest: `knowledge/raw/digest_20260701T080602.json` (generated 2026-07-01T08:06:37). 9 chats; only **Bradley, Ryan Patrick** had new messages (13 new, ~11:37–11:45Z). The other 8 chats (self-chat, PARCC Group, Chaney, Ceph, Combariza, Schnaitter, Catch Up - RHOS, PARCC↔NVIDIA) had 0 new.

## What's new

### Transport-layer noise (not durable)
- Several messages were just Ryan and Jeffrey reconciling **out-of-order Teams delivery** — Ryan's messages arrived delayed, so "not really / which part?" refers to an earlier question ("do they want to eat our lunch"), not to anything new. Recorded here only so future readers don't mistake it for substance.

### ParccSkills 404 — still open (ops/access)
- Continues the 7/1 ~7:33am thread: Ryan still can't view ParccSkills. Jeffrey did **not** diagnose the cause — "Yeah idk, why a 404." So Ryan's collaborator access has **not** been re-granted after the repo went private (6/30). Re-invite for Ryan still owed. See [[parcc-skills-modules]].

### Claude Science — RSE positioning (durable, tentative)
- Framed as a **strategic/competitive** matter, extending the 6/30 first-impressions in [[claude-science]]:
  - **Ryan:** "flattering that people are spending a lot of effort to take best practices that research computing has refined over many years and then try to sell it back to us. we can make sure some of the RSE services respond to the idea that grad students are going to 10x their productivity with claude science."
  - **Jeffrey:** the people who **sign up and use it** will be **grad students** ("it's gunna be the grad students signing up and using this") — pins the audience for both Claude Science and PARCC's in-house counter-offering.
  - Both: **"we should prep for it."** Jeffrey to **demo it to Ryan at their next meeting** ("I'll show it to you at our meeting" — likely the 10am 7/1 training sync).
- Relevance: sharpens [[claude-science]] from "a product to try" into "a narrative PARCC's RSE services + [[parcc-skills-modules|ParccSkills]] / betty-toolkit / [[parcc-tokens-as-a-service]] should be positioned against."

---

## Second pull — 2026-07-01T10:12 (digest_20260701T101203.json)

`knowledge/raw/digest_20260701T101203.json` (generated 2026-07-01T10:12:39). 9 chats; 12 new across two: **Chaney, Kenneth P** (5) and **PARCC Group** (7).

### Tokens-as-a-service: first beta lab named (Chaney chat, durable)
All 5 messages are Jeffrey outbound, continuing the [[parcc-tokens-as-a-service]] thread:
- The lab is *"quite enthusiastic about getting a api key and a special TUI bot for them."* Jeffrey **asked Ken for a key** and proposed **attaching it to Dr. Anjan Chatterjee (Neurology)** as the owning PI — the **first named beta customer**.
- Jeffrey flagged a new requirement: *"I'll have to set up some sort of system that lets them know about reboots or down time … open to any ideas"* — a **maintenance/downtime broadcast** the lab bot will need (the served stack sits behind a single-point-of-failure LiteLLM gateway + cluster maintenance windows).
- "no rush." Ken had not replied in this pull.

### HOME-directory permission policy (PARCC Group, durable)
Jaime asked the team for the correct HOME-dir permissions, prompted by user **`cnman`** reporting *"she does not have a HOME dir"* though one exists with owner-only rwx. Resolution, filed to [[vast-group-permissions]]:
- **`0750` is the default**; homes should be **0700 or 0750 only** (Jamie Schnaitter).
- **Nothing in the "other" tier** (Ken: *"We just don't want anything in the 'other' category"*).
- **Share via project directories, not homes** (Jamie).
- When owner == group (as for `cnman`), 0750 vs 0700 is moot; a "missing home" there is likely login/mount/shell, not perms → separate investigation.
- Jaime's opening note: he'd *"been in meeting for the past 10 days"* and is catching up (pairs with the ticket-backlog item Jamie flagged the same day).

---

## Third pull — 2026-07-01T11:19 (digest_20260701T111840.json)

`knowledge/raw/digest_20260701T111840.json` (generated 2026-07-01T11:19:17). 9 chats; **10 new, all in PARCC Group** (~14:49–15:11Z).

### VAST NFSv4 ACLs — the `setfacl` equivalent (durable, filed to wiki)
Ryan Bradley: *"could somebody remind me if we have a `setfacl` equivalent for VAST? we (Jeffrey and I) are discussing best practices for making a shared folder in VAST with group read-write."* Answered by **Jamie Schnaitter**:
- **`nfs4_setfacl`** — set NFSv4 ACLs; **`nfs4_editfacl`** — edit the whole ACL directly (opens an editor).
- *"for NFSv4 it is all the same commands as for POSIX draft ACLs, but with `nfs4_` prepended. The ACEs are different though, as the permissions for v4 are different."*
- **Correction it implies:** Betty's VAST is NFS 4.2, so the POSIX `setfacl`/`getfacl` in [[vast-group-permissions]] Fix 4 were the wrong tool for VAST — the NFSv4 `nfs4_*` variants are canonical. Filed into [[vast-group-permissions]] and [[vast-storage]].

### Dell shipped the wrong servers — 4× R6725 vs 1× R7725 (durable hardware, tentative)
- **Ken:** *"Dell sent us more than one server and it doesn't seem to be the right one. They sent 4x R6725 instead of 1x R7725."* Spec (per R6725): **dual EPYC 9655 (96C/192T ea.), 1.5 TB DDR5, dual 100 Gbps Broadcom, 4× 3.2 TB NVMe SSD.** Ken is **racking them so PARCC isn't charged by Flexential**.
- **Jaime:** one of his emails is *"feedback for the R7725 seed program"* — so the intended R7725 was a **seed-program** unit. Filed to [[betty-cluster]] (Incoming hardware) + task to reconcile the order.

### OOD Jupyter kernel — Ryan will fix (ops)
- Relay of Jaime's earlier kernel-selection question; **Ryan:** *"apologies; we will fix this shortly. I thought I did it yesterday but something overwrote it."* So the kernel config was set and then clobbered (image rebuild / app update). Ryan owns the re-fix. Updates the 2nd-pull open question.

### Ops issues raised (action items, no wiki page yet)
- **MIG oversubscription:** Jaime — *"A user points that some MIG processes share a MIG. I see such a case now."* Multiple processes on one MIG slice (same class as the earlier GPU double-booking).
- **Runaway processes:** Jaime — user **`lwhyc`** has several processes running **~23 days, off the Slurm queue** ("a runaway???"). Login-node/stray processes to hunt and kill.

---

## Fourth pull — 2026-07-01T12:24 (digest_20260701T122459.json)

`knowledge/raw/digest_20260701T122459.json` (generated 2026-07-01T12:25:34). 9 chats; **6 new, all in PARCC Group** (~15:55–16:18Z). Both threads *revise* third-pull items rather than opening new ones.

### Dell shipment reframed — the 4 boxes are Penn Medicine's, not PARCC's (corrects third pull)
Jaime relayed a **Dell call**: the **4 servers are 99% for Penn Medicine, not PARCC**; Brendan is *"pretty sure we got an R7725."* So PARCC's real unit is the **R7725 seed box**, and the 4× R6725 were **mis-delivered to PARCC's Flexential colo**, not a Dell substitution of PARCC's order. Loose ends:
- Confirm whether **Dave Cohen is still at Flexential** (colo contact) — Ken offered to call him.
- **Service tag `8FVY3J4`** to hand to Brendan for lookup.
- **Flexential is checking for other packages**; one was addressed **"Attn Jaime C"**.
- Correction to third pull: don't rack the R6725s as PARCC hardware — route them to Penn Medicine. Filed back to [[betty-cluster]] (Incoming hardware).

### `lwhyc` 23-day runaway — premise questioned
Ken: *"Running for 23 days where? Most nodes should be rebooted at this point."* Recent reboots should have cleared any 23-day process, so the finding may be a **stale/misread uptime** rather than a real runaway — pin down the node before hunting.

## See also
- [[claude-science]]
- [[ryan-bradley]]
- [[parcc-skills-modules]]
- [[parcc-tokens-as-a-service]]
- [[vast-group-permissions]]
- [[vast-storage]]
- [[betty-cluster]]
- [[jamie-schnaitter]]
- [[kenneth-chaney]]
- [[jaime-combariza]]
- [[jeffrey-vadala]]
