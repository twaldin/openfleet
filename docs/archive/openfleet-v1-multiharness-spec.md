# OpenFleet v1 Multi-Harness Spec

Status: draft implementation spec

## Purpose

OpenFleet v1 is a multi-harness control plane for persistent and ephemeral agent sessions.

It is designed so that:

- the same logical agent identity can run on different execution harnesses
- the top-level orchestrator can use the highest-performing native frontier harness available
- worker sessions can run on OpenCode, Codex, Claude Code, and later other runtimes
- canonical state, tasks, jobs, workflows, and events remain outside any single harness

## Core principle

Harnesses are execution backends, not the source of truth.

OpenFleet core owns:

- agent identity
- runtime profiles
- session registry
- task/job/workflow state
- canonical events
- routing and rate-limit state

Ops and remote adapters consume that state.

## Recommended v1 topology

### Orchestrator

Primary target:

- `cairn` in Codex / GPT-5.4

Secondary compatible orchestrator:

- `cairn` in Claude Code / Opus

OpenCode may still be used as an orchestrator client, but it is no longer the required top-level runtime.

### Recommended operator/provider policy

For the live `cairn` deployment, the default strategy should optimize for reliability and native-harness performance:

- primary orchestrator: `codex/gpt-5.4`
- secondary/fallback orchestrator: `claude-code/opus`
- strong local coding worker: `opencode/qwen32b` on the MacBook
- persistent remote workers: OpenCode sessions on ThinkPad-class hosts
- cheap cloud or bounded local models for medium/low-risk worker reasoning

Practical implication:

- do not depend on Claude-only orchestration for always-on fleet control if rate limits make it unreliable
- do not depend on tiny local models for high-judgment autonomous operations
- use frontier native harnesses for orchestration, and OpenCode for durable worker runtime

### Workers

Initial worker runtime target:

- OpenCode local workers on MacBook
- OpenCode remote workers on ThinkPad 1

Later worker runtime targets:

- Claude Code workers
- Codex workers

## Repo split

### `~/openfleet`

Reusable product/runtime.

Suggested structure:

- `core/` — canonical state, jobs, workflows, registry, routing, adapters
- `ops/` — observability and operator interaction
- `remote/` — Discord/Telegram/web/mobile/SSH adapters
- `docs/` — architecture, schemas, bootstrap guides
- `examples/` — deployment examples

### `~/cairn`

Deployment repo.

Owns:

- deployment config
- agent packages
- prompts/jobs
- workspace-specific compatibility scripts

### `~/.openfleet`

Canonical runtime state.

Owns:

- sessions
- events
- jobs
- workflows
- registry
- runtime health and rate-limit state

## Deployment UX model

OpenFleet v1 is assistant-led by default.

Each deployment should have:

- one primary assistant/orchestrator channel as the default human interface
- one or more domain-agent channels for direct specialist interaction
- optional summary/blocker channels for aggregated state

### Default human interaction

Humans primarily message the deployment assistant.

The assistant:

- interprets the request
- creates tasks/jobs/workflows in core
- delegates to domain agents
- summarizes state and blockers back to humans

### Direct specialist interaction

Humans may also message specialist agents directly.

Examples:

- answer a blocker directly in a monitor/coder/trader channel
- correct a worker without going through the assistant
- interact with a scheduled agent in its own dedicated channel

This is a supported feature, not an exception.

### Design rule

The assistant is the default interface, not the only interface.

## Channel routing model

OpenFleet should follow a per-agent channel model similar to the current claudecord UX.

### Required channel classes

- assistant channel
- persistent domain-agent channels
- optional blocker summary channel
- optional workflow/task-specific channels or threads

### Routing policy

- new human requests default to the assistant channel
- persistent agents may post directly into their own channels
- blocked agents may ask unblock questions in their own channels
- the assistant may batch or summarize blockers in the assistant channel or a dedicated blocker channel

### Human-facing channels

Persistent domain agents are human-facing by default.

Example:

