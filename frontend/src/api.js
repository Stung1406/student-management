const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    let message = `Yêu cầu thất bại (${response.status})`
    try {
      const body = await response.json()
      if (typeof body.detail === 'string') {
        message = body.detail
      } else if (Array.isArray(body.detail)) {
        message = body.detail.map((item) => item.msg).filter(Boolean).join(', ') || message
      }
    } catch {
      message = response.statusText || message
    }
    throw new Error(message)
  }

  return response.status === 204 ? null : response.json()
}

export const api = {
  getClasses: () => request('/classrooms'),
  getStudents: (classid) => {
    const query = classid ? `?${new URLSearchParams({ classid })}` : ''
    return request(`/students${query}`)
  },
  createStudent: (data) => request('/students', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateStudent: (id, data) => request(`/students/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  deleteStudent: (id) => request(`/students/${id}`, { method: 'DELETE' }),
}
