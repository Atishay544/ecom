async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error ?? json?.message ?? `Request failed: ${res.status}`)
  return json as T
}

export const api = {
  get:    <T>(path: string, options?: RequestInit) => request<T>(path, { method: 'GET', ...options }),
  post:   <T>(path: string, body: unknown, options?: RequestInit) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body), ...options }),
  put:    <T>(path: string, body: unknown, options?: RequestInit) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body), ...options }),
  patch:  <T>(path: string, body: unknown, options?: RequestInit) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body), ...options }),
  delete: <T>(path: string, options?: RequestInit) => request<T>(path, { method: 'DELETE', ...options }),
}
