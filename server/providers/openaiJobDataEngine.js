import OpenAI from 'openai'

function assertJobEngineInput(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('TBZ: JOB DATA ENGINE input is required.')
  }

  if (input.artifact_type !== 'job_data_engine_input_payload') {
    throw new Error(
      'TBZ: expected job_data_engine_input_payload.'
    )
  }

  if (input.input_contract_version !== 'v1.0') {
    throw new Error(
      'TBZ: unsupported JOB DATA ENGINE input contract.'
    )
  }
}

function assertCanonicalJobState(artifact) {
  if (!artifact || typeof artifact !== 'object') {
    throw new Error(
      'TBZ: OpenAI returned an invalid JOB artifact.'
    )
  }

  if (artifact.artifact_type !== 'canonical_job_data_state') {
    throw new Error(
      'TBZ: OpenAI output is not canonical_job_data_state.'
    )
  }

  if (!artifact.artifact_id) {
    throw new Error('TBZ: JOB artifact_id is missing.')
  }

  if (!artifact.state_version) {
    throw new Error('TBZ: JOB state_version is missing.')
  }

  if (
    artifact?.validation_report?.validation_status !== 'passed'
  ) {
    throw new Error(
      'TBZ: JOB canonical validation did not pass.'
    )
  }

  return artifact
}

export function createOpenAIJobDataEngineProvider({
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_MODEL,
  client = null
} = {}) {
  if (!apiKey && !client) {
    throw new Error(
      'TBZ: OPENAI_API_KEY is not configured.'
    )
  }

  if (!model) {
    throw new Error(
      'TBZ: OPENAI_MODEL is not configured.'
    )
  }

  const openai =
    client || new OpenAI({ apiKey })

  return async function openaiJobDataEngine(input) {
    assertJobEngineInput(input)

    const response = await openai.responses.create({
      model,
      store: false,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: [
                'You are TBZ_JOB_DATA_ENGINE V1.',
                'Operate in PRODUCTION mode.',
                'The supplied JSON is a validated job_data_engine_input_payload v1.0.',
                'Produce one canonical_job_data_state only.',
                'Do not invent missing job information.',
                'Preserve source provenance.',
                'Distinguish explicit facts, missing data, ambiguities and contradictions.',
                'The JOB DATA ENGINE is the exclusive owner of canonical job truth.',
                'Return JSON only.'
              ].join('\n')
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(input)
            }
          ]
        }
      ],
      text: {
        format: {
          type: 'json_object'
        }
      }
    })

    if (!response.output_text) {
      throw new Error(
        'TBZ: OpenAI JOB DATA ENGINE returned no output.'
      )
    }

    let artifact

    try {
      artifact = JSON.parse(response.output_text)
    } catch {
      throw new Error(
        'TBZ: OpenAI JOB DATA ENGINE returned invalid JSON.'
      )
    }

    return assertCanonicalJobState(artifact)
  }
}
