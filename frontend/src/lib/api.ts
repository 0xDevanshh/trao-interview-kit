import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error.response?.data?.error?.code;

    if (
      error.response?.status === 401 &&
      code === "TOKEN_EXPIRED" &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/login"
    ) {
      // Hard navigation on purpose: this runs outside React, and a full reload
      // also clears the stale zustand auth state left over from the expired session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login?reason=expired";
    }

    return Promise.reject(error);
  },
);
