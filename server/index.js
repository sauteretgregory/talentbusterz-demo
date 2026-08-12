import http from 'node:http'

import {
  fetchFranceTravailPublicJob
} from './providers/franceTravailPublic.js'

const PORT = 8787

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload)

  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  })

  res.end(body)
}

async function readJsonBody(req) {
  let body = ''

  for await (const chunk of req) {
    body += chunk
  }

  if (!body) {
    return {}
  }

  return JSON.parse(body)
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    })
    res.end()
    return
  }

  if (
    req.method === 'POST' &&
    req.url === '/api/job-intake'
  ) {
    try {
      const body = await readJsonBody(req)
      const sourceUrl = body?.url

      if (!sourceUrl || typeof sourceUrl !== 'string') {
        sendJson(res, 400, {
          status: 'failed',
          error: 'job_url_required'
        })
        return
      }

      const extraction =
        await fetchFranceTravailPublicJob(sourceUrl)

      sendJson(res, 200, {
        status: 'completed',
        detected_source: 'france_travail',
        provider_id: extraction.provider_id,
        provider_payload: extraction.provider_payload,
        raw_job_content: extraction.raw_job_content,
        structured_source_data:
          extraction.structured_source_data
      })
    } catch (error) {
      sendJson(res, 500, {
        status: 'failed',
        error: error.message
      })
    }

    return
  }

  sendJson(res, 404, {
    status: 'failed',
    error: 'not_found'
  })
})

server.listen(PORT, () => {
  console.log(`TBZ backend listening on http://localhost:${PORT}`)
})