- a morning blocker digest belongs in the blocker/daily channel, not always in the assistant channel
- a VPS incident belongs in `#monitor` / `#code-status`
- a market summary belongs in `#stock-monitor` / `#investing`

This keeps the system legible without forcing all communication through the assistant.

## Arbitrary task model

OpenFleet is not GitHub-only.

GitHub issues are a first-class source, but v1 must support arbitrary tasks created through the assistant or external adapters.

Examples:

- GitHub issue remediation
- student study-plan workflow
- Kanban/task-board work item
- sales lead research
- product ideation
- personal todo chain

### Core rule

Task ingestion must be generic.

The assistant or an adapter should be able to create a task from:

- human chat message
- GitHub issue
- schedule/cron
- API/webhook
- plain text or imported note

GitHub is the first fully supported task source, but not the only valid task type.

## Canonical blocker model

Blockers must be stored as structured state, not only as text in chat.

Minimum blocker fields:

- `blocker_id`
- `task_id`
- `job_id`
- `workflow_id`
- `agent_id`
- `summary`
- `question`
- `blocked_on_type` (`human | system | dependency | external`)
- `blocked_on_id`
- `created_at`
- `updated_at`
- `urgency`
- `status` (`open | answered | cleared | stale`)

### Blocker behavior

- blocked agents may post the blocker directly in their own channel
- the assistant may summarize multiple blockers centrally
- the system should support a “what is currently blocked?” query without scraping messages
- if a human directly answers the blocked agent, core should attach that answer to the blocker and resume the task/job/workflow

### Heartbeat skip behavior

If a task/job is blocked on a real human or dependency, repeated heartbeats should not waste tokens repeating the same no-op state.

Instead core should:

- mark the blocker as open
- suppress repeated runs until state changes or reminder policy says otherwise
- wake immediately when a relevant human reply arrives

This is a core feature of the scheduler/state machine.

## Lifecycle policy

OpenFleet should support three lifecycle modes.

### Persistent

Use for:

- assistant/orchestrator
- always-on human-facing domain agents
- agents with frequent direct human interaction

Properties:

- stable session identity
- direct channel binding
- resumable after crash/restart

### Warm-resumable

Use for:

- recurring scheduled agents
- domain agents that benefit from continuity but do not need infinite hot context

Properties:

- stable state and metadata
- session may be rotated/recreated
- rehydration from canonical state, recent summaries, and agent package files

This is the preferred mode for many production agents such as monitor/trader/stock-monitor.

### Ephemeral

Use for:

- coder
- evaluator
- reviewer
- one-off researcher/fixer tasks

Properties:

- fresh context by default
- task-bounded lifespan
- output returned into canonical state/events

### Design rule

Do not force one lifecycle model across all agents.

The deployment should choose the right lifecycle per role.

## Deployment unit

Recommended v1 deployment unit:

- one deployment per person or tightly scoped team unit
- one primary assistant per deployment
- multiple domain agents under that deployment

This supports both:

- single-user personal assistant deployments
- small multi-human shared deployments

The same deployment can serve multiple humans through different channels without requiring one orchestrator per human.

## Canonical state schemas

OpenFleet v1 should treat the following objects as first-class canonical state.

### Task

Minimum task fields:

```json
{
  "task_id": "task_01J...",
  "title": "Prepare study plan for Friday exam",
  "source": {
    "type": "assistant_message",
    "channel": "assistant",
    "author_id": "user_tim"
  },
  "status": "active",
  "assignee": "cairn",
  "workflow_id": "wf_01J...",
  "blocker_ids": [],
  "approval_ids": [],
  "created_at": "...",
  "updated_at": "..."
}
```

Required semantics:

- every user-requested or adapter-ingested unit of work becomes a task
- a task may or may not have a workflow
- a task can accumulate blockers and approvals over time
- the assistant can create tasks from arbitrary text or external systems

### Blocker

Minimum blocker fields:

