export const runtime = 'edge'

import {
  initEvolutionEngine,
  getParam,
  getGenome,
  recordTradeOutcome,
  evolve,
  buildDiagnosticPrompt,
  applyRecommendations,
  getEvolutionReport,
  resetEvolution,
} from '@/lib/evolutionEngine'

// ============ EDGE RUNTIME — EVOLUTION API ============
// POST actions: evolve, record, diagnose, apply-recommendations, reset
// GET: returns evolution report

export async function GET(request) {
  try {
    initEvolutionEngine()
    const report = getEvolutionReport()
    const genome = getGenome()

    return Response.json({
      ok: true,
      report,
      genome,
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const action = body.action

    initEvolutionEngine()

    // ===== ACTION: EVOLVE =====
    // Triggers a full evolution cycle. Optionally pass resolved trades.
    if (action === 'evolve') {
      const trades = body.trades || []
      const result = evolve(trades)

      // If Claude API key is available, run deep diagnostic
      let claudeAnalysis = null
      if (body.useClaudeAPI && body.anthropicKey) {
        try {
          claudeAnalysis = await runClaudeDiagnostic(body.anthropicKey)
        } catch (e) {
          claudeAnalysis = { error: e.message }
        }
      }

      return Response.json({
        ok: true,
        action: 'evolve',
        result,
        claudeAnalysis,
        timestamp: new Date().toISOString(),
      })
    }

    // ===== ACTION: RECORD =====
    // Record a single trade outcome for attribution.
    if (action === 'record') {
      const trade = body.trade
      if (!trade) {
        return Response.json({ ok: false, error: 'Missing trade object' }, { status: 400 })
      }
      const attribution = recordTradeOutcome(trade)
      return Response.json({
        ok: true,
        action: 'record',
        attribution,
        timestamp: new Date().toISOString(),
      })
    }

    // ===== ACTION: DIAGNOSE =====
    // Build a Claude-ready diagnostic prompt without calling the API.
    if (action === 'diagnose') {
      const diagnostic = buildDiagnosticPrompt()
      return Response.json({
        ok: true,
        action: 'diagnose',
        diagnostic,
        timestamp: new Date().toISOString(),
      })
    }

    // ===== ACTION: APPLY-RECOMMENDATIONS =====
    // Apply Claude's (or manual) parameter recommendations.
    if (action === 'apply-recommendations') {
      const recommendations = body.recommendations
      if (!recommendations) {
        return Response.json({ ok: false, error: 'Missing recommendations object' }, { status: 400 })
      }
      const result = applyRecommendations(recommendations)
      return Response.json({
        ok: true,
        action: 'apply-recommendations',
        result,
        timestamp: new Date().toISOString(),
      })
    }

    // ===== ACTION: CLAUDE-EVOLVE =====
    // Full autonomous cycle: evolve + diagnose + call Claude API + apply recommendations.
    if (action === 'claude-evolve') {
      const anthropicKey = body.anthropicKey
      if (!anthropicKey) {
        return Response.json({ ok: false, error: 'Missing anthropicKey' }, { status: 400 })
      }

      // Step 1: Run standard evolution
      const evolveResult = evolve(body.trades || [])

      // Step 2: Build diagnostic and call Claude
      const claudeResult = await runClaudeDiagnostic(anthropicKey)

      // Step 3: Apply Claude's recommendations
      let applyResult = null
      if (claudeResult && claudeResult.parameterChanges) {
        applyResult = applyRecommendations(claudeResult)
      }

      return Response.json({
        ok: true,
        action: 'claude-evolve',
        evolveResult,
        claudeResult,
        applyResult,
        timestamp: new Date().toISOString(),
      })
    }

    // ===== ACTION: GET-PARAM =====
    // Retrieve current value of a specific parameter.
    if (action === 'get-param') {
      const name = body.name
      if (!name) {
        return Response.json({ ok: false, error: 'Missing param name' }, { status: 400 })
      }
      return Response.json({
        ok: true,
        action: 'get-param',
        param: name,
        value: getParam(name),
      })
    }

    // ===== ACTION: RESET =====
    if (action === 'reset') {
      const result = resetEvolution()
      return Response.json({
        ok: true,
        action: 'reset',
        result,
        timestamp: new Date().toISOString(),
      })
    }

    return Response.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })

  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}

// ============ CLAUDE API INTEGRATION ============
// Sends diagnostic data to Claude and gets back parameter recommendations.

async function runClaudeDiagnostic(anthropicKey) {
  const diagnostic = buildDiagnosticPrompt()

  const messages = [
    {
      role: 'user',
      content: `Here is the current state of the Noctis trading system's self-evolution engine. Analyze the performance data and recommend specific parameter changes to improve accuracy.\n\nDiagnostic Data:\n${JSON.stringify(diagnostic.diagnosticData, null, 2)}\n\nRespond with ONLY valid JSON matching this schema:\n{\n  "parameterChanges": [{ "param": "param_name", "newValue": 0.55, "reason": "why" }],\n  "codePatches": [{ "file": "filename.js", "description": "what to change", "priority": "high|medium|low" }],\n  "analysis": "Summary of findings and recommendations"\n}`
    }
  ]

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: diagnostic.systemPrompt,
      messages,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Claude API error ${response.status}: ${errText}`)
  }

  const data = await response.json()
  const content = data.content?.[0]?.text || ''

  // Parse JSON from Claude's response
  try {
    // Extract JSON from response (Claude may wrap it in markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return JSON.parse(content)
  } catch (e) {
    return {
      parameterChanges: [],
      codePatches: [],
      analysis: content, // Return raw text if JSON parsing fails
      parseError: e.message,
    }
  }
}
