/**
 * CLIENT-SIDE UTILITY TO CALL GEMINI PROXY
 */

export async function callGeminiProxy(params: {
  prompt: string;
  model?: string;
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
    const errorData = await response.json();
    throw new Error(JSON.stringify(errorData));
  }

  const data = await response.json();
  return data.text;
}

/**
 * Health check for the LLM Provider from the client
 */
export async function getLLMHealth() {
  try {
    const response = await fetch('/api/admin/llm/health');
    return await response.json();
  } catch (error) {
    return {
      status: 'error',
      message: 'Failed to connect to backend health check'
    };
  }
}
