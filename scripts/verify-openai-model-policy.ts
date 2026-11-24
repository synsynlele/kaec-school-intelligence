import assert from "node:assert/strict";
import { configuredOpenAIModel, generateOpenAIJson } from "../lib/ai/openai";

async function main() {
  const env = process.env;
  for (const key of [
    "KSI_OPENAI_MODEL",
    "KSI_AI_MODEL",
    "KSI_AI_REASONING_QUICK",
    "KSI_AI_REASONING_STANDARD",
    "KSI_AI_REASONING_REPAIR",
  ]) delete env[key];

  env.OPENAI_API_KEY = "mock-key";
  env.KSI_HQLS_OPENAI_MODEL = "gpt-5.6-terra";

  let request: Record<string, unknown> = {};
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    request = JSON.parse(String(init?.body));
    return Response.json({
      status: "completed",
      output: [{ content: [{ type: "output_text", text: '{"ok":true}' }] }],
      usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 },
    });
  };

  async function checkRequest(schemaName: string, effort: string, maxOutputTokens = 250) {
    const result = await generateOpenAIJson<{ ok: boolean }>({
      systemInstruction: "Fixture",
      parts: [{ text: "Synthetic KSI input" }],
      responseSchema: { type: "object", properties: { ok: { type: "boolean" } } },
      schemaName,
      maxOutputTokens,
      ...(schemaName === "ksi_hqls_lesson"
        ? { promptCacheKey: "ksi-hqls-fixture", textVerbosity: "low" }
        : {}),
    });

    assert.equal(result.data.ok, true);
    assert.equal(request.model, configuredOpenAIModel());
    assert.equal(result.model, configuredOpenAIModel());
    assert.deepEqual(request.reasoning, { effort });
    assert.equal(request.max_output_tokens, maxOutputTokens);
    assert.equal(request.store, false);
    const text = request.text as { format: { strict: boolean; schema: unknown } };
    assert.equal(text.format.strict, true);
    assert.deepEqual(text.format.schema, {
      type: "object",
      properties: { ok: { type: "boolean" } },
      required: ["ok"],
      additionalProperties: false,
    });
  }

  assert.equal(configuredOpenAIModel(), "gpt-6-luna");
  await checkRequest("ksi_hqls_lesson", "low", 8000);
  assert.deepEqual(request.prompt_cache_options, { ttl: "30m" });
  assert.equal((request.text as { verbosity: string }).verbosity, "low");
  await checkRequest("ksi_result_comment", "none");
  await checkRequest("ksi_assessment_v11_repair", "medium");
  await checkRequest("ksi_hqls_stage_repair", "low", 3500);

  env.KSI_AI_REASONING_REPAIR = "high";
  await checkRequest("ksi_student_diagnosis_repair", "high");
  delete env.KSI_AI_REASONING_REPAIR;

  env.KSI_AI_MODEL = "gpt-5.6-terra";
  env.KSI_OPENAI_MODEL = "gpt-5-mini";
  assert.equal(configuredOpenAIModel(), "gpt-5-mini");
  env.KSI_AI_REASONING_QUICK = "none";
  await checkRequest("ksi_result_comment", "minimal");
  await checkRequest("ksi_hqls_lesson", "low", 8000);
  assert.equal(request.prompt_cache_options, undefined);

  console.log("OpenAI request contract verified for Luna and the GPT-5 mini rollback.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