```json
{
  "blocker_id": "blk_01J...",
  "task_id": "task_01J...",
  "job_id": "job_01J...",
  "workflow_id": "wf_01J...",
  "agent_id": "monitor",
  "summary": "Need confirmation before deploy",
  "question": "Should I deploy this to production now?",
  "blocked_on_type": "human",
  "blocked_on_id": "user_tim",
  "urgency": "high",
  "status": "open",
  "channel_binding": "thread://task_01J...",
  "created_at": "...",
  "updated_at": "..."
}
```

Rules:

- a blocker is a canonical object, not only a message
- blocked jobs/workflows should not keep burning tokens with repetitive no-op heartbeats
- a blocker may be human, system, dependency, or external

### Approval

Minimum approval fields:

```json
{
  "approval_id": "apr_01J...",
  "task_id": "task_01J...",
  "job_id": "job_01J...",
  "workflow_id": "wf_01J...",
  "agent_id": "coder",
  "action_type": "merge_deploy",
  "summary": "Merge PR #123 and deploy to production",
  "risk_class": "high_impact",
  "status": "pending",
  "channel_binding": "thread://task_01J...",
  "requested_at": "...",
  "resolved_at": null,
  "resolved_by": null,
  "resolution": null
}
```

Rules:

- approvals are canonical objects in core
- approvals block workflow progression until resolved
- approvals never auto-approve in v1
- approvals may remind or escalate by policy, but remain pending until human action

### Job

Jobs remain the executable unit assigned to one agent/profile.

Additional expectation:

- a job may reference a thread/channel binding for human interaction
- a job may emit zero or more blockers and approvals

### Workflow

Workflows remain the multi-step graph/state machine for a task.

Additional expectation:

- a workflow may be paused by blockers or approvals
- a workflow resumes when core resolves the blocker/approval and advances the next step

## Thread and channel lifecycle

OpenFleet v1 should create ephemeral task-scoped threads/channels on first agent dispatch, not at task creation time.

### Rules

- persistent agents get stable dedicated channels
- ephemeral agents get task-scoped threads/channels on first dispatch
- the thread/channel becomes the default context for blocker replies, approvals, and targeted corrections

### Why

This keeps the assistant channel clean while preserving direct interaction when useful.

### Channel binding

Core should store a canonical channel/thread binding object for tasks/jobs/approvals/blockers.

Example:

```json
{
  "binding_id": "bind_01J...",
  "surface": "discord",
  "kind": "thread",
  "channel_id": "...",
  "task_id": "task_01J...",
  "agent_id": "coder",
  "persistent": false
}
```

## Natural-language resolution model

Humans should be able to unblock or approve work in natural language.

### Default matching rule

- the latest open blocker or approval in the current channel/thread is the primary resolution target

### Resolution behavior

- if unambiguous, core applies the reply to that blocker/approval
- if ambiguous, the assistant or agent should ask a clarifying question
- direct replies in a task thread should not require ids or strict command syntax in the common case

## Human-facing surfaces

The same canonical blocker/approval/task state should fan out to three surfaces:

### 1. Agent channel/thread

Used for direct local interaction with the active specialist.

### 2. Assistant summary

Used for batched summaries such as:

- what is currently blocked
- what happened while you were away
- what approvals need attention

### 3. Ops/dashboard

Used for full observability and operator debugging.

## Reminder and escalation policy

Reminder and escalation behavior is policy-driven per blocker or approval type.

Examples:

- deploy approvals may remind quickly and escalate to assistant summary
- study-plan blockers may wait until next scheduled check-in
- monitor outages may post direct urgent alerts immediately

### Core rule

No repeated noisy reminders by default.

Instead:

- one initial blocker/approval message
- then silence until state changes or reminder policy fires

## Approval-gated action classes

OpenFleet v1 should treat the following as approval-gated by default:

- merge/deploy
- spending money
- external/public posting
- destructive operations

These are the same conceptual class: high-impact irreversible actions.

## Immediate design consequence

The scheduler/state machine must understand:

- blocked vs runnable jobs
- pending approvals vs free progression
- per-channel reply context
- reminder/escalation policies by type

