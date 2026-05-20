import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/authSlice';
import profileReducer from '@/features/profile/profileSlice';
import chatReducer from '@/features/chat/chatSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    profile: profileReducer,
    chat: chatReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
