import { PayloadAction, createSlice } from "@reduxjs/toolkit";

type AuthUser = {
    _id: string;
    name: string;
    email: string;
    role: string;
    isVerified: boolean;
    avatar?: { public_id?: string; url?: string };
    videos?: Array<{ videoId: string }>;
};

const initialState = {
    user: null as AuthUser | null,
    token: "",
};

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        userRegistration: (state, action: PayloadAction<{ token: string }>) => {
            state.token = action.payload.token;
        },
        userLogin: (state, action: PayloadAction<{ user: AuthUser }>) => {
            state.token = "";
            state.user = action.payload.user;
        },
        userLogout: (state) => {
            state.token = "";
            state.user = null;
        },
    },
});

export const { userRegistration, userLogin, userLogout } = authSlice.actions;

export default authSlice.reducer;