This is a core responsibility, not a prompt-only behavior.

## Canonical agent package

Each logical agent is defined once.

Recommended package shape:

```text
agents/<agent-id>/
  agent.json
  core.md
  state.md
  jobs/
  prompts/
```

### `agent.json`

Declares:

- `agent_id`
- `role`
- `jobs_supported`
- `required_capabilities`
- `default_profile`
- `allowed_profiles`
- `state_paths`
- `interfaces`

Additional recommended fields:

- `lifecycle`
- `default_channel_policy`
- `default_prompt_mode`
- `default_hydration_policy`
- `required_tools`
- `optional_tools`
- `required_capabilities`
- `runtime_overrides`

### `core.md`

Stable identity and invariants.

### `state.md`

Mutable role-specific state.

### `jobs/`

Named job templates or job contracts.

### `prompts/`

Reusable prompt templates used by adapters/harness projections.

## Agent package authoring

OpenFleet v1 should make it easy for a deployment owner or assistant to define a new agent type without hand-crafting every harness-specific file manually.

### Required authoring goal

The deployment owner or assistant should be able to define:

- a new agent identity
- its role and lifecycle
- its default tools/capabilities
- its jobs/prompts/state files
- its runtime profile preferences

and have OpenFleet generate or project the harness-specific representations.

### New agent teammate creation

At minimum, OpenFleet should support creating a new agent teammate type from canonical files, then projecting that to:

- OpenCode agent config
- Codex bootstrap/hydration prompt
- Claude Code prompt/instruction projection

This is a core product feature, not a manual migration chore.

## Prompt hydration model

Core should be responsible for building good prompts/hydration payloads for agents.

The orchestrator may request a dispatch, but the canonical hydration logic belongs in OpenFleet core.

### Hydration inputs

At dispatch time, core should compose prompts from:

1. canonical agent package
   - `core.md`
   - `state.md`
   - selected `jobs/*`
   - selected `prompts/*`
2. task/job/workflow context
3. blocker/approval context if relevant
4. runtime profile / harness projection rules
5. recent event summary if warm-resumable

### Persistent agent hydration

Persistent agents should receive:

- stable identity
- current mutable state
- recent context summary
- the current job or incoming message

They should not be rehydrated from scratch on every small interaction unless the session is rotated.

### Warm-resumable hydration

Warm-resumable agents should receive:

- stable identity
- saved state
- compressed summary of recent activity
- current trigger payload

This is the default for monitor/trader/stock-monitor style agents.

### Ephemeral hydration

Ephemeral agents should receive:

- stable role identity
- task/job-specific context
- minimal relevant state
- any required repo or issue/task context

They should avoid excess baggage and prefer fresh task-specific prompts.

## Prompt quality responsibilities

OpenFleet core should provide the scaffolding and composition rules for good prompts.

The orchestrator should still be able to:

- request a dispatch override
- add situational instructions
- create a brand-new task or teammate type

But it should not need to reinvent the full hydration structure every time.

## Harness-specific projections

The same canonical agent package must be projected differently for different harnesses.

### Examples

- OpenCode projection may generate `.opencode/agents/*.md`
- Claude Code projection may generate Claude-oriented instruction bundles or bootstrap text
- Codex projection may generate Codex bootstrap/system prompt content

### Design rule

Canonical identity stays the same.

Projection logic adapts to harness constraints without changing the logical agent.

## Skills, MCP, tools, and plugins

OpenFleet should distinguish between:

- canonical agent capabilities
- harness-specific capability projection

### Canonical capability declaration

At the agent level, declare what the agent needs conceptually, e.g.:

- filesystem read/write
- shell access
- git access
- web research
- code review
- style cleanup
- image analysis

### Harness-specific projection

Core or the adapter decides how that capability is satisfied per harness.

Examples:

- a writing agent may request `style_cleanup`
  - Claude Code projection may enable or recommend `stop-slop`
  - another harness may use a different prompt fragment or tool
