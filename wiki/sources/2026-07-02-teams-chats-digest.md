---
type: source
tags: [teams, digest, betty, authentication, pennkey, security, accounts, slurm, cli-filter, job-submit, deployment]
created: 2026-07-02
updated: 2026-07-02
related: [betty-auth-architecture, slurm-cli-filter, jaime-combariza, kenneth-chaney, jamie-schnaitter, glm-5.2, ryan-bradley]
status: current
---

# Teams Chats Digest — 2026-07-02

## One-line summary
PARCC Group thread on the Gangaram/Vineeth PennKey-deprovisioning login failure + a root-password rotation-policy debate; separately, [[kenneth-chaney]] opened a working meeting to **deploy the `cli_filter` and `job_submit` Slurm plugins** with AHEAD, and a terse 1:1 note that Ken needs a PennKey (to secure-share a credential).

## Content

### Gangaram / Vineeth login failure — PennKey deprovisioning
- **Jaime**: user **Gangaram** can't log in; `sudo` to the account returns `This account is currently not available` — "new to me." His former PI's ColdFront account looks active.
- **Ken**: he **may have just graduated**; his **PennKey is no longer active** on the Penn side — needs an extension through his PI/department.
- **Jaime**: he was a **radiology resident**, now has a **new faculty appointment since yesterday**; asked the user to check with their IT person.
- **Ken**: the login **shell is `/sbin/nologin`** — likely why `sudo` fails; **Vineeth must contact PMACS** to fix the PennKey setup.
- **Ken**: PennKey listing is **`NOT_ACTIVE`** — whoever **sponsors** it hasn't filed the proper paperwork; once done, access returns.
- **Jaime**: PennKey access "will be done automatically **but there may be a gap**." Appointment is **adjunct faculty → no account upgrade needed**; will continue collaborating with **Witschey**.
- **Jaime** (relaying a message to Vineeth, sig "Susan"): HR terminated him yesterday; the **OMA file** should have flipped access overnight automatically — asked him to verify today.
- **Ken**: the bigger issue — without a properly set-up PennKey he loses **more than PARCC**: **PennVPN, AirPennNet**, and other basic services.

### Root password rotation policy
- **Jaime → Jamie Schnaitter**: please work with **AHEAD** to **reset the root password**; proposed doing it **every 3 months** (security).
- **Jamie Schnaitter**: will **put in a ticket today**, but disagrees with fixed 3-month rotation — **regular password changes don't improve security (NIST 800-63)**. However a reset **is warranted here** because **AHEAD has had people leave** since the last change. Team should **review standards and set a policy**.
- **Jaime**: proposing 3 months but open to discussion; wants the periodic reset **documented**, "even more if people leave the group."

### Deploy cli_filter and job_submit plugins (meeting)
- **Ken** named a meeting **"Deploy cli_filter and job_submit plugins"** (started ~8:59 AM), inviting **Jamie Schnaitter + others** and **AHEAD/vendor guests Swapnil Ninave, Rahul Tiwari, Ryan Heath** (same vendor engineers as the Ceph work). Ryan Heath later left the chat.
- **Swapnil Ninave** posted the prod config path: **`/cm/shared/apps/slurm/etc/slurm/slurm.conf`**.
- Significance: `cli_filter` was previously a **client-side** Lua plugin distributed via `~/.bashrc`; `job_submit` is a **server-side** plugin (`JobSubmitPlugins=` in `slurm.conf`). Deploying both centrally = moving flag validation/policy from per-user opt-in to cluster-enforced. See [[slurm-cli-filter]].

### Ken 1:1 — PennKey (terse)
- **Ken**: "I need a PennKey" / "And I will secure share it over." Context not stated; most likely tied to the [[parcc-tokens-as-a-service]] key-minting for the Dr. Chatterjee beta lab (Ken mints keys and would secure-share the credential). `status: tentative` — attribution inferred, not confirmed.

### Later cycle (afternoon) — CLI memory, Cadence, jury duty, seed node, GLM 413

**PARCC Group:**
- **CLI default-memory feedback.** Jaime: the CLI could compute memory the old way — **tasks × MemPerCPU from `slurm.conf`** (8 cores → ~48 GB) — set **partition-independently** and not explicitly required (else an error/warning). **Ryan**: it's working as expected — **CPU nodes give 5.5 GB or 15.5 GB (in MB) per core; GPU partitions give 8 GB per CPU thread** — the idea is users needn't think about memory and use fewer flags; asked Jaime if he sees anything contradicting it. See [[slurm-cli-filter]].
- **Cadence licenses.** Jaime asked **Jamie Schnaitter** to check email for Cadence-license follow-ups — "maybe something changed on Betty in the last few weeks." Jamie: "I am replying to it now."
- **Jury duty.** Jeffrey reminded Jaime his **jury duty is July 9, one of the training days**; Jaime: "Got it. Good luck."
- **Seed node still unresolved.** Jamie Schnaitter: "Did we ever figure out the confusion with the **seed node**? Did we locate it after we figured out that the **pile of 1U machines wasn't ours**?" — i.e. the R7725 seed unit hasn't been confirmed found/racked (the 1U pile = the mis-delivered 4× R6725 bound for Penn Medicine; see the 7/1 Dell thread).
- **Seed node — Flex search empty (~4:18pm).** Ken: "**He wasn't able to find anything at Flex**." The Flexential-colo search for the R7725 seed node came up empty; the unit remains missing (escalate via Dell/Brendan, service tag `8FVY3J4`).

**Chaney 1:1 (Jeffrey's own messages):** the served GLM-5.2 (LiteLLM group **`zai-org/GLM-5.2-FP8`**) fails his agent runs with `litellm.APIError … Hosted_vllmException - **413 Request Entity Too Large**` (nginx); "our GLM **gets stuck**" and it "mentions its **context window being at 100k**" vs the real GLM — pointing to an ~100k / request-body ceiling on the serving stack. See [[glm-5.2]].
- **Ken's reply (~4:08pm): 100k is a regression.** Ken: "booo … I'll have to take a look. **I got it up to 800k before**" — the served GLM context was previously ~**800k tokens**, so the current ~100k is a config regression (favors the nginx/`max_model_len` explanation over a true model limit) and Ken will investigate restoring it. Jeffrey: "**That was with zcode**" — associating the prior 800k with the ZCode harness (`tentative`). See [[glm-5.2]].

## Pages touched
- Updated [[betty-auth-architecture]] — new "PennKey lifecycle: deprovisioning cascades to Betty" and "Root password rotation policy" sections.
- Updated [[slurm-cli-filter]] — "Server-side deployment (2026-07-02)" section + new "Default-memory contract (2026-07-02)" (5.5/15.5 GB per core CPU, 8 GB per thread GPU; Jaime's partition-independent-memory ask).
- Updated [[glm-5.2]] — served endpoint `413 Request Entity Too Large` / ~100k context ceiling; LiteLLM group still labeled `…GLM-5.2-FP8` post-NVFP4-migration; **Ken: ~100k is a regression from ~800k before** ("with zcode"), will look at restoring.

## See also
- [[betty-auth-architecture]] · [[slurm-cli-filter]] · [[glm-5.2]]
- [[jaime-combariza]] · [[kenneth-chaney]] · [[jamie-schnaitter]] · [[ryan-bradley]]
