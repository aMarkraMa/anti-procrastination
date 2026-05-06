/**
 * Frontend runtime configuration.
 *
 * Adjust `apiBaseUrl` if the backend is hosted somewhere other than the local
 * FastAPI dev server (default `uvicorn app.main:app --reload` on port 8000).
 */
export const environment = {
  apiBaseUrl: 'http://localhost:8000',
};
