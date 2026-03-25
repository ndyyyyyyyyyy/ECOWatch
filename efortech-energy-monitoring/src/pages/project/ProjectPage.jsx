import { useEffect, useMemo, useState } from 'react'
import { Button, Dropdown, Typography, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import './project-page.css'
import { Bell, ChevronRight, Cpu, Home, LogOut, Moon, PencilLine, Settings, SquarePlus, Sun, Trash2, User } from 'lucide-react'
import {
  buildDeviceItems,
  createDeviceFormState,
  getDevicePropertySchema,
} from './projectStorage.js'
import {
  connectProjectStream,
  fetchProjectDevices,
  subscribeProjectDevice,
  unsubscribeProjectDevice,
  updateProjectDevice,
} from '../../api/projectApi.js'

const { Text } = Typography
function ProjectPage({ user, onSignOut }) {
  const navigate = useNavigate()
  const [devices, setDevices] = useState([])
  const [activeDeviceId, setActiveDeviceId] = useState(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [time, setTime] = useState('')
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

  function toggleSelectedDevice(deviceId) {
    setActiveDeviceId((prev) => (prev === deviceId ? null : deviceId))
  }

  function openEditModal() {
    const selectedDevice = devices.find((device) => device.id === activeDeviceId)
    if (!selectedDevice) {
      return
    }

    setEditForm(
      createDeviceFormState(
        selectedDevice.properties.find((property) => property.label === 'Device Type')?.value || 'Modicon',
        selectedDevice.properties.reduce((accumulator, property) => {
        accumulator[property.label] = property.value
        return accumulator
        }, {}),
      ),
    )
    setIsEditModalOpen(true)
  }

  function closeEditModal() {
    setIsEditModalOpen(false)
  }

  function openAddModal() {
    setAddForm(createDeviceFormState('Modicon'))
    setIsAddModalOpen(true)
  }

  function closeAddModal() {
    setIsAddModalOpen(false)
  }

  function openDeleteModal() {
    if (!activeDevice) {
      return
    }
    setIsDeleteModalOpen(true)
  }

  function closeDeleteModal() {
    setIsDeleteModalOpen(false)
  }

  function handleAddFieldChange(label, value) {
    setAddForm((prev) => {
      if (label === 'Device Type') {
        return createDeviceFormState(value, { ...prev, [label]: value })
      }
      return {
        ...prev,
        [label]: value,
      }
    })
  }

  function handleEditFieldChange(label, value) {
    setEditForm((prev) => {
      if (label === 'Device Type') {
        return createDeviceFormState(value, { ...prev, [label]: value })
      }
      return {
        ...prev,
        [label]: value,
      }
    })
  }

  function buildPropertiesFromForm(formState) {
    return getDevicePropertySchema(formState['Device Type'] || 'Modicon').map((property) => ({
      label: property.label,
      value: formState[property.label] ?? property.value,
    }))
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
        message.success(`Updated device configuration for "${nextDeviceName}".`)
      })
      .catch((error) => {
        message.error(error?.response?.data?.detail || 'Failed to update device configuration.')
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
        message.success(`Added device configuration for "${deviceName}".`)
      })
      .catch((error) => {
        message.error(error?.response?.data?.detail || 'Failed to subscribe device.')
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

  function openTagConfiguration(device, item) {
    if (item.kind !== 'tag') {
      return
    }

    navigate(`/project/tag/${device.id}/${item.id}`, {
      state: {
        deviceName: device.name,
        tagLabel: item.label,
        tags: device.tags || [],
      },
    })
  }

  function getMatchTone(device) {
    if (device?.matchStatus === 'matched') {
      return 'Matched'
    }
    if (device?.matchStatus === 'mismatch') {
      return 'Mismatch'
    }
    return 'Waiting'
  }

  const canAddDevice = mqttEnabled
  const canDeleteDevice = devices.some((device) => device.id === activeDeviceId)
  const activeDevice = devices.find((device) => device.id === activeDeviceId) ?? null
  const activeDeviceItems = useMemo(() => (activeDevice ? buildDeviceItems(activeDevice) : []), [activeDevice])
  const activeDeviceType = activeDevice?.properties.find((property) => property.label === 'Device Type')?.value || 'Modicon'
  const visibleActiveDeviceProperties = useMemo(
    () => {
      const visibleLabels = new Set(getDevicePropertySchema(activeDeviceType).map((property) => property.label))
      return (activeDevice?.properties || []).filter((property) => visibleLabels.has(property.label))
    },
    [activeDevice, activeDeviceType],
  )
  const addFormFields = useMemo(() => getDevicePropertySchema(addForm['Device Type'] || 'Modicon'), [addForm])
  const editFormFields = useMemo(() => getDevicePropertySchema(editForm['Device Type'] || activeDeviceType), [editForm, activeDeviceType])

  useEffect(() => {
    let isMounted = true

    fetchProjectDevices()
      .then((response) => {
        if (!isMounted) {
          return
        }
        applyBackendDevices(response)
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

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date()
      const options = {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }
      setTime(now.toLocaleString('en-GB', options).replace(',', ''))
    }

    updateDateTime()
    const timer = setInterval(updateDateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  const settingsMenuItems = [
    {
      key: 'user-info',
      label: (
        <div style={{ padding: '4px 0', borderBottom: '1px solid #f0f0f0', marginBottom: '4px' }}>
          <Text strong style={{ display: 'block' }}>{user || 'Guest'}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>{String(user || 'guest').toLowerCase()}</Text>
        </div>
      ),
      icon: <User size={16} />,
      disabled: true,
    },
    {
      key: 'portal',
      label: 'App Launcher (Portal)',
      icon: <Home size={16} />,
      onClick: () => navigate('/portal'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      label: 'Logout',
      icon: <LogOut size={16} color="#ff4d4f" />,
      onClick: onSignOut,
      danger: true,
    },
  ]

  const addDisabled = !canAddDevice
  const editDisabled = !activeDevice

  return (
    <main className={`project-page ${isDarkMode ? 'is-dark' : ''}`}>
      <header className="project-topbar">
        <div className="project-left">
          <button type="button" className="project-brand-btn" onClick={() => navigate('/portal')}>
            <span className="project-brand-title">Project Manager</span>
            <span className="project-brand-subtitle">Manage devices and jump into tag configuration from a single workspace.</span>
          </button>
        </div>
        <div className="project-right project-topbar-tools">
          <Text className="project-topbar-time">{time}</Text>
          <Button
            type="text"
            shape="circle"
            className="project-topbar-icon-btn"
            icon={isDarkMode ? <Sun size={20} color="#ffffff" /> : <Moon size={20} color="#595959" />}
            onClick={() => setIsDarkMode(!isDarkMode)}
          />
          <Button
            type="text"
            shape="circle"
            className="project-topbar-icon-btn"
            icon={<Bell size={20} color={isDarkMode ? '#ffffff' : '#595959'} />}
          />
          <Dropdown menu={{ items: settingsMenuItems }} placement="bottomRight" trigger={['click']}>
            <Button
              type="text"
              shape="circle"
              className="project-topbar-icon-btn"
              icon={<Settings size={20} color={isDarkMode ? '#ffffff' : '#595959'} />}
            />
          </Dropdown>
        </div>
      </header>

      <section className="project-content">
        <div className="project-layout">
          <aside className="project-device-panel">
            <div className="project-panel-head project-panel-head-actions">
              <div>
                <h2>Devices</h2>
                <span>{devices.length} registered</span>
              </div>
              <div className="project-toolbar-actions">
                <button type="button" className="project-action-btn" disabled={addDisabled} onClick={openAddModal}>
                  <SquarePlus size={18} strokeWidth={1.8} />
                  Add
                </button>
                <button type="button" className="project-action-btn" disabled={!canDeleteDevice} onClick={openDeleteModal}>
                  <Trash2 size={18} strokeWidth={1.8} />
                  Delete
                </button>
              </div>
            </div>
            <div className="project-device-list">
              {devices.map((device) => {
                const isActive = activeDeviceId === device.id
                return (
                  <button
                    type="button"
                    key={device.id}
                    className={`project-device-card ${isActive ? 'is-active' : ''}`}
                    onClick={() => toggleSelectedDevice(device.id)}
                  >
                    <div className="project-device-card-top">
                      <strong>{device.name}</strong>
                      <span>{device.tags.length} tags</span>
                    </div>
                    <div className="project-device-card-meta">
                      <span>{device.properties.find((property) => property.label === 'Device Type')?.value || 'Device'}</span>
                      <span>{getMatchTone(device)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>

          <div className="project-main-panel">
            {activeDevice ? (
              <>
                <section className="project-summary-card">
                  <div className="project-summary-copy">
                    <p className="project-summary-kicker">Selected Device</p>
                    <div className="project-summary-title-row">
                      <div>
                        <h2>{activeDevice.name}</h2>
                      </div>
                      <button type="button" className="project-summary-edit-btn" disabled={editDisabled} onClick={openEditModal}>
                        <PencilLine size={18} strokeWidth={1.8} />
                        Edit
                      </button>
                    </div>
                  </div>
                  <div className="project-summary-stats">
                    <div className="project-stat-card">
                      <span>Tags</span>
                      <strong>{activeDevice.tags.length}</strong>
                    </div>
                    <div className="project-stat-card">
                      <span>Blocks</span>
                      <strong>{activeDeviceItems.filter((item) => item.kind === 'block').length}</strong>
                    </div>
                    <div className="project-stat-card">
                      <span>Unit</span>
                      <strong>{activeDevice.properties.find((property) => property.label === 'Unit Number')?.value || '0'}</strong>
                    </div>
                  </div>
                </section>

                <div className="project-detail-grid">
                  <section className="project-section-card">
                    <div className="project-panel-head">
                      <div>
                        <h2>Tag and Block Access</h2>
                        <span>Open tag management directly or review block availability.</span>
                      </div>
                    </div>
                    <div className="project-shortcut-grid">
                      {activeDeviceItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`project-shortcut-card ${item.kind === 'tag' ? 'is-tag' : 'is-block'} ${item.kind === 'tag' ? 'is-clickable' : 'is-static'}`}
                          onClick={() => openTagConfiguration(activeDevice, item)}
                        >
                          <div className="project-shortcut-icon">
                            {item.kind === 'tag' ? <Cpu size={18} strokeWidth={1.9} /> : <SquarePlus size={18} strokeWidth={1.9} />}
                          </div>
                          <div className="project-shortcut-copy">
                            <strong>{item.label}</strong>
                            <span>{item.kind === 'tag' ? 'Manage device data points' : 'Block configuration placeholder'}</span>
                          </div>
                          {item.kind === 'tag' && <ChevronRight size={18} strokeWidth={1.9} />}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="project-section-card">
                    <div className="project-panel-head">
                      <div>
                        <h2>Device Properties</h2>
                        <span>Editable via the selected device action.</span>
                      </div>
                    </div>
                    <div className="project-property-grid">
                      {visibleActiveDeviceProperties.map((property) => (
                        <div className="project-property-item" key={property.label}>
                          <div className="project-property-label">{property.label}</div>
                          <div className="project-property-value">{property.value || '\u00A0'}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <div className="project-empty-state">
                <h2>Select a device</h2>
                <p>Choose one device from the left panel to inspect properties and open its tag manager.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {isEditModalOpen && activeDevice && (
        <div className="project-modal-backdrop" role="presentation">
          <div className="project-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="project-modal-head">
              <h3>Edit Device Configuration</h3>
            </div>

            <form className="project-modal-form" onSubmit={handleEditSubmit}>
              {editFormFields.map((property) => (
                <label className="project-modal-field" key={property.label}>
                  <span>{property.label}</span>
                  {property.label === 'Device Type' ? (
                    <select value={editForm[property.label] ?? property.value} onChange={(event) => handleEditFieldChange(property.label, event.target.value)}>
                      <option value="Modicon">Modicon</option>
                      <option value="MQTT">MQTT</option>
                    </select>
                  ) : (
                    <input
                      type={property.label === 'Password' ? 'password' : 'text'}
                      value={editForm[property.label] ?? ''}
                      onChange={(event) => handleEditFieldChange(property.label, event.target.value)}
                    />
                  )}
                </label>
              ))}

              <div className="project-modal-actions">
                <button type="button" className="project-modal-secondary" onClick={closeEditModal}>
                  Cancel
                </button>
                <button type="submit" className="project-modal-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="project-modal-backdrop" role="presentation">
          <div className="project-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="project-modal-head">
              <h3>Add Device</h3>
            </div>

            <form className="project-modal-form" onSubmit={handleAddSubmit}>
              {addFormFields.map((property) => (
                <label className="project-modal-field" key={property.label}>
                  <span>{property.label}</span>
                  {property.label === 'Device Type' ? (
                    <select value={addForm[property.label] ?? property.value} onChange={(event) => handleAddFieldChange(property.label, event.target.value)}>
                      <option value="Modicon">Modicon</option>
                      <option value="MQTT">MQTT</option>
                    </select>
                  ) : (
                    <input
                      type={property.label === 'Password' ? 'password' : 'text'}
                      value={addForm[property.label] ?? ''}
                      onChange={(event) => handleAddFieldChange(property.label, event.target.value)}
                    />
                  )}
                </label>
              ))}

              <div className="project-modal-actions">
                <button type="button" className="project-modal-secondary" onClick={closeAddModal}>
                  Cancel
                </button>
                <button type="submit" className="project-modal-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteModalOpen && activeDevice && (
        <div className="project-modal-backdrop" role="presentation">
          <div className="project-modal project-confirm-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="project-modal-head">
              <h3>Delete Device</h3>
            </div>

            <div className="project-modal-form">
              <p className="project-confirm-copy">
                Delete device <strong>{activeDevice.name}</strong>?
              </p>
              <div className="project-modal-actions">
                <button type="button" className="project-modal-secondary" onClick={closeDeleteModal}>
                  Cancel
                </button>
                <button type="button" className="project-modal-primary project-modal-danger" onClick={handleDeleteDevice}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default ProjectPage
