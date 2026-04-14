export const PROJECT_STORAGE_KEY = 'project_dummy_devices'

export const initialDevices = []

export const emptyTagForm = {
  name: '',
  type: 'analog',
  description: 'Analog Input',
  address: '',
  logData: 'yes',
}

export const devicePropertyTemplates = {
  Modicon: [
    { label: 'Device Name', value: '' },
    { label: 'Description', value: '' },
    { label: 'Unit Number', value: '' },
    { label: 'Device Type', value: 'Modicon' },
    { label: 'Primary IP Address', value: '' },
    { label: 'Primary Port Number', value: '' },
    { label: 'Primary Device Address', value: '' },
  ],
  MQTT: [
    { label: 'Device Name', value: '' },
    { label: 'Description', value: '' },
    { label: 'Unit Number', value: '' },
    { label: 'Device Type', value: 'MQTT' },
    { label: 'Heartbeat Frequency (second)', value: '' },
    { label: 'Device ID', value: '' },
    { label: 'Username', value: '' },
    { label: 'Password', value: '' },
    { label: 'IP Address', value: '' },
    { label: 'Port Number', value: '' },
  ],
}

export function getDeviceTypeFromProperties(properties = []) {
  const deviceType = properties.find((property) => property.label === 'Device Type')?.value
  return devicePropertyTemplates[deviceType] ? deviceType : 'Modicon'
}

export function getDevicePropertySchema(deviceType = 'Modicon') {
  return devicePropertyTemplates[deviceType] || devicePropertyTemplates.Modicon
}

export function createDeviceFormState(deviceType = 'Modicon', existingValues = {}) {
  return getDevicePropertySchema(deviceType).reduce((accumulator, property) => {
    accumulator[property.label] = existingValues[property.label] ?? property.value
    return accumulator
  }, {})
}

export function mergeDeviceProperties(properties = [], deviceName = '') {
  const schema = getDevicePropertySchema(getDeviceTypeFromProperties(properties))
  const propertyMap = Object.fromEntries((properties || []).map((property) => [property.label, property.value]))

  return schema.map((defaultProperty, index) => {
    if (Object.prototype.hasOwnProperty.call(propertyMap, defaultProperty.label)) {
      return {
        ...defaultProperty,
        value: propertyMap[defaultProperty.label] ?? defaultProperty.value,
      }
    }

    if (index === 0 && deviceName) {
      return {
        ...defaultProperty,
        value: deviceName,
      }
    }

    return { ...defaultProperty }
  })
}

export function cloneDevices(devices) {
  return JSON.parse(JSON.stringify(devices))
}

export function buildDeviceItems(device) {
  return (device.items || []).map((item) => {
    if (item.kind !== 'tag') {
      return item
    }

    return {
      ...item,
      label: `Tag(${device.tags.length})`,
    }
  })
}

export function buildPropertiesFromForm(formState) {
  return getDevicePropertySchema(formState['Device Type'] || 'Modicon').map((property) => ({
    label: property.label,
    value: formState[property.label] ?? property.value,
  }))
}

export function getDeviceTypeLabel(device) {
  return device?.properties?.find((property) => property.label === 'Device Type')?.value || 'Device'
}

export function getUnitNumberLabel(device) {
  return device?.properties?.find((property) => property.label === 'Unit Number')?.value || '0'
}

export function getDeviceMatchTone(device) {
  if (!device?.deployed) {
    return 'Draft'
  }
  if (device?.matchStatus === 'matched') {
    return 'Matched'
  }
  if (device?.matchStatus === 'mismatch') {
    return 'Mismatch'
  }
  return 'Waiting'
}

export function getTagMatchTone(tag) {
  if (tag?.matchStatus === 'matched') {
    return 'Matched'
  }
  if (tag?.matchStatus === 'mismatch') {
    return 'Mismatch'
  }
  return 'Waiting'
}

export function getVisibleDeviceProperties(device, activeDeviceType) {
  const visibleLabels = new Set(getDevicePropertySchema(activeDeviceType).map((property) => property.label))
  return (device?.properties || []).filter((property) => visibleLabels.has(property.label))
}

export function getTagAddressValue(deviceType, tag) {
  if (deviceType === 'Modicon') {
    return tag?.sourceAddress || tag?.address || '-'
  }
  return tag?.address || '-'
}

function normalizeDevices(devices) {
  return devices.map((device) => ({
    ...device,
    properties: mergeDeviceProperties(device.properties || [], device.name),
    tags: device.tags || [],
    items: device.items || [],
  }))
}

export function loadProjectDevices() {
  try {
    const rawValue = localStorage.getItem(PROJECT_STORAGE_KEY)
    if (!rawValue) {
      return cloneDevices(initialDevices)
    }

    const parsedValue = JSON.parse(rawValue)
    return Array.isArray(parsedValue) ? normalizeDevices(parsedValue) : cloneDevices(initialDevices)
  } catch {
    return cloneDevices(initialDevices)
  }
}

export function saveProjectDevices(devices) {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(devices))
}
