import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './project-page.css'
import efortechLogo from '../../assets/efortech_logo.png'
import { PencilLine, SquarePlus, Trash2 } from 'lucide-react'
import { buildDeviceItems, defaultDeviceProperties, loadProjectDevices, saveProjectDevices } from './projectDummyData.js'

function ProjectPage({ user, onSignOut }) {
  const navigate = useNavigate()
  const [devices, setDevices] = useState(() => loadProjectDevices())
  const [activeDeviceId, setActiveDeviceId] = useState(null)
  const [expandedIds, setExpandedIds] = useState([1, 2])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [addForm, setAddForm] = useState(
    defaultDeviceProperties.reduce((accumulator, property) => {
      accumulator[property.label] = property.value
      return accumulator
    }, {}),
  )
  const [editForm, setEditForm] = useState({})

  function toggleExpanded(deviceId) {
    setExpandedIds((prev) =>
      prev.includes(deviceId) ? prev.filter((item) => item !== deviceId) : [...prev, deviceId],
    )
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
    setExpandedIds((prev) => [...prev, nextId])
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
    setExpandedIds((prev) => prev.filter((id) => id !== activeDevice.id))
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
  const canEditDevice = devices.some((device) => device.id === activeDeviceId)
  const canDeleteDevice = canEditDevice
  const activeDevice = devices.find((device) => device.id === activeDeviceId) ?? null

  useEffect(() => {
    saveProjectDevices(devices)
  }, [devices])

  return (
    <main className="project-page">
      <header className="project-topbar">
        <div className="project-left">
          <button
            type="button"
            className="project-logo-btn"
            onClick={() => navigate('/portal')}
          >
            <img className="project-logo" src={efortechLogo} alt="Efortech" />
          </button>
        </div>
        <div className="project-right">
          <span className="project-user">{user}</span>
          <button type="button" className="project-signout-btn" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <section className="project-content">
        <div className="project-layout">
          <div className="project-flow-card">
            <div className="project-toolbar">
              <div className="project-toolbar-actions">
                <button
                  type="button"
                  className="project-action-btn"
                  disabled={!canAddDevice}
                  onClick={openAddModal}
                >
                  <SquarePlus size={22} strokeWidth={1.8} />
                  Add Device
                </button>
                <button
                  type="button"
                  className="project-action-btn"
                  disabled={!canEditDevice}
                  onClick={openEditModal}
                >
                  <PencilLine size={22} strokeWidth={1.8} />
                  Edit Device
                </button>
                <button
                  type="button"
                  className="project-action-btn"
                  disabled={!canDeleteDevice}
                  onClick={handleDeleteDevice}
                >
                  <Trash2 size={22} strokeWidth={1.8} />
                  Delete
                </button>
              </div>
            </div>

            <div className="project-flow-head">
              <h2>Device</h2>
              <h2>Tag/Block</h2>
            </div>

            <div className="project-flow-body">
              {devices.map((device) => {
                const isExpanded = expandedIds.includes(device.id)
                const isActive = activeDeviceId === device.id
                const deviceItems = buildDeviceItems(device)

                return (
                  <div className="project-row" key={device.id}>
                    <div className="project-device-pane">
                      <button
                        type="button"
                        className={`project-device-node ${isActive ? 'is-active' : ''}`}
                        onClick={() => toggleSelectedDevice(device.id)}
                      >
                        {device.name}
                      </button>

                      <button
                        type="button"
                        className={`project-toggle-dot ${isExpanded ? 'is-open' : ''}`}
                        aria-label={isExpanded ? `Collapse ${device.name}` : `Expand ${device.name}`}
                        onClick={() => toggleExpanded(device.id)}
                      />
                    </div>

                    <div className={`project-tags-pane ${isExpanded ? 'is-open' : 'is-closed'}`}>
                      {isExpanded && (
                        <>
                          <div className="project-connector-line" aria-hidden="true" />
                          <div className="project-tags-stack">
                            {deviceItems.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className={`project-tag-node ${item.kind === 'block' ? 'is-block' : 'is-tag'} ${item.kind === 'tag' ? 'is-clickable' : ''}`}
                                onClick={() => openTagConfiguration(device, item)}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <aside className="project-property-card">
            <div className="project-property-head">Device Property</div>
            <div className="project-property-body">
              {activeDevice ? (
                activeDevice.properties.map((property) => (
                  <div className="project-property-item" key={property.label}>
                    <div className="project-property-label">{property.label}</div>
                    <div className="project-property-value">{property.value || '\u00A0'}</div>
                  </div>
                ))
              ) : (
                <div className="project-property-empty">Select a device to view its properties.</div>
              )}
            </div>
          </aside>
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