- a design agent may request `image_analysis`
  - one harness may use MCP/image tools
  - another may rely on built-in multimodal support

### MCP / skills / tools policy

Per-agent tool configuration should be canonical in intent, but projected per harness in implementation.

That means:

- do not hardcode `stop-slop`, MCP names, or plugin names into canonical identity unless they are truly universal
- instead, declare capability intent and map it to harness-native features in the adapter/projection layer

### Per-agent overrides

OpenFleet should still support per-agent overrides for:

- required MCP servers
- required plugins
- required tool access
- required style/skill behaviors

But these overrides should be normalized through canonical capability intent when possible.

## Capability projection model

OpenFleet v1 should use a core-defined capability projection table.

### Design rule

- canonical agent packages declare capability intent
- OpenFleet core or adapter projection maps that intent to harness-native tools, MCP servers, skills, plugins, or prompt fragments
- per-agent overrides may refine the mapping, but the default mapping lives in core

This prevents every agent package from needing to hand-maintain its own harness-specific tool matrix.

### Example

Canonical capability:

- `style_cleanup`

Harness projections:

- Claude Code: add `stop-slop` guidance or equivalent
- OpenCode: add an OpenCode-native writing/style prompt fragment
- Codex: add the Codex-specific style constraints or tool hints

## Approval UX model

Approvals should be human-readable first.

### Default v1 approval surface

- natural language summary in the relevant channel/thread
- optional richer UI controls later (buttons, reactions, quick actions)

### Design rule

Approvals must work well in plain text chat even before richer adapter controls exist.

## Permission prompt model

Harness-specific permission prompts should be normalized into canonical permission objects in core.

Those permission objects should then surface immediately in the relevant agent/thread context.

### Required behavior

- core records the permission object canonically
- the relevant agent/task thread gets the permission request summary
- ops shows the same permission object
- assistant may summarize if useful, but the canonical object is the source of truth

This keeps security-sensitive interaction visible and actionable without relying only on debug tooling.

## New agent creation workflow

In v1, new agent types should be created through:

1. assistant-generated draft from canonical role template
2. human review of the generated agent package artifact
3. explicit apply/activation

### Design rule

Assistant may draft new agents freely, but durable agent creation should remain a reviewable artifact, not an invisible mutation.

## Template evaluation policy

Template changes should be tested before becoming defaults.

### Minimum v1 evaluation approach

- golden tasks
- lightweight regression checks
- manual review where needed

Golden tasks should cover representative role behavior, blockers, approvals, and output contract adherence.

### Design rule

Do not promote major template changes to default production behavior without at least a small regression pass.

## Spec stop condition for v1

After this architecture layer, OpenFleet v1 should return to implementation.

Remaining uncertainty should be resolved through implementation plus validation, not endless abstract design.

## Post-turn continuation policy

OpenFleet v1 should include an explicit post-turn continuation policy.

The goal is to prevent the orchestrator or persistent agents from either:

- stopping too early while runnable work still exists
- or continuing wastefully when they are genuinely blocked or idle

### Canonical continuation outcomes

- `continue`
- `wait`
- `stop`

### Minimum decision inputs

- whether runnable jobs exist
- whether workflows are active
- whether the current task/job is blocked
- whether pending approvals exist
- whether the agent is waiting on a human or dependency
- whether the agent/session has a scheduled next wake time instead of immediate work

### Core rules

- if runnable work exists and no blocker/approval prevents progress, return `continue`
- if work exists but is blocked on human/dependency/approval, return `wait`
- if no meaningful runnable work exists, return `wait`
- return `stop` only when a task/workflow is complete or the session should intentionally terminate/rotate

### Design rule

This policy belongs in core state/logic, not only in freeform prompt wording.

### Important limitation

The continuation policy may still need an external trigger mechanism (scheduler, harness callback, or self-prompting adapter) to re-enter the orchestrator/agent, but the decision itself must be canonical and inspectable.

## Best-practice templates

OpenFleet should ship strong starter templates for:

