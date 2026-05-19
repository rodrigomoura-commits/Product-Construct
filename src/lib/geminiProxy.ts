/**
 * CLIENT-SIDE UTILITY TO CALL GEMINI PROXY
 */

export async function callGeminiProxy(params: {
  prompt: string;
  userMessage?: string; // Original user message
  model?: string;
  useCase?: string;
  agentId?: string;
  productId?: string;
  stageId?: string;
  userId?: string;
  userEmail?: string;
  config?: any;
}) {
  const response = await fetch('/api/mindflow/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const errorData = await response.json();
      throw new Error(JSON.stringify(errorData));
    } else {
      const errorText = await response.text();
      throw new Error(JSON.stringify({
        error: errorText.slice(0, 500),
        status: response.status,
        type: 'UNEXPECTED_SERVER_RESPONSE'
      }));
    }
  }

  const data = await response.json();
  return data.text;
}

/**
 * Health check for the LLM Provider from the client
 */
export async function getLLMHealth() {
  try {
    const response = await fetch('/api/integrations/gemini/health');
    return await response.json();
  } catch (error) {
    return {
      status: 'error',
      message: 'Failed to connect to backend health check'
    };
  }
}
