const SERVER_URL = process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace(/\/+$/, "") : "";
const API_BASE_URL = `${SERVER_URL}/api`;

const DEFAULT_TIMEOUT_MS = 12000;

// Estrae il body di una risposta HTTP
async function parseResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }
  const text = await response.text();
  return text ? { message: text } : {};
}

// Gestisce l'esito di una richiesta HTTP
async function handleResponse(response) {
  const data = await parseResponseBody(response);
  if (!response.ok) {
    const message = data?.error || data?.message || `Errore HTTP ${response.status}: ${response.statusText || "Richiesta non riuscita."}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

// Centralizza le impostazioni predefinite per le chiamate API
function buildRequestOptions(options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {})
  };

  const sessionId = sessionStorage.getItem("risiko_session");
  if (sessionId) {
    headers["x-session-id"] = sessionId;
  }

  return {
    method: options.method || "GET",
    headers,
    body: options.body,
    signal: options.signal,
    keepalive: options.keepalive ?? false,
    cache: options.cache || "no-store"
  };
}

// Esegue chiamate HTTP tramite fetch
async function request(endpoint, options = {}) {
  const timeoutMs = Number.isInteger(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  // Per browser moderni
  const timeoutSignal = typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(timeoutMs)
      : null;
  
  // Fallback per browser non moderni
  const controller = timeoutSignal ? null : new AbortController();
  const timeoutId = controller != null ? setTimeout(() => { controller.abort(); }, timeoutMs) : null;

  // Esegue la chiamata fetch
  try {
    const response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      buildRequestOptions({
        ...options,
        signal: options.signal || timeoutSignal || controller.signal
      })
    );
    return await handleResponse(response);
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      throw new Error("Timeout della richiesta al server.");
    }
    if (error instanceof Error) throw error;
    throw new Error("Errore di rete o server non raggiungibile.");
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// Gestisce la registrazione di un nuovo utente
export async function registerUser(username, email, password) {
  if (!username || !email || !password) throw new Error("Compila tutti i campi per registrarti.");
  return request("/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password })
  });
}

// Gestisce il login dell'utente
export async function loginUser(email, password) {
  if (!email || !password) throw new Error("Inserisci email e password.");
  return request("/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

// Recupera i dati del profilo attualmente autenticato
export async function getMe() {
  return request("/me", { method: "GET" });
}