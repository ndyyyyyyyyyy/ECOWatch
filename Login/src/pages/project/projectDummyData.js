export const defaultDeviceProperties = [
  { label: 'Device Name', value: '' },
  { label: 'Description', value: '' },
  { label: 'Unit Number', value: '0' },
  { label: 'Device Type', value: 'Modicon' },
  { label: 'Use UDP :', value: '0' },
  { label: 'Packet Delay (ms) :', value: '0' },
  { label: 'Digital block size :', value: '512' },
  { label: 'Analog block size :', value: '64' },
  { label: 'Use RTU over TCP/IP ? (0:No, 1:Yes) :', value: '0' },
  { label: 'Receive Delay (ms):', value: '0' },
]

export const PROJECT_STORAGE_KEY = 'project_dummy_devices'

export const initialDevices = [
  {
    id: 1,
    name: 'ECU1051',
    properties: defaultDeviceProperties.map((property, index) => ({
      ...property,
      value: index === 0 ? 'ECU1051' : property.value,
    })),
    tags: [
      { id: 101, name: 'Current', type: 'analog', description: 'Analog Input', address: '40001' },
    ],
    items: [
      { id: 1, kind: 'tag', label: 'Tag(1)', tagGroupId: 'device-1-tags' },
      { id: 2, kind: 'block', label: 'Block(0)' },
    ],
  },
  {
    id: 2,
    name: 'ECU',
    properties: defaultDeviceProperties.map((property, index) => ({
      ...property,
      value: index === 0 ? 'Modbus' : property.value,
    })),
    tags: [
      { id: 201, name: 'Current', type: 'analog', description: 'Analog Input', address: '40001' },
      { id: 202, name: 'Item', type: 'analog', description: 'Analog Input', address: '40007' },
    ],
    items: [
      { id: 3, kind: 'tag', label: 'Tag(2)', tagGroupId: 'device-2-tags' },
      { id: 4, kind: 'block', label: 'Block(0)' },
    ],
  },
]

export function cloneDevices(devices) {
  return JSON.parse(JSON.stringify(devices))
}

export function buildDeviceItems(device) {
  return device.items.map((item) => {
    if (item.kind !== 'tag') {
      return item
    }

    return {
      ...item,
      label: `Tag(${device.tags.length})`,
    }
  })
}

export function loadProjectDevices() {
  try {
    const rawValue = localStorage.getItem(PROJECT_STORAGE_KEY)
    if (!rawValue) {
      return cloneDevices(initialDevices)
    }

    const parsedValue = JSON.parse(rawValue)
    return Array.isArray(parsedValue) ? parsedValue : cloneDevices(initialDevices)
  } catch {
    return cloneDevices(initialDevices)
  }
}

export function saveProjectDevices(devices) {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(devices))
}
