import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    user: null,
    accessToken: null,
    isAuthenticated: false,
    initialized: false,
    loading: false,
    error: null,
}

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        authStart(state) {
            state.loading = true
            state.error = null
        },
        authSuccess(state, action) {
            state.loading = false
            state.user = action.payload.user
            state.accessToken = action.payload.accessToken
            state.isAuthenticated = true
            state.initialized = true
            state.error = null
        },
        tokenUpdated(state, action) {
            state.accessToken = action.payload.accessToken
            state.user = action.payload.user ?? state.user
            state.isAuthenticated = true
            state.initialized = true
        },
        authFailure(state, action) {
            state.loading = false
            state.error = action.payload
        },
        logoutSuccess() {
            return { ...initialState, initialized: true }
        },
        authBootstrapDone(state) {
            state.initialized = true
        },
        clearAuthError(state) {
            state.error = null
        },
    },
})

export const {
    authStart,
    authSuccess,
    tokenUpdated,
    authFailure,
    logoutSuccess,
    authBootstrapDone,
    clearAuthError,
} = authSlice.actions

export default authSlice.reducer
