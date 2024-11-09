import { PayloadAction, createSlice } from "@reduxjs/toolkit";

const initialState = {
    user: "",
    token: "",
};

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        userRegistration: (state, action: PayloadAction<{ token: string }>) => {
            state.token = action.payload.token;
        },
        userLogin: (state, action: PayloadAction<{ accessToken: string, user: string }>) => {
            state.token = action.payload.accessToken;
            state.user = action.payload.user;
        },
        userLogout: (state) => {
            state.token = "";
            state.user = "";
        },
    },
});

export const { userRegistration, userLogin, userLogout } = authSlice.actions;

export default authSlice.reducer;