- assistant/orchestrator
- coder
- evaluator
- monitor
- trader
- researcher

These templates should define:

- canonical package shape
- lifecycle default
- hydration policy
- output schema expectations
- approval/blocker behavior

The quality of these starter templates is a core part of the product.

## Anti-recursion design rule

OpenFleet should avoid turning into a system where AI repeatedly writes freeform instructions for AI to write more instructions for AI.

That pattern leads to prompt drift, slop, and brittle behavior.

### Required discipline

1. canonical structured schemas first
2. versioned human-designed templates second
3. bounded AI-authored deltas third

### What should be schema-driven

- agent manifest
- task/job/workflow objects
- blocker and approval objects
- runtime profiles
- capability intent

### What should be template-driven

- orchestrator baseline
- coder baseline
- evaluator baseline
- monitor baseline
- researcher baseline
- trader baseline

### What AI may generate

AI may:

- fill in task/job-specific prompt context
- draft a proposed new agent package
- suggest edits to templates
- synthesize hydration from canonical inputs

AI should not freely redefine the whole prompt architecture for the fleet on each run.

## Projection/compiler model

OpenFleet should prefer deterministic projection from canonical agent packages into harness-specific forms.

Examples:

- canonical agent package -> OpenCode agent file
- canonical agent package -> Codex bootstrap prompt
- canonical agent package -> Claude Code instruction bundle

The projection layer should be rule-based and reviewable.

## Review and evaluation requirements

New or materially changed agent templates should be treated as artifacts that can be:

- reviewed by a human
- diffed
- tested against golden cases
- evaluated for regression before becoming the default

### Design rule

If an AI-generated change alters long-lived agent identity, prompt structure, or capability assumptions, it should normally become an explicit reviewable artifact instead of silently mutating production behavior.

## Agent internals model

OpenFleet v1 should separate stable role identity, task-specific framing, mutable state, and history compression.

### Stable role template

The stable role template should mainly contain:

- invariants
- escalation rules
- approval rules
- output norms
- communication style constraints
- hard boundaries on what the agent should not do

It should not try to carry most situational behavior.

### Design rule

Stable role templates are for long-lived behavioral rules, not large evolving instructions.

## Job template model

Job templates should mainly contain:

- task framing
- success criteria
- required outputs
- key task-specific constraints
- completion rules
- task-specific escalation triggers if needed

### Design rule

Job templates define what good completion looks like for this unit of work.

They should not contain the entire system architecture or permanent role identity.

## Structured per-agent state

Per-agent mutable state should mainly contain:

- current operational facts
- open work summaries
- recent relevant summary
- active blockers
- pending approvals relevant to the agent
- current mode or focus if needed

It should not become a giant narrative journal or a duplicate of the full event history.

## Output contract model

Default output style should be:

- structured output first
- concise human summary second

### Recommended pattern

Every job result should produce:

1. machine-usable structured output
2. one concise human-readable summary line

This supports both:

- automated actions/workflow transitions
- readable channel updates and operator UX

## Escalation threshold

Agents should escalate instead of continuing when:

- required context is missing
- confidence/actionability is too low
- approval is required
- a real blocker exists
- an external dependency is blocking progress

### Design rule

Agents should not thrash through ambiguity.

When ambiguity, missing context, or blocked dependencies make further work low-confidence, they should create or update a blocker/approval and stop.

## Memory compression model

Core keeps raw history.

Agents receive compressed relevant summaries.

### Rules

- canonical event/task/workflow history remains raw in core
- hydrated agents receive summarized relevant context
- agents should not be forced to reread large raw histories by default
- warm-resumable agents should use compressed summaries plus current state

### Design rule

Raw history is for source of truth and debugging.

Compressed summaries are for agent hydration.

## Practical template split

For each agent, OpenFleet should conceptually separate:

### 1. Role template

- stable identity
- invariants
- escalation behavior
- output norms

### 2. Job template

- task framing
- success criteria
- required structured output
- task constraints

### 3. Mutable state

