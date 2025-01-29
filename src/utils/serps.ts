import api from "./api";

export function searchFactory() {
  return async (query: string): Promise<string[]> => {
    const q = encodeURIComponent(query);
    try {
      const response = await api(`/v1/serp/search?q=${q}`);
      const { urls } = await response.json();
      return urls;
    } catch (error) {
      console.error(error);
      throw error;
    }
  };
}
