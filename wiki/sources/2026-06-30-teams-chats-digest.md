---
type: source
tags: [teams, digest, chaney, glm, nvfp4, parcc-skills, reliability]
created: 2026-06-30
updated: 2026-06-30
related: [kenneth-chaney, jeffrey-vadala, glm-5.2, parcc-skills-modules]
status: current
---

# Teams Chats Digest — 2026-06-30

## One-line summary
Chaney↔Vadala 1:1 (2026-06-30T17:05–17:33Z): Ken **migrated GLM-5.2 serving to NVFP4** to cut token cost; Ken laid out his **reliability/human-time criteria** for evaluating Jeffrey's research-loop harness; Jeffrey switched ParccSkills **private** and **added Ken (`k-chaney`)**; Ken agreed to **lead a Betty field trip** and wants the team to **hash out skills curation** PARCC-wide.

## Source
- Digest: `knowledge/raw/digest_20260630T133322.json` (generated 2026-06-30T13:33:56). 9 chats; only **Chaney, Kenneth P** had new messages (37 new). The other 8 chats (PARCC Group, Bradley, Ceph, Combariza, Schnaitter, Catch Up - RHOS, PARCC↔NVIDIA, self-chat) had 0 new.

## What's new

### GLM-5.2 → NVFP4 migration (durable)
- Ken: *"token cost will come down under my watch — I migrated us to nvfp4 for glm 5.2."* The **NVFP4 build is now the served default**, replacing the fp8 build, with the explicit goal of **lower token cost**. This closes the 6/26 "weighing nvfp4 on 8 GPUs" open item → now done. Vision support on the NVFP4 build remains unconfirmed. See [[glm-5.2]].

### Reliability / human-time evaluation criteria for the harness (durable)
- Ken's framing for whether the multi-day [[parcc-skills-modules|research-loop]] is worth running:
  - Ryan is mainly pushing **reliability** — the bar for a tool that can be recommended/used.
  - The dominant cost is **human time, not tokens** — "you still spend time on it … the time is the bigger part"; the "running vs swimming across a river" optimization (Jeffrey: token-time × human duration × actual direct attention).
  - Gating questions: (1) reliable enough that the time/tokens aren't wasted? (2) if it fails, do we still learn something? — "the result out of the tools should be learning something, even if it fails."
  - Goal trajectory: trust it enough to **eventually hand to researchers** (risk = a researcher burning ~$50 tokens + ~$500 compute for nothing — true of any software).
  - **Scope:** Jeffrey only intended **internal use**; Ken says the same calculus applies internally.
- Jeffrey's counter-data (rachitk run): **3–4 days wall-clock, ~2–3 hrs direct attention**, little crunching off-hours, **auto-logged to the wiki/knowledge-graph**, improved the tool — "the proof will be in the puddin if the fix actually works." Ken still **needs to read the tool before giving real feedback**.

### ParccSkills repo access
- Ken hit a **404** because Jeffrey had set the repo **private**; Jeffrey **added Ken** (GitHub **`k-chaney`**) as a collaborator ("ok i added you"). Ken joins Ryan (`bradleyrp`). See [[parcc-skills-modules]].

### Skills curation as a PARCC-wide question
- Ken: *"we will all want to sit down and hash out the ways these skills should be curated in the PARCC environment overall. I have some initial ideas for testing this."* Elevates curation beyond the two-person repo merge to a group governance/testing decision.

### Betty field trip
- Ken **agreed to lead** the field trip for Jeffrey's wife's student ("We should be able to do that"). Schedule TBD; mind the 110 dB server-room hearing-protection caveat.

## See also
- [[glm-5.2]]
- [[parcc-skills-modules]]
- [[kenneth-chaney]]
- [[jeffrey-vadala]]