- current facts
- open work
- blockers
- recent summary

### 4. History summary

- compressed relevant context derived from canonical history

This is the preferred v1 mental model for agent hydration and authoring.

## Runtime profiles

The model/harness/host choice is not the agent identity.

It is a separate runtime profile.

Example shape:

```json
{
  "profile_id": "codex-gpt54-orchestrator",
  "harness": "codex",
  "provider": "openai",
  "model": "gpt-5.4",
  "host": "macbook",
  "cost_class": "high",
  "latency_class": "medium",
  "tool_capabilities": ["shell", "git", "edit"],
  "role": "orchestrator"
}
```

Examples:

- `codex-gpt54-orchestrator`
- `claude-opus-orchestrator`
- `opencode-qwen32b-coder`
- `opencode-thinkpad-monitor`
- `cheap-cloud-monitor-reasoner`

### Default profile policy

Agents may have a default profile, but not a permanent hardcoded model.

Recommended policy:

- same logical agent identity may run on multiple harnesses
- profile selection happens per job or per persistent session assignment
- persistent sessions are usually pinned to one selected profile until rotated
- changing a persistent session's model is normally a session replacement/rebind event, not an in-place hot swap

This keeps identity stable while allowing routing flexibility.

## Harness adapter contract

Each harness must implement the same minimum adapter contract.

Required operations:

- `create_session`
- `resume_session`
- `send_message`
- `read_messages`
- `get_status`
- `attach` or `tail`
- `interrupt`

Optional later operations:

- `stream_messages`
- `tool_state`
- `cost_usage`
- `token_usage`

### Adapter responsibilities

- map canonical OpenFleet session requests into harness-native actions
- map harness outputs back into canonical OpenFleet events
- detect and surface rate limits, auth failures, and degraded states
- never become the source of truth for workflow state

### Initial adapter set

- `opencode`
- `codex`
- `claude-code`

## Message routing model

Messages flow through OpenFleet core, not directly between harnesses.

Canonical path:

1. orchestrator requests task/job/workflow creation
2. core creates canonical records
3. core dispatches to a session through the selected harness adapter
4. adapter returns session outputs to core
5. core records canonical events
6. actions/adapters fan out to parent, Discord, GitHub, etc.

This avoids letting any one harness own transport semantics.

## Source identity model

Every emitted message/event must include explicit source identity.

Minimum fields:

- `source_type`: `user | agent | system | adapter`
- `source_id`
- `agent_id` if applicable
- `session_id`
- `adapter`
- `channel` if applicable

This prevents agent/system callbacks from being mistaken for user input.

## Task, job, and workflow model

### Task

A single execution result plus action fanout.

### Job

A canonical unit of assigned work.

Fields:

- `job_id`
- `type`
- `status`
- `agent`
- `workflow_id`
- `trigger`
- `input`
- `output`

### Workflow

A multi-step graph/state machine.

Fields:

- `workflow_id`
- `type`
- `status`
- `current_step`
- `steps`
- `context`

Example:

- `monitor.detect`
- `coder.fix`
- `evaluator.review`
- `merge.deploy`

## Generic execution pipeline

All scheduled and completion-driven work should follow one pipeline:

1. trigger
2. deterministic controller/input builder
3. dispatch to agent session
4. structured agent output
5. actions/fanout
6. next-step routing

This applies to:

- heartbeats
- market scans
- VPS monitor checks
- coder completion
- evaluator loops
- merge/deploy flows

## Recurring detector pattern

OpenFleet v1 should distinguish between:

- recurring detector jobs
- spawned remediation workflows

### Detector jobs

Examples:

- `monitor.detect`
- `stock-monitor.check`
- future anomaly scanners and scheduled probes

Rules:

- detector jobs are recurring sources of truth
- they should continue to run on schedule
- they should not stop permanently just because they found one issue or spawned one workflow

### Spawned remediation workflows

When a detector finds a real anomaly, it should:

- emit canonical events
- create or upsert issue/workflow state
- optionally dispatch a remediation workflow

