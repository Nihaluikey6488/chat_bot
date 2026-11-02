import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '../../../auth/hooks/useAuth'
import { useSession } from '../../hooks/useSession'

const markdownClassName =
  'font-serif text-[16.5px] leading-[1.75] text-[#E8E6DC] [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1.5 [&_li]:pl-1 [&_a]:text-[#D97757] [&_a]:underline [&_a]:underline-offset-2 [&_h1]:mt-6 [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-[#FAF9F5] [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[#FAF9F5] [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-[#FAF9F5] [&_strong]:font-semibold [&_strong]:text-[#FAF9F5] [&_code]:rounded-md [&_code]:border [&_code]:border-[#3D3D3A] [&_code]:bg-[#1F1E1D] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-[#E9A98F] [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-[#3D3D3A] [&_pre]:bg-[#1A1918] [&_pre]:p-4 [&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[#E8E6DC] [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-[#4A4944] [&_blockquote]:pl-4 [&_blockquote]:text-[#B8B6AC] [&_hr]:my-6 [&_hr]:border-[#3D3D3A] [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_th]:border [&_th]:border-[#3D3D3A] [&_th]:bg-[#2B2A28] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_td]:border [&_td]:border-[#3D3D3A] [&_td]:px-3 [&_td]:py-2'

// Convert different AI response formats into renderable text.
function getTextContent(content) {
  if (content == null) return ''

  if (typeof content === 'string') {
    return content
  }

  if (typeof content === 'number' || typeof content === 'boolean') {
    return String(content)
  }

  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === 'string') return block

        if (typeof block === 'object' && block !== null) {
          if (typeof block.text === 'string') return block.text
          if (typeof block.content === 'string') return block.content
        }

        return ''
      })
      .join('')
  }

  if (typeof content === 'object') {
    if (typeof content.text === 'string') return content.text
    if (typeof content.content === 'string') return content.content
  }

  return ''
}

