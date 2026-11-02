
import { useCallback, useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import {
  createLocalSession,
  fetchConversation,
  fetchConversations,
  sendChatMessage,
  setActiveSession,
} from '../state/sessionSlice'

export function useSession() {
  const dispatch = useDispatch()

  const {
    sessions,
    activeSessionId,
    listStatus,
    detailStatus,
    sendStatus,
    error,
  } = useSelector((state) => state.chatSession)

  // Fetch conversations when the hook is mounted.
  useEffect(() => {
    if (listStatus === 'idle') {
      dispatch(fetchConversations())
    }
  }, [dispatch, listStatus])

  // Get currently selected conversation.
  const activeSession = useMemo(
    () =>
      sessions.find((session) => session.id === activeSessionId) || null,
    [sessions, activeSessionId],
  )
//   console.log('[CHAT DEBUG]', {
//   activeSession,
//   messages: activeSession?.messages,
//   messageCount: activeSession?.messages?.length,
// })

  // Create a local conversation.
  const createSession = useCallback(
    (title = 'New Chat') => {
      const session = {
        id: crypto.randomUUID(),
        title,
        createdAt: new Date().toISOString(),
        messages: [],
        isLocal: true,
      }

      dispatch(createLocalSession(session))

      return session
    },
    [dispatch],
  )

  // Select a conversation and fetch it only if it exists on the backend.
  const setActive = useCallback(
    (id) => {
      dispatch(setActiveSession(id))

      const selectedSession = sessions.find(
        (session) => session.id === id,
      )

      if (!selectedSession || selectedSession.isLocal) {
        return
      }

      // Avoid fetching messages repeatedly if already loaded.
      if (
        selectedSession.messages?.length > 0 ||
        detailStatus[id] === 'loading'
      ) {
        return
      }

      dispatch(fetchConversation(id))
    },
    [dispatch, sessions, detailStatus],
  )

  // Send a message to the currently selected conversation.

const sendMessage = useCallback(
  (message) => {
    if (!message?.trim()) {
      return Promise.reject(new Error('Message cannot be empty'))
    }

    // Use existing active session or create a new local one.
    let sessionToUse = activeSession

    if (!sessionToUse) {
      sessionToUse = {
        id: crypto.randomUUID(),
        title: 'New Chat',
        createdAt: new Date().toISOString(),
        messages: [],
        isLocal: true,
      }

      dispatch(createLocalSession(sessionToUse))
    }

    // console.log('[SEND MESSAGE]', {
    //   sessionId: sessionToUse.id,
    //   isLocal: sessionToUse.isLocal,
    //   message,
    // })

    return dispatch(
      sendChatMessage({
        message: message.trim(),

        conversationId: sessionToUse.isLocal
          ? undefined
          : sessionToUse.id,

        localSessionId: sessionToUse.isLocal
          ? sessionToUse.id
          : undefined,
      }),
    ).unwrap()
  },
  [dispatch, activeSession],
)


  return {
    sessions,
    activeSession,
    activeSessionId,

    listStatus,

    activeSessionStatus: activeSessionId
      ? detailStatus[activeSessionId] || 'idle'
      : null,

    sendStatus,
    error,

    createSession,
    setActive,
    sendMessage,
  }
}
