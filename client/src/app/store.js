import { configureStore } from '@reduxjs/toolkit'
import authReducer from '../features/auth/state/authSlice'
import chatSessionReducer from '../features/chat/state/sessionSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    chatSession: chatSessionReducer,
  },
})