That remediation workflow is separate from the detector's ongoing schedule.

### Design rule

The detector remains the repeating source.

The remediation workflow is a spawned consequence of a finding, not the detector itself.

## Actions layer

Actions are generic post-processing units.

Initial required actions:

- `parent_message`
- `discord_post`
- `github_issue_upsert`

Later actions:

- `github_pr_comment`
- `merge_pr`
- `deploy`
- `enqueue_job`
- `transition_workflow`

## Structured outputs

Agents should not return only prose.

Each common role should have a structured output schema.

Examples:

- `monitor_summary_v1`
- `stock_monitor_summary_v1`
- `coder_completion_v1`
- `evaluator_decision_v1`

Core actions should consume those structured outputs.

## Rate-limit detection

Rate limits must be tracked in core and surfaced as routing state.

### Required runtime profile states

- `available`
- `degraded`
- `rate_limited`
- `hard_failed`
- `cool_down_until`

### What adapters must detect

- hard rate-limit messages
- token exhaustion / quota exhaustion
- account plan restrictions
- temporary backoff windows
- interactive auth blocks

Adapters should capture both machine-readable and UI-surface rate-limit signals.

Example Claude Code signal observed in tmux:

- `You're out of extra usage · resets Apr 3 at 3pm (America/Indianapolis)`
- followed by `/rate-limit-options`
- and menu choices to wait, add funds, or upgrade

This should be normalized into canonical routing state such as:

```json
{
  "profile_id": "claude-opus-orchestrator",
  "status": "rate_limited",
  "reason": "out_of_extra_usage",
  "cool_down_until": "2026-04-03T15:00:00-04:00",
  "source": "adapter-ui-detection"
}
```

### Core behavior on rate limit

When a profile becomes rate-limited:

- mark it unavailable for new assignments
- record the reason and cool-down time
- emit a canonical event
- reroute work to another allowed profile when possible
- surface the state in ops/remote views

### Example

If `claude-opus-orchestrator` is rate-limited:

- do not assign new work there
- keep existing sessions marked degraded/rate_limited
- allow `cairn` to fail over to `codex-gpt54-orchestrator` if policy allows

## Scheduling model

The scheduler belongs to core.

It should:

- register scheduled jobs
- create canonical jobs/workflows
- dispatch to selected agent/runtime profiles
- execute follow-up actions

Agents do not own raw cron semantics.

## Ops role

Ops remains the observability/control surface.

Minimum required views:

- agents
- inspect
- tail
- follow
- capture
- host / local-vs-remote visibility
- profile / harness visibility
- rate-limit visibility

## Remote role

Remote stays an adapter layer:

- Discord
- Telegram
- web/mobile later

Remote adapters consume canonical events and send canonical commands into core.

They do not own agent/workflow state.

## Immediate implementation target

First real supported path:

- `cairn` in Codex / GPT-5.4 as orchestrator client
- OpenFleet core as source of truth
- OpenCode workers local and ThinkPad-remote
- Discord adapter behind OpenFleet remote layer

Secondary supported path:

- `cairn` in Claude Code / Opus as fallback orchestrator client when available

This is the first path to make solid before expanding to Claude Code worker/orchestrator support.

## Implementation order

1. revised multi-harness spec
2. canonical runtime profiles + adapter contract
3. Codex `cairn` orchestrator path
4. OpenCode worker path generalized under adapter contract
5. rate-limit-aware routing
6. workflow/job transitions and evaluator loops
7. Claude Code adapter

## Non-goals for this phase

- perfect parity across every harness immediately
- polished UI before the core contract is stable
- making every agent transport-aware
- trying to make weak local models do high-agency reasoning

## v1 success condition

OpenFleet is correct when:

- one canonical agent identity can run across multiple harnesses
- one canonical task/job/workflow/event system exists outside the harnesses
- the orchestrator can switch between Codex and Claude without changing the fleet model
- local and remote workers remain observable and controllable from the same ops surface
- rate limits are visible and affect routing decisions
