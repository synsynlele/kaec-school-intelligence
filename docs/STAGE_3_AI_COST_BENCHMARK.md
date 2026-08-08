# Stage 3 — AI Cost Benchmark Gate

Status: IN PROGRESS — founder live acceptance required before Production model change.

## Goal

Use the cheapest OpenAI model that can reliably satisfy KAEC deterministic quality gates for HQLS Lesson Intelligence and Assessment Intelligence.

## Model policy under evaluation

- Primary generation candidate: `gpt-5-nano`
- Repair/fallback model: `gpt-5-mini`
- Production remains on its currently configured model until the benchmark passes.
- OpenAI Responses API, strict Structured Outputs, `store: false`, tenant isolation and all KAEC deterministic validators remain unchanged.

## Runtime behavior

1. First generation uses the configured primary model.
2. KSI validates the structured artifact independently.
3. If the artifact fails a KAEC validator, the existing repair request uses the configured repair model.
4. Nothing is saved unless the final artifact passes the same HQLS or Assessment validation gates already used in Stage 2/3.

## Preview benchmark

Configure Preview only:

- `KSI_OPENAI_MODEL=gpt-5-nano`
- `KSI_OPENAI_REPAIR_MODEL=gpt-5-mini`

Keep Production on `gpt-5-mini` until acceptance.

Representative acceptance set:

### HQLS
- Generate one complete seven-stage HQLS lesson.
- It must pass deterministic HQLS fidelity and save successfully.
- Reopen the lesson and confirm all seven stages remain complete.

### Assessment
- Generate one v1.1 multi-topic assessment with weighted topics, explicit assessment type, overall difficulty and mixed item formats.
- It must pass KAEC world-class assessment validation and save successfully.
- Topic mark weighting, difficulty profile, critical-thinking evidence and marking guidance must remain valid.

### Cost/quality decision

Accept `gpt-5-nano` as the Production primary only if representative HQLS and Assessment outputs pass existing quality gates without material quality regression. `gpt-5-mini` remains the repair/fallback model.

If nano repeatedly requires fallback or produces materially weaker artifacts, retain the cheapest stronger model that passes the same benchmark reliably.
