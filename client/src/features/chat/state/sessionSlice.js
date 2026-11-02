
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { chatService } from '../service/chatService'

function getErrorMessage(
  error,
  fallback = 'Unable to load conversations',
) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  )
}

// Fetch all conversations.
export const fetchConversations = createAsyncThunk(
  'chatSession/fetchConversations',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await chatService.listConversations()
      return data.conversations || []
    } catch (error) {
      return rejectWithValue(getErrorMessage(error))
    }
  },
  {
    condition: (_, { getState }) =>
      getState().chatSession.listStatus !== 'loading',
  },
)

// Fetch one conversation.
export const fetchConversation = createAsyncThunk(
  'chatSession/fetchConversation',
  async (conversationId, { rejectWithValue }) => {
    try {
      const { data } = await chatService.getConversation(conversationId)
      return data.conversation
    } catch (error) {
      return rejectWithValue(getErrorMessage(error))
    }
  },
  {
    condition: (conversationId, { getState }) => {
      const { sessions, detailStatus } = getState().chatSession

      const conversation = sessions.find(
        (item) => item.id === conversationId,
      )

      return (
        !conversation?.isLocal &&
        conversation?.messages === undefined &&
        detailStatus[conversationId] !== 'loading'
      )
    },
  },
)

// Send a message and receive streamed AI response.
export const sendChatMessage = createAsyncThunk(
  'chatSession/sendChatMessage',
  async (
    { message, conversationId, localSessionId },
    { dispatch, rejectWithValue },
  ) => {
    const userMessage = {
      id: crypto.randomUUID(),
      author: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    }

    const aiMessageId = crypto.randomUUID()

    try {
      await chatService.sendMessageStream(
        message,
        conversationId,
        {
          // Create the conversation messages when streaming starts.
          onStart: ({
            conversationId: serverConversationId,
            title,
          }) => {
            if (!serverConversationId) {
              throw new Error(
                'Conversation ID is missing from the response',
              )
            }

            dispatch(
              streamStarted({
                conversationId: serverConversationId,
                localSessionId,
                title,
                userMessage,
                aiMessage: {
                  id: aiMessageId,
                  author: 'ai',
                  content: '',
                  images: [],
                  createdAt: new Date().toISOString(),
                },
              }),
            )
          },

          // Append each incoming text chunk.
        onChunk: (text) => {
  // console.log('[THUNK CHUNK]', {
  //   value: text,
  //   type: typeof text,
  // })

  if (typeof text !== 'string') {
    console.error('Expected string, received:', text)
    return
  }

  dispatch(
    streamChunkAppended({
      aiMessageId,
      text,
    }),
  )
},

          // Append generated images.
          onImage: (image) => {
            dispatch(
              streamImageAppended({
                aiMessageId,
                image,
              }),
            )
          },
        },
      )
    } catch (error) {
      return rejectWithValue(
        getErrorMessage(error, 'Unable to send message'),
      )
    }
  },
  {
    condition: (_, { getState }) =>
      getState().chatSession.sendStatus !== 'loading',
  },
)

const initialState = {
  activeSessionId: null,
  sessions: [],
  listStatus: 'idle',
  detailStatus: {},
  sendStatus: 'idle',
  error: null,
}

