/**
 * Alexa <-> Claude bridge (ES module variant).
 *
 * Use this file instead of index.js when the AWS Lambda console created
 * your function's entry file as `index.mjs` (the current default for new
 * Node.js functions). Same logic as index.js, just using `export` instead
 * of `exports.` / `module.exports`. Zero npm dependencies — Node.js 18.x
 * and 20.x ship a native `fetch`.
 *
 * Required Lambda environment variable:
 *   ANTHROPIC_API_KEY  - your Claude API key from console.anthropic.com
 *
 * Optional Lambda environment variables:
 *   CLAUDE_MODEL - defaults to "claude-sonnet-5"
 *   SYSTEM_PROMPT - defaults to a voice-friendly Spanish prompt below
 *   SKILL_ID - if set, requests whose session.application.applicationId
 *              does not match are rejected (recommended, see README).
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5';
const SYSTEM_PROMPT =
  process.env.SYSTEM_PROMPT ||
  'Eres Claude, un asistente de voz. Te están hablando a través de un altavoz Alexa, ' +
  'así que tu respuesta se convertirá en audio. Responde en español, de forma breve, ' +
  'natural y conversacional (2-4 frases salvo que te pidan más detalle). ' +
  'No uses markdown, listas, asteriscos ni ningún formato visual: solo texto plano hablado.';

const MAX_HISTORY_TURNS = 20; // user+assistant messages kept in session

export const handler = async (event) => {
  try {
    if (process.env.SKILL_ID) {
      const requestSkillId = event?.session?.application?.applicationId;
      if (requestSkillId !== process.env.SKILL_ID) {
        console.error('Skill ID mismatch, rejecting request', requestSkillId);
        return buildResponse('Solicitud no autorizada.', true);
      }
    }

    const requestType = event.request && event.request.type;

    if (requestType === 'LaunchRequest') {
      return buildResponse('Hola, soy Claude. ¿En qué puedo ayudarte?', false);
    }

    if (requestType === 'IntentRequest') {
      return await handleIntent(event);
    }

    if (requestType === 'SessionEndedRequest') {
      return { version: '1.0', response: {} };
    }

    return buildResponse('Lo siento, no he podido procesar esa solicitud.', true);
  } catch (err) {
    console.error('Unhandled error', err);
    return buildResponse(
      'Ha ocurrido un error al contactar con Claude. Inténtalo de nuevo en un momento.',
      true
    );
  }
};

async function handleIntent(event) {
  const intentName = event.request.intent.name;

  if (intentName === 'AskClaudeIntent') {
    const userText =
      (event.request.intent.slots &&
        event.request.intent.slots.query &&
        event.request.intent.slots.query.value) ||
      '';

    if (!userText.trim()) {
      return buildResponse('No te he entendido bien. ¿Puedes repetirlo?', false);
    }

    if (!ANTHROPIC_API_KEY) {
      console.error('Missing ANTHROPIC_API_KEY environment variable');
      return buildResponse('Falta configurar la clave de la API de Claude en el servidor.', true);
    }

    const priorHistory =
      (event.session && event.session.attributes && event.session.attributes.history) || [];
    const history = priorHistory.concat([{ role: 'user', content: userText }]);

    const reply = await askClaude(history);
    const updatedHistory = history
      .concat([{ role: 'assistant', content: reply }])
      .slice(-MAX_HISTORY_TURNS);

    return buildResponse(reply, false, { history: updatedHistory });
  }

  if (intentName === 'AMAZON.HelpIntent') {
    return buildResponse(
      'Puedes hablarme como si hablaras con Claude. Por ejemplo, di: pregunta a Claude cuál es la capital de Francia.',
      false
    );
  }

  if (intentName === 'AMAZON.CancelIntent' || intentName === 'AMAZON.StopIntent') {
    return buildResponse('Hasta luego.', true);
  }

  if (intentName === 'AMAZON.FallbackIntent') {
    return buildResponse(
      'No he entendido eso. Prueba a empezar la frase con "pregunta a Claude".',
      false
    );
  }

  return buildResponse('No he entendido esa instrucción.', false);
}

async function askClaude(history) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: history,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Anthropic API error', res.status, errText);
    throw new Error('Anthropic API error ' + res.status);
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join(' ')
    .trim();

  return text || 'No he podido generar una respuesta.';
}

function buildResponse(speechText, endSession, sessionAttributes) {
  const response = {
    version: '1.0',
    response: {
      outputSpeech: { type: 'PlainText', text: speechText },
      shouldEndSession: endSession,
    },
  };

  if (!endSession) {
    response.response.reprompt = {
      outputSpeech: { type: 'PlainText', text: '¿Algo más?' },
    };
  }

  if (sessionAttributes) {
    response.sessionAttributes = sessionAttributes;
  }

  return response;
}
