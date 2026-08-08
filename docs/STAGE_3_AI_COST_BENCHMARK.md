# Stage 3 — AI Cost Benchmark Gate

Status: IN PROGRESS — founder live acceptance required before Production model change.

## Goal

Use the lowest-cost OpenAI model that can reliably satisfy KAEC quality expectations for HQLS Lesson Intelligence and Assessment Intelligence without making teaching or assessment shallow.

## Model policy under evaluation

- Primary generation candidate: `gpt-4o-mini`
- Repair/fallback model: `gpt-5-mini`
- `gpt-5-nano` is not the default candidate for core teaching generation because OpenAI positions it mainly for summarization and classification; KSI requires richer instructional and assessment generation.
- Production remains on its currently configured model until the benchmark passes.
- OpenAI Responses API, strict Structured Outputs, `store: false`, tenant isolation and all KAEC deterministic validators remain unchanged.

## Runtime behavior

1. First generation uses the configured primary model.
2. KSI validates the structured artifact independently.
3. If the artifact fails a KAEC validator, the repair request uses the configured repair model.
4. Nothing is saved unless the final artifact passes the same HQLS or Assessment validation gates already used in Stage 2/3.

## Preview benchmark

Configure Preview only:

- `KSI_OPENAI_PRIMARY_MODEL=gpt-4o-mini`
- `KSI_OPENAI_REPAIR_MODEL=gpt-5-mini`

Keep Production on its current accepted model until quality acceptance.

Representative acceptance set:

### HQLS
- Generate one complete seven-stage HQLS lesson.
- It must pass deterministic HQLS fidelity and save successfully.
- Reopen the lesson and confirm all seven stages remain complete.
- Review the actual teaching quality: productive struggle, sufficiently deep Full Illumination, meaningful second attempt and transfer/reflection must not feel shallow.

### Assessment
- Generate one v1.1 multi-topic assessment with weighted topics, explicit assessment type, overall difficulty and mixed item formats.
- It must pass KAEC world-class assessment validation and save successfully.
- Topic mark weighting, difficulty profile, critical-thinking evidence and marking guidance must remain valid.
- Critical Thinking and project items must require genuine reasoning/application rather than recall with decorative wording.

### Cost/quality decision

Accept `gpt-4o-mini` as the Production primary only if representative HQLS and Assessment outputs pass existing automated gates and founder quality review without material regression. `gpt-5-mini` remains the repair/fallback model.

If `gpt-4o-mini` repeatedly requires fallback or produces materially weaker educational artifacts, retain `gpt-5-mini` for the affected engine rather than reducing quality merely to save tokens.
