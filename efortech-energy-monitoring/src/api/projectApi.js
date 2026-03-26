import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api/project',
  timeout: 8000,
})

export async function fetchProjectDevices() {
  const { data } = await apiClient.get('/devices')
  return data
}

export async function subscribeProjectDevice(properties) {
  const { data } = await apiClient.post('/devices/subscribe', { properties })
  return data
}

export async function updateProjectDevice(currentDeviceName, properties) {
  const { data } = await apiClient.post('/devices/update', { currentDeviceName, properties })
  return data
}

export async function unsubscribeProjectDevice(deviceName) {
  const { data } = await apiClient.delete(`/devices/${encodeURIComponent(deviceName)}`)
  return data
}

export async function deployProjectDevice(deviceName) {
  const { data } = await apiClient.post(`/devices/${encodeURIComponent(deviceName)}/deploy`)
  return data
}

export async function upsertProjectTag(deviceName, tag, currentTagName = '') {
  const { data } = await apiClient.post(`/devices/${encodeURIComponent(deviceName)}/tags`, { tag, currentTagName })
  return data
}

export async function deleteProjectTag(deviceName, tagName) {
  const { data } = await apiClient.delete(`/devices/${encodeURIComponent(deviceName)}/tags/${encodeURIComponent(tagName)}`)
  return data
}

export function connectProjectStream(onMessage) {
  const eventSource = new EventSource('/api/project/stream')
  eventSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data)
      onMessage(payload)
    } catch {
      return
    }
  }
  return eventSource
}
