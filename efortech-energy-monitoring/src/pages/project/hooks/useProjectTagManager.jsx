import { useEffect, useMemo, useState } from 'react'
import { message } from 'antd'

import { connectProjectStream, deleteProjectTag, fetchProjectDevices, upsertProjectTag } from '../../../api/projectApi.js'
import { emptyTagForm } from '../projectStorage.js'

export function useProjectTagManager(deviceId) {
  const [devices, setDevices] = useState([])
  const [selectedTagIds, setSelectedTagIds] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTagTab, setActiveTagTab] = useState('all')
  const [isTagModalOpen, setIsTagModalOpen] = useState(false)
  const [tagModalMode, setTagModalMode] = useState('add')
  const [tagForm, setTagForm] = useState(emptyTagForm)
  const [backendStatus, setBackendStatus] = useState('')

  function applyBackendDevices(response) {
    const apiDevices = Array.isArray(response?.devices) ? response.devices : []
    setBackendStatus(response?.status?.message || '')
    setDevices(apiDevices)
  }

  const activeDevice = useMemo(
    () => devices.find((device) => String(device.id) === String(deviceId)) ?? null,
    [devices, deviceId],
  )
  const activeDeviceType = activeDevice?.properties.find((property) => property.label === 'Device Type')?.value || 'MQTT'

  const tagRows = useMemo(() => {
    if (!activeDevice) {
      return []
    }

    const typeFilteredTags =
      activeTagTab === 'all'
        ? activeDevice.tags
        : activeDevice.tags.filter((tag) => tag.type === activeTagTab)

    const keyword = searchTerm.trim().toLowerCase()
    if (!keyword) {
      return typeFilteredTags
    }

    return typeFilteredTags.filter((tag) => tag.name.toLowerCase().includes(keyword))
  }, [activeDevice, activeTagTab, searchTerm])

  const selectedTag = activeDevice?.tags.find((tag) => tag.id === selectedTagIds[0]) ?? null
  const canEdit = selectedTagIds.length === 1
  const canDelete = selectedTagIds.length > 0
  const analogCount = activeDevice?.tags.filter((row) => row.type === 'analog').length ?? 0
  const discreteCount = activeDevice?.tags.filter((row) => row.type === 'discrete').length ?? 0
  const textCount = activeDevice?.tags.filter((row) => row.type === 'text').length ?? 0
  const selectedVisibleCount = tagRows.filter((row) => selectedTagIds.includes(row.id)).length

  function openAddTagModal() {
    setTagModalMode('add')
    setTagForm(emptyTagForm)
    setIsTagModalOpen(true)
  }

  function openEditTagModal() {
    if (!selectedTag) {
      return
    }

    setTagModalMode('edit')
    setTagForm({
      name: selectedTag.name,
      type: selectedTag.type,
      description: selectedTag.description,
      address: activeDeviceType === 'Modicon' ? (selectedTag.sourceAddress || selectedTag.address) : selectedTag.address,
      logData: selectedTag.logData || 'yes',
    })
    setIsTagModalOpen(true)
  }

  function handleTagFieldChange(field, value) {
    setTagForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  function handleTagSubmit(event) {
    event.preventDefault()

    if (!activeDevice) {
      return
    }

    upsertProjectTag(activeDevice.name, tagForm, tagModalMode === 'edit' ? selectedTag?.address : '')
      .then(() => {
        setIsTagModalOpen(false)
        setSelectedTagIds([])
        message.success(
          tagModalMode === 'add'
            ? 'Tag configuration added. Deploy device to apply changes.'
            : 'Tag configuration updated. Deploy device to apply changes.',
        )
      })
      .catch((error) => {
        message.error(error?.response?.data?.detail || 'Failed to save tag configuration.')
      })
  }

  function handleDeleteTags() {
    if (!activeDevice || !selectedTagIds.length) {
      return
    }

    const confirmed = window.confirm(`Delete ${selectedTagIds.length} selected tag(s)?`)
    if (!confirmed) {
      return
    }

    const tagsToDelete = activeDevice.tags.filter((tag) => selectedTagIds.includes(tag.id))
    Promise.all(tagsToDelete.map((tag) => deleteProjectTag(activeDevice.name, tag.address)))
      .then(() => {
        setSelectedTagIds([])
        message.success('Tag configuration deleted. Deploy device to apply changes.')
      })
      .catch((error) => {
        message.error(error?.response?.data?.detail || 'Failed to delete tag configuration.')
      })
  }

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

  useEffect(() => {
    setSelectedTagIds([])
  }, [deviceId, activeTagTab])

  return {
    activeDevice,
    activeDeviceType,
    tagRows,
    selectedTagIds,
    selectedTag,
    searchTerm,
    activeTagTab,
    isTagModalOpen,
    tagModalMode,
    tagForm,
    backendStatus,
    canEdit,
    canDelete,
    analogCount,
    discreteCount,
    textCount,
    selectedVisibleCount,
    setSelectedTagIds,
    setSearchTerm,
    setActiveTagTab,
    openAddTagModal,
    openEditTagModal,
    closeTagModal: () => setIsTagModalOpen(false),
    toggleTagSelection: (tagId) =>
      setSelectedTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId])),
    handleTagFieldChange,
    handleTagSubmit,
    handleDeleteTags,
  }
}
