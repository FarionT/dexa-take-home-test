// Backend URL from frontend/.env (VITE_API_BASE_URL). Env changes need a dev-server restart.
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL

if (!apiBaseUrl) {
  throw new Error('VITE_API_BASE_URL is not set. Copy frontend/.env.example to frontend/.env and restart `npm run dev`.')
}

/** Without a trailing slash, so paths can start with "/". */
export const API_BASE_URL = apiBaseUrl.replace(/\/+$/, '')
