import { getAuthTokens, setAuthTokens } from "./auth";

export default async function api(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  try {
    var { access_token, refresh_token } = getAuthTokens();
  } catch (err) {
    throw "Please log in with `crsp login`";
  }
  if (!access_token || !refresh_token) {
    throw "Please log in with `crsp login`";
  }

  const API_BASE_URL = "https://api.crawlspace.dev"; // TODO: use env var for local dev
  const url = `${API_BASE_URL}${path}`;
  const headers = {
    Authorization: access_token,
    "Content-Type": "application/json",
  };

  const response = await fetch(url, { ...options, headers });
  if (
    response.status === 401 &&
    response.headers.get("x-please-refresh") === "true"
  ) {
    // console.log("Refreshing access token...");
    // hit em with the refresh token endpoint
    const refresh = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
      method: "POST",
      body: JSON.stringify({ token: refresh_token }),
    });
    if (refresh.ok) {
      const session = await refresh.json();
      setAuthTokens(session);
      // play it again sam!
      return await api(path, {
        ...options,
        headers: { ...options.headers, "x-do-not-refresh": "true" },
      });
    } else {
      throw "Could not refresh access token. Please run `crsp login`";
    }
  }

  return response;
}