// Decorative sparkle icon (UI only).
function Sparkle({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MessageContent({ message }) {
  const textContent = getTextContent(message.content)

  return (
    <div className="space-y-4">
      {message.author === 'ai' ? (
        <div className={markdownClassName}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {textContent}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-[15.5px] leading-relaxed text-[#FAF9F5]">
          {textContent}
        </p>
      )}

      {message.images?.map((image, index) => (
        <div
          key={`${image.url}-${index}`}
          className="max-w-xl"
        >
          <img
            src={image.url}
            alt={image.prompt || 'AI generated image'}
            className="w-full rounded-2xl border border-[#3D3D3A] object-cover"
            loading="lazy"
          />

          <a
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm text-[#D97757] hover:underline"
          >
            View generated image
          </a>
        </div>
      ))}
    </div>
  )
}

// Voice Recorder Component for STT Integration
function VoiceRecorder({ onTranscription }) {
  const [isRecording, setIsRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  const startRecording = async () => {
    audioChunksRef.current = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await sendAudioToBackend(audioBlob)
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error('Microphone access error:', err)
      alert('Microphone permission is required for voice input.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const sendAudioToBackend = async (blob) => {
    setLoading(true)
    const formData = new FormData()
    formData.append('audio', blob, 'recording.webm')

    try {
      // Backend STT API Endpoint
      const response = await fetch('http://localhost:3000/api/v1/speech/transcribe', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Transcription failed')
      }

      if (onTranscription && data.text) {
        onTranscription(data.text)
      }
    } catch (err) {
      console.error('STT Request Error:', err)
      alert('Failed to transcribe audio.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={isRecording ? stopRecording : startRecording}
      disabled={loading}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors cursor-pointer ${
        isRecording
          ? 'bg-red-600 text-white animate-pulse'
          : 'bg-[#3D3D3A] text-[#E8E6DC] hover:bg-[#4A4944] hover:text-[#FAF9F5]'
      } disabled:opacity-50`}
      title={isRecording ? 'Stop Recording' : 'Voice Input'}
      aria-label="Voice input"
    >
      {loading ? (
        <span className="text-[10px]">...</span>
      ) : isRecording ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
          <path d="M19 10v1a7 7 0 0 1-14 0v-1"></path>
          <line x1="12" y1="19" x2="12" y2="23"></line>
          <line x1="8" y1="23" x2="16" y2="23"></line>
        </svg>
      )}
    </button>
  )
}

export function ChatPage() {
  const { user, logout } = useAuth()
  const {
    sessions,
    activeSession,
    listStatus,
    activeSessionStatus,
    sendStatus,
    error,
    createSession,
    setActive,
    sendMessage,
  } = useSession()
  
  const [message, setMessage] = useState('')
  const messagesEndRef = useRef(null)
  
  const activeMessages = activeSession?.messages
  
  // Automatically scroll to the latest message.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    })
  }, [activeMessages])

  // Send user message.
  const handleSubmit = async (event) => {
    event.preventDefault()

    const content = message.trim()

    if (!content || sendStatus === 'loading') return

    setMessage('')

    try {
      await sendMessage(content)
    } catch (error) {
      console.error('Failed to send message:', error)
      setMessage(content)
    }
  }

  // Sort conversations by latest creation date.
  const sortedSessions = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      ),
    [sessions],
  )

  return (
    <div className="flex h-screen overflow-hidden bg-[#262624] font-sans text-[#E8E6DC] antialiased">
      {/* Sidebar */}
      <aside
        className="flex w-65 min-h-0 flex-col border-r border-[#33322F] bg-[#1F1E1D]"
        aria-label="Conversation sidebar"
      >
        {/* Brand */}
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <span className="text-[#D97757]">
            <Sparkle size={20} />
          </span>
          <span className="font-serif text-[22px] tracking-tight text-[#FAF9F5]">
            {/* Claude */}
          </span>
        </div>

        <div className="px-3 pb-2">
          <button
            className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-[#D97757] transition-colors hover:bg-[#2B2A28]"
            type="button"
            onClick={() => createSession('Untitled chat')}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#C96442] text-white transition-colors group-hover:bg-[#D97757]">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            New chat
          </button>
        </div>

        {/* Conversation list */}
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <p className="px-2.5 pt-4 pb-2 text-xs font-medium text-[#8A8880]">
            Recents
          </p>

          {listStatus === 'loading' && (
            <p className="px-2.5 py-1 text-[13px] text-[#8A8880]">
              Loading conversations...
            </p>
          )}

          <ul className="grid list-none gap-0.5 p-0">
            {sortedSessions.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  className={`w-full truncate rounded-lg px-2.5 py-2 text-left text-[14px] transition-colors ${
                    session.id === activeSession?.id
                      ? 'bg-[#30302E] text-[#FAF9F5]'
                      : 'text-[#C2C0B6] hover:bg-[#2B2A28] hover:text-[#FAF9F5]'
                  }`}
                  onClick={() => setActive(session.id)}
                >
                  {session.title}
                </button>
              </li>
            ))}
          </ul>

          {listStatus !== 'loading' && !sortedSessions.length && (
            <p className="px-2.5 py-1 text-[13px] text-[#8A8880]">
              No chats yet
            </p>
          )}
        </nav>

        {/* User profile */}
        <div className="flex items-center justify-between gap-2 border-t border-[#33322F] p-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8E6DC] text-sm font-semibold text-[#262624]">
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>

            <span className="truncate text-[13px] text-[#C2C0B6]">
              {user?.email}
            </span>
          </div>

          <button
            className="shrink-0 rounded-lg px-2 py-1.5 text-[13px] text-[#9C9A92] transition-colors hover:bg-[#2B2A28] hover:text-[#FAF9F5]"
            type="button"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main chat area */}
      <main className="flex min-h-0 flex-1 flex-col bg-[#262624]">
        <div
          className="min-h-0 flex-1 overflow-y-auto"
          role="region"
          aria-label="Conversation panel"
        >
          <div className="mx-auto w-full max-w-3xl px-4 py-10">
            {activeSession ? (
              <>
                {activeSessionStatus === 'loading' && (
                  <p className="text-[15px] text-[#8A8880]">
                    Loading messages...
                  </p>
                )}

                {/* Render conversation messages */}
                {activeSession.messages?.map((chatMessage) => (
                  <div
                    key={chatMessage.id}
                    className={`mb-8 flex ${
                      chatMessage.author === 'user'
                        ? 'justify-end'
                        : 'justify-start'
                    }`}
                  >
                    {chatMessage.author === 'user' ? (
                      <div className="max-w-[80%] rounded-2xl bg-[#141413] px-4 py-3">
                        <MessageContent message={chatMessage} />
                      </div>
                    ) : (
                      <div className="w-full px-1">
                        {getTextContent(chatMessage.content) ||
                        chatMessage.images?.length ? (
                          <>
                            <MessageContent message={chatMessage} />
                            <div className="mt-3 text-[#D97757]">
                              <Sparkle size={20} />
                            </div>
                          </>
                        ) : sendStatus === 'loading' ? (
                          <div className="flex items-center gap-2 text-[#D97757]">
                            <span className="animate-pulse">
                              <Sparkle size={20} />
                            </span>
                            <p className="font-serif text-[15px] text-[#9C9A92]">
                              Thinking...
                            </p>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}

                {activeSession.messages?.length === 0 && (
                  <p className="text-center font-serif text-[15px] text-[#9C9A92]">
                    No messages in this conversation.
                  </p>
                )}

                <div ref={messagesEndRef} />
              </>
            ) : (
              <div className="flex h-[60vh] flex-col items-center justify-center gap-5 text-center">
                <span className="text-[#D97757]">
                  <Sparkle size={44} />
                </span>
                <p className="font-serif text-[34px] leading-tight text-[#E8E6DC]">
                  Start a new chat or select a conversation.
                </p>
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-lg border border-[#5C2B2B] bg-[#3A2020] px-3 py-2 text-sm text-[#F2A0A0]">
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Message composer */}
        <div className="px-4 pb-4">
          <form
            className="mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-[22px] border border-[#3D3D3A] bg-[#30302E] px-4 pt-3 pb-3 shadow-[0_4px_30px_rgba(0,0,0,0.3)] transition-colors focus-within:border-[#5A5955]"
            aria-label="Message composer"
            onSubmit={handleSubmit}
          >
            <input
              className="w-full bg-transparent px-1 py-2 text-[16px] text-[#FAF9F5] outline-none placeholder:text-[#8A8880]"
              type="text"
              placeholder="How can I help you today?"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={sendStatus === 'loading'}
            />

            <div className="flex items-center justify-between">
              {/* Voice Recorder Integration */}
              <VoiceRecorder
                onTranscription={(transcribedText) => {
                  setMessage((prev) => (prev ? `${prev} ${transcribedText}` : transcribedText))
                }}
              />

              <button
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#C96442] text-white transition-colors hover:bg-[#D97757] disabled:bg-[#4A3A33] disabled:text-[#8A7A72]"
                type="submit"
                aria-label="Send message"
                disabled={!message.trim() || sendStatus === 'loading'}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M12 19V5M12 5l-6 6M12 5l6 6"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </form>

          <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-[#8A8880]">
            ChatGPT clone can make mistakes. Check important info.
          </p>
        </div>
      </main>
    </div>
  )
}