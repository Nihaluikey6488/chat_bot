
import { getAccessToken, httpClient } from '../../../shared/service/httpClient'

// Convert supported content formats into plain text.
function extractText(content) {
  if (typeof content === 'string') return content

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item

        if (item && typeof item === 'object') {
          if (typeof item.text === 'string') return item.text
          if (typeof item.content === 'string') return item.content
        }

        return ''
      })
      .join('')
  }

  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text
    if (typeof content.content === 'string') return content.content
  }

  return ''
}

// Handle one parsed JSON payload.
function processPayload(payload, callbacks, result) {
  if (!payload || typeof payload !== 'object') {
    console.warn('Invalid stream payload:', payload)
    return
  }

  // console.log('Received payload:', payload)

  switch (payload.type) {
   case 'text': {
    // console.log('RAW PAYLOAD:', payload);

    const text =
        typeof payload.content === 'string'
            ? payload.content
            : '';

    // console.log('EXTRACTED TEXT:', text);
    // console.log('EXTRACTED TYPE:', typeof text);

    result.content += text;
    callbacks.onChunk?.(text);

    break;
}

    case 'image': {
      if (!payload.url) return

      const image = {
        url: payload.url,
        prompt: payload.prompt || '',
      }

      result.images.push(image)
      callbacks.onImage?.(image)
      break
    }

    case 'error': {
      throw new Error(payload.message || 'Something went wrong')
    }

    case 'done': {
      callbacks.onComplete?.(payload)
      break
    }

    default: {
      console.warn('Unknown stream event:', payload)
    }
  }
}

// Parse an SSE event or raw JSON line.
function processStreamEvent(event, callbacks, result) {
  const lines = event.split(/\r?\n/)

  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())

  // Standard SSE format.
  if (dataLines.length > 0) {
    const data = dataLines.join('\n')

    if (data === '[DONE]') {
      callbacks.onComplete?.(result)
      return
    }

    try {
      processPayload(JSON.parse(data), callbacks, result)
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error('Invalid SSE JSON:', data, error)
        return
      }

      throw error
    }

    return
  }

  // Raw NDJSON format.
  for (const line of lines) {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith(':')) continue

    try {
      const payload = JSON.parse(trimmedLine)
      processPayload(payload, callbacks, result)
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error('Invalid JSON stream line:', trimmedLine)
        continue
      }

      throw error
    }
  }
}

export const chatService = {
  listConversations() {
    return httpClient.get('/chat/conversations')
  },

  getConversation(conversationId) {
    return httpClient.get(`/chat/conversations/${conversationId}`)
  },

  async sendMessageStream(
    message,
    conversationId,
    {
      onStart,
      onChunk,
      onImage,
      onError,
      onComplete,
      signal,
    } = {},
  ) {
    const token = getAccessToken()

    const response = await fetch('/api/v1/chat/conversation', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream, application/x-ndjson, application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message,
        ...(conversationId ? { conversationId } : {}),
      }),
      signal,
    })

    if (!response.ok || !response.body) {
      let errorMessage = 'Unable to send message'

      try {
        const data = await response.json()
        errorMessage = data?.message || errorMessage
      } catch {
        errorMessage = response.statusText || errorMessage
      }

      throw new Error(errorMessage)
    }

    const serverConversationId = response.headers.get(
      'X-Conversation-Id',
    )

    const titleHeader = response.headers.get(
      'X-Conversation-Title',
    )

    let title = 'New chat'

    if (titleHeader) {
      try {
        title = decodeURIComponent(titleHeader)
      } catch {
        title = titleHeader
      }
    }

    onStart?.({
      conversationId: serverConversationId,
      title,
    })

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    let buffer = ''
    let pendingData = []

    const result = {
      conversationId: serverConversationId,
      title,
      content: '',
      images: [],
    }

    const callbacks = {
      onChunk,
      onImage,
      onError,
      onComplete,
    }

    // Process one complete line.
    const processLine = (rawLine) => {
      const line = rawLine.replace(/\r$/, '')

      // Blank line ends an SSE event.
      if (!line.trim()) {
        if (pendingData.length) {
          processStreamEvent(
            pendingData.map((item) => `data:${item}`).join('\n'),
            callbacks,
            result,
          )

          pendingData = []
        }

        return
      }

      // Collect SSE data lines.
      if (line.startsWith('data:')) {
        pendingData.push(line.slice(5).trimStart())
        return
      }

      // Ignore SSE comments and metadata.
      if (
        line.startsWith(':') ||
        line.startsWith('event:') ||
        line.startsWith('id:') ||
        line.startsWith('retry:')
      ) {
        return
      }

      // Process raw NDJSON lines.
      if (pendingData.length === 0) {
        processStreamEvent(line, callbacks, result)
      }
    }

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')

        // Keep the last incomplete line.
        buffer = lines.pop() || ''

        for (const line of lines) {
          processLine(line)
        }
      }

      // Flush decoder.
      buffer += decoder.decode()

      if (buffer) {
        processLine(buffer)
      }

      // Process a final SSE event without a trailing blank line.
      if (pendingData.length) {
        processStreamEvent(
          pendingData.map((item) => `data:${item}`).join('\n'),
          callbacks,
          result,
        )
      }

      // console.log('Final AI response:', result.content)

      return result
    } catch (error) {
      onError?.(error.message)
      throw error
    } finally {
      reader.releaseLock()
    }
  },
}
