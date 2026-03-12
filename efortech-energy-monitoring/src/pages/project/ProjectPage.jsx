import { useEffect, useMemo, useState } from 'react'
import { Button, Dropdown, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import './project-page.css'
import { Bell, ChevronRight, Cpu, Home, LogOut, Moon, PencilLine, Settings, SquarePlus, Sun, Trash2, User } from 'lucide-react'
import { buildDeviceItems, defaultDeviceProperties, loadProjectDevices, saveProjectDevices } from './projectDummyData.js'

const { Text } = Typography

function ProjectPage({ user, onSignOut }) {
  const navigate = useNavigate()
  const [devices, setDevices] = useState(() => loadProjectDevices())
  const [activeDeviceId, setActiveDeviceId] = useState(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [time, setTime] = useState('')
  const [addForm, setAddForm] = useState(
    defaultDeviceProperties.reduce((accumulator, property) => {
      accumulator[property.label] = property.value
      return accumulator
    }, {}),
  )
  const [editForm, setEditForm] = useState({})

  function toggleSelectedDevice(deviceId) {
    setActiveDeviceId((prev) => (prev === deviceId ? null : deviceId))
  }

  function openEditModal() {
    const selectedDevice = devices.find((device) => device.id === activeDeviceId)
    if (!selectedDevice) {
      return
    }

    setEditForm(
      selectedDevice.properties.reduce((accumulator, property) => {
        accumulator[property.label] = property.value
        return accumulator
      }, {}),
    )
    setIsEditModalOpen(true)
  }

  function closeEditModal() {
    setIsEditModalOpen(false)
  }

  function openAddModal() {
    setAddForm(
      defaultDeviceProperties.reduce((accumulator, property) => {
        accumulator[property.label] = property.value
        return accumulator
      }, {}),
    )
    setIsAddModalOpen(true)
  }

  function closeAddModal() {
    setIsAddModalOpen(false)
  }

  function handleAddFieldChange(label, value) {
    setAddForm((prev) => ({
      ...prev,
      [label]: value,
    }))
  }

  function handleEditFieldChange(label, value) {
    setEditForm((prev) => ({
      ...prev,
      [label]: value,
    }))
  }

  function handleEditSubmit(event) {
    event.preventDefault()

    setDevices((prev) =>
      prev.map((device) =>
        device.id === activeDeviceId
          ? {
              ...device,
              name: editForm['Device Name'] || device.name,
              properties: device.properties.map((property) => ({
                ...property,
                value: editForm[property.label] ?? property.value,
              })),
            }
          : device,
      ),
    )

    setIsEditModalOpen(false)
  }

  function handleAddSubmit(event) {
    event.preventDefault()

    const nextId = devices.length ? Math.max(...devices.map((device) => device.id)) + 1 : 1
    const nextItemId = devices.flatMap((device) => device.items).length
      ? Math.max(...devices.flatMap((device) => device.items).map((item) => item.id)) + 1
      : 1

    const nextDevice = {
      id: nextId,
      name: addForm['Device Name'] || `Device ${nextId}`,
      properties: Object.entries(addForm).map(([label, value]) => ({ label, value })),
      tags: [],
      items: [
        { id: nextItemId, kind: 'tag', label: 'Tag(0)', tagGroupId: `device-${nextId}-tags` },
        { id: nextItemId + 1, kind: 'block', label: 'Block(0)' },
      ],
    }

    setDevices((prev) => [...prev, nextDevice])
    setActiveDeviceId(nextId)
    setIsAddModalOpen(false)
  }

  function handleDeleteDevice() {
    if (!activeDevice) {
      return
    }

    const confirmed = window.confirm(`Delete device "${activeDevice.name}"?`)
    if (!confirmed) {
      return
    }

    setDevices((prev) => prev.filter((device) => device.id !== activeDevice.id))
    setActiveDeviceId(null)
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

  const canAddDevice = activeDeviceId === null
  const canDeleteDevice = devices.some((device) => device.id === activeDeviceId)
  const activeDevice = devices.find((device) => device.id === activeDeviceId) ?? null
  const activeDeviceItems = useMemo(() => (activeDevice ? buildDeviceItems(activeDevice) : []), [activeDevice])

  useEffect(() => {
    saveProjectDevices(devices)
  }, [devices])

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
                <button type="button" className="project-action-btn" disabled={!canAddDevice} onClick={openAddModal}>
                  <SquarePlus size={18} strokeWidth={1.8} />
                  Add
                </button>
                <button type="button" className="project-action-btn" disabled={!canDeleteDevice} onClick={handleDeleteDevice}>
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
                      <span>{device.items.find((item) => item.kind === 'block')?.label || 'Block(0)'}</span>
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
                        <p>
                          {activeDevice.properties.find((property) => property.label === 'Description')?.value || 'No description set.'}
                        </p>
                      </div>
                      <button type="button" className="project-summary-edit-btn" onClick={openEditModal}>
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
                      {activeDevice.properties.map((property) => (
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
        <div className="project-modal-backdrop" role="presentation" onClick={closeEditModal}>
          <div className="project-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="project-modal-head">
              <h3>Edit Device</h3>
              <button type="button" className="project-modal-close" onClick={closeEditModal}>
                Close
              </button>
            </div>

            <form className="project-modal-form" onSubmit={handleEditSubmit}>
              {activeDevice.properties.map((property) => (
                <label className="project-modal-field" key={property.label}>
                  <span>{property.label}</span>
                  <input
                    type="text"
                    value={editForm[property.label] ?? ''}
                    onChange={(event) => handleEditFieldChange(property.label, event.target.value)}
                  />
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
        <div className="project-modal-backdrop" role="presentation" onClick={closeAddModal}>
          <div className="project-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="project-modal-head">
              <h3>Add Device</h3>
              <button type="button" className="project-modal-close" onClick={closeAddModal}>
                Close
              </button>
            </div>

            <form className="project-modal-form" onSubmit={handleAddSubmit}>
              {Object.keys(addForm).map((label) => (
                <label className="project-modal-field" key={label}>
                  <span>{label}</span>
                  <input
                    type="text"
                    value={addForm[label] ?? ''}
                    onChange={(event) => handleAddFieldChange(label, event.target.value)}
                  />
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
    </main>
  )
}

export default ProjectPage
