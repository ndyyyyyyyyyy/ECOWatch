import { useEffect, useMemo, useState } from 'react'
import { message } from 'antd'

import {
  buildDeviceItems,
  buildPropertiesFromForm,
  createDeviceFormState,
  getDevicePropertySchema,
  getVisibleDeviceProperties,
} from '../projectStorage.js'
import {
  connectProjectStream,
  deployProjectDevice,
  fetchProjectDevices,
  subscribeProjectDevice,
  unsubscribeProjectDevice,
  updateProjectDevice,
} from '../../../api/projectApi.js'

export function useProjectManager() {
  const [devices, setDevices] = useState([])
  const [activeDeviceId, setActiveDeviceId] = useState(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [addForm, setAddForm] = useState(() => createDeviceFormState('Modicon'))
  const [editForm, setEditForm] = useState({})
  const [backendStatus, setBackendStatus] = useState('')
  const [mqttEnabled, setMqttEnabled] = useState(false)

  function applyBackendDevices(response) {
    const apiDevices = Array.isArray(response?.devices) ? response.devices : []
    setDevices(apiDevices)
    setBackendStatus(response?.status?.message || '')
    setMqttEnabled(Boolean(response?.status?.mqttEnabled))
    setActiveDeviceId((prev) => {
      if (prev && apiDevices.some((device) => device.id === prev)) {
        return prev
      }
      return apiDevices[0]?.id ?? null
    })
  }

  async function refreshProjectDevices() {
    const response = await fetchProjectDevices()
    applyBackendDevices(response)
    return response
  }

  const activeDevice = useMemo(
    () => devices.find((device) => device.id === activeDeviceId) ?? null,
    [devices, activeDeviceId],
  )
  const activeDeviceItems = useMemo(() => (activeDevice ? buildDeviceItems(activeDevice) : []), [activeDevice])
  const activeDeviceType = activeDevice?.properties.find((property) => property.label === 'Device Type')?.value || 'Modicon'
  const visibleActiveDeviceProperties = useMemo(
    () => getVisibleDeviceProperties(activeDevice, activeDeviceType),
    [activeDevice, activeDeviceType],
  )
  const addFormFields = useMemo(() => getDevicePropertySchema(addForm['Device Type'] || 'Modicon'), [addForm])
  const editFormFields = useMemo(() => getDevicePropertySchema(editForm['Device Type'] || activeDeviceType), [editForm, activeDeviceType])

  function toggleSelectedDevice(deviceId) {
    setActiveDeviceId((prev) => (prev === deviceId ? null : deviceId))
  }

  function openAddModal() {
    setAddForm(createDeviceFormState('Modicon'))
    setIsAddModalOpen(true)
  }

  function openEditModal() {
    if (!activeDevice) {
      return
    }

    setEditForm(
      createDeviceFormState(
        activeDeviceType,
        activeDevice.properties.reduce((accumulator, property) => {
          accumulator[property.label] = property.value
          return accumulator
        }, {}),
      ),
    )
    setIsEditModalOpen(true)
  }

  function openDeleteModal() {
    if (!activeDevice) {
      return
    }
    setIsDeleteModalOpen(true)
  }

  function handleAddFieldChange(label, value) {
    setAddForm((prev) => {
      if (label === 'Device Type') {
        return createDeviceFormState(value, { ...prev, [label]: value })
      }
      return { ...prev, [label]: value }
    })
  }

  function handleEditFieldChange(label, value) {
    setEditForm((prev) => {
      if (label === 'Device Type') {
        return createDeviceFormState(value, { ...prev, [label]: value })
      }
      return { ...prev, [label]: value }
    })
  }

  function handleAddSubmit(event) {
    event.preventDefault()
    const properties = buildPropertiesFromForm(addForm)
    const deviceName = addForm['Device Name'] || 'Device'

    subscribeProjectDevice(properties)
      .then(() => refreshProjectDevices())
      .then((response) => {
        const addedDevice = response?.devices?.find((device) => device.name === deviceName)
        if (addedDevice) {
          setActiveDeviceId(addedDevice.id)
        }
        setIsAddModalOpen(false)
        message.success(`Device "${deviceName}" saved. Deploy device to start data stream.`)
      })
      .catch((error) => {
        message.error(error?.response?.data?.detail || 'Failed to subscribe device.')
      })
  }

  function handleEditSubmit(event) {
    event.preventDefault()
    if (!activeDevice) {
      return
    }

    const properties = buildPropertiesFromForm(editForm)
    const nextDeviceName = editForm['Device Name'] || activeDevice.name

    updateProjectDevice(activeDevice.name, properties)
      .then(() => refreshProjectDevices())
      .then((response) => {
        const updatedDevice = response?.devices?.find((device) => device.name === nextDeviceName)
        if (updatedDevice) {
          setActiveDeviceId(updatedDevice.id)
        }
        setIsEditModalOpen(false)
        message.success(`Configuration for "${nextDeviceName}" saved. Deploy device to apply changes.`)
      })
      .catch((error) => {
        message.error(error?.response?.data?.detail || 'Failed to update device configuration.')
      })
  }

  function handleDeleteDevice() {
    if (!activeDevice) {
      return
    }

    unsubscribeProjectDevice(activeDevice.name)
      .then(() => refreshProjectDevices())
      .then(() => {
        setIsDeleteModalOpen(false)
        message.success(`Unsubscribed device "${activeDevice.name}".`)
      })
      .catch((error) => {
        message.error(error?.response?.data?.detail || 'Failed to unsubscribe device.')
      })
  }

  function handleDeployDevice() {
    if (!activeDevice) {
      return
    }

    deployProjectDevice(activeDevice.name)
      .then(() => refreshProjectDevices())
      .then(() => {
        message.success(`Device "${activeDevice.name}" deployed.`)
      })
      .catch((error) => {
        message.error(error?.response?.data?.detail || 'Failed to deploy device.')
      })
  }

  const canAddDevice = mqttEnabled
  const canDeleteDevice = devices.some((device) => device.id === activeDeviceId)

  useEffect(() => {
    let isMounted = true

    fetchProjectDevices()
      .then((response) => {
        if (isMounted) {
          applyBackendDevices(response)
        }
      })
      .catch(() => {
        if (!isMounted) {
          return
        }
        setDevices([])
        setBackendStatus('Failed to fetch MQTT project data.')
        setMqttEnabled(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const stream = connectProjectStream((response) => {
      applyBackendDevices(response)
    })

    return () => {
      stream.close()
    }
  }, [])

  return {
    devices,
    activeDeviceId,
    activeDevice,
    activeDeviceItems,
    visibleActiveDeviceProperties,
    addForm,
    editForm,
    addFormFields,
    editFormFields,
    backendStatus,
    mqttEnabled,
    isAddModalOpen,
    isEditModalOpen,
    isDeleteModalOpen,
    canAddDevice,
    canDeleteDevice,
    addDisabled: !canAddDevice,
    editDisabled: !activeDevice,
    toggleSelectedDevice,
    openAddModal,
    openEditModal,
    openDeleteModal,
    closeAddModal: () => setIsAddModalOpen(false),
    closeEditModal: () => setIsEditModalOpen(false),
    closeDeleteModal: () => setIsDeleteModalOpen(false),
    handleAddFieldChange,
    handleEditFieldChange,
    handleAddSubmit,
    handleEditSubmit,
    handleDeleteDevice,
    handleDeployDevice,
  }
}