const sessionSlice = createSlice({
  name: 'chatSession',
  initialState,

  reducers: {
    // Replace sessions.
    setSessions(state, action) {
      state.sessions = action.payload
    },

    // Create a new local conversation.
    createLocalSession(state, action) {
      state.sessions.unshift(action.payload)
      state.activeSessionId = action.payload.id
      state.error = null
    },

    // Change active conversation.
    setActiveSession(state, action) {
      state.activeSessionId = action.payload
      state.error = null
    },

    // Initialize streaming messages.
    streamStarted(state, action) {
      const {
        conversationId,
        localSessionId,
        title,
        userMessage,
        aiMessage,
      } = action.payload

      const serverIndex = state.sessions.findIndex(
        (item) => item.id === conversationId,
      )

      const localIndex = localSessionId
        ? state.sessions.findIndex(
            (item) => item.id === localSessionId,
          )
        : -1

      if (serverIndex >= 0) {
        const session = state.sessions[serverIndex]

        session.messages = [
          ...(session.messages || []),
          userMessage,
          aiMessage,
        ]

        session.updatedAt = aiMessage.createdAt
      } else {
        const conversation = {
          id: conversationId,
          title: title || 'New chat',
          createdAt: userMessage.createdAt,
          updatedAt: aiMessage.createdAt,
          messages: [userMessage, aiMessage],
        }

        if (localIndex >= 0) {
          state.sessions[localIndex] = conversation
        } else {
          state.sessions.unshift(conversation)
        }
      }

      state.activeSessionId = conversationId
      state.detailStatus[conversationId] = 'succeeded'
      state.error = null
    },

    // Append streamed text to the correct AI message.
streamChunkAppended(state, action) {
  const { aiMessageId, text } = action.payload

  if (typeof text !== 'string') {
    return
  }

  const session = state.sessions.find((item) =>
    item.messages?.some(
      (message) => message.id === aiMessageId,
    ),
  )

  const aiMessage = session?.messages?.find(
    (message) => message.id === aiMessageId,
  )

  if (!aiMessage) {
    console.error('AI message not found:', aiMessageId)
    return
  }

  if (typeof aiMessage.content !== 'string') {
    aiMessage.content = ''
  }

  aiMessage.content += text
},
    // Append generated image to the correct AI message.
    streamImageAppended(state, action) {
      const { aiMessageId, image } = action.payload

      const session = state.sessions.find((item) =>
        item.messages?.some(
          (message) => message.id === aiMessageId,
        ),
      )

      const aiMessage = session?.messages?.find(
        (message) => message.id === aiMessageId,
      )

      if (!aiMessage) return

      aiMessage.images = [
        ...(aiMessage.images || []),
        image,
      ]
    },

    // Clear all conversations.
    clearSessions() {
      return { ...initialState }
    },
  },

  extraReducers: (builder) => {
    builder

      // Fetch conversation list.
      .addCase(fetchConversations.pending, (state) => {
        state.listStatus = 'loading'
        state.error = null
      })

      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.listStatus = 'succeeded'

        const localSessions = state.sessions.filter(
          (item) => item.isLocal,
        )

        const serverSessions = action.payload.map((conversation) => {
          const cached = state.sessions.find(
            (item) => item.id === conversation.id,
          )

          return cached?.messages !== undefined
            ? {
                ...conversation,
                messages: cached.messages,
              }
            : conversation
        })

        state.sessions = [
          ...localSessions,
          ...serverSessions,
        ]
      })

      .addCase(fetchConversations.rejected, (state, action) => {
        state.listStatus = 'failed'
        state.error =
          action.payload || action.error.message
      })

      // Fetch individual conversation.
      .addCase(fetchConversation.pending, (state, action) => {
        state.detailStatus[action.meta.arg] = 'loading'
        state.error = null
      })

      .addCase(fetchConversation.fulfilled, (state, action) => {
        const conversation = action.payload

        if (!conversation?.id) return

        state.detailStatus[conversation.id] = 'succeeded'

        const index = state.sessions.findIndex(
          (item) => item.id === conversation.id,
        )

        if (index >= 0) {
          // Preserve existing messages if they are already cached.
          const existing = state.sessions[index]

          if (existing.messages !== undefined) {
            return
          }

          state.sessions[index] = conversation
        } else {
          state.sessions.unshift(conversation)
        }
      })

      .addCase(fetchConversation.rejected, (state, action) => {
        state.detailStatus[action.meta.arg] = 'failed'
        state.error =
          action.payload || action.error.message
      })

      // Sending message.
      .addCase(sendChatMessage.pending, (state) => {
        state.sendStatus = 'loading'
        state.error = null
      })

      .addCase(sendChatMessage.fulfilled, (state) => {
        state.sendStatus = 'succeeded'
      })

      .addCase(sendChatMessage.rejected, (state, action) => {
        state.sendStatus = 'failed'
        state.error =
          action.payload || action.error.message
      })
  },
})

export const {
  setSessions,
  createLocalSession,
  setActiveSession,
  streamStarted,
  streamChunkAppended,
  streamImageAppended,
  clearSessions,
} = sessionSlice.actions

export default sessionSlice.reducer
