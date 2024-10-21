import { getAuthTokens, setAuthTokens } from "./auth";

export default async function api<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  try {
    var { access_token, refresh_token } = getAuthTokens();
  } catch (err) {
    throw "Please log in with `crsp login`";
  }
  if (!access_token || !refresh_token) {
    throw "Please log in with `crsp login`";
  }

  const API_BASE_URL = "https://api.crawlspace.dev"; // TODO: use env var for local dev?
  const url = `${API_BASE_URL}${path}`;
  const headers = {
    Authorization: access_token,
    "Content-Type": "application/json",
  };

  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    console.log("Refreshing access token...");
    // hit em with the refresh token endpoint
    const refresh = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
      method: "POST",
      body: JSON.stringify({ token: refresh_token }),
    });
    if (refresh.ok) {
      const session = await refresh.json();
      setAuthTokens(session);
      // play it again sam!
      return await api(path, options);
    } else {
      throw "Could not refresh access token. Please run `crsp login`";
    }
  }

  if (!response.ok) {
    console.error(await response.text());
    throw { status: response.status, statusText: response.statusText };
  }

  return await response.json();
}
