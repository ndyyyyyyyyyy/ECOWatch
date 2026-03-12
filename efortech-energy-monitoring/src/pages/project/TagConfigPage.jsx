import { useEffect, useMemo, useState } from 'react'
import { Button, Dropdown, Typography } from 'antd'
import './project-tag-config-page.css'
import { Bell, Home, List, LogOut, Moon, PencilLine, Plus, Search, Settings, Sun, Trash2, User } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { loadProjectDevices, saveProjectDevices } from './projectDummyData.js'

const { Text } = Typography

const emptyTagForm = {
  name: '',
  type: 'analog',
  description: 'Analog Input',
  address: '',
  logData: 'yes',
}

function TagConfigPage({ user, onSignOut }) {
  const navigate = useNavigate()
  const { deviceId } = useParams()
  const [devices, setDevices] = useState(() => loadProjectDevices())
  const [selectedTagIds, setSelectedTagIds] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTagTab, setActiveTagTab] = useState('all')
  const [isTagModalOpen, setIsTagModalOpen] = useState(false)
  const [tagModalMode, setTagModalMode] = useState('add')
  const [tagForm, setTagForm] = useState(emptyTagForm)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [time, setTime] = useState('')

  const activeDevice = useMemo(
    () => devices.find((device) => String(device.id) === String(deviceId)) ?? null,
    [devices, deviceId],
  )

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

  useEffect(() => {
    saveProjectDevices(devices)
  }, [devices])

  useEffect(() => {
    setSelectedTagIds([])
  }, [deviceId])

  useEffect(() => {
    setSelectedTagIds([])
  }, [activeTagTab])

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

  function toggleTagSelection(tagId) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    )
  }

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
      address: selectedTag.address,
      logData: selectedTag.logData || 'yes',
    })
    setIsTagModalOpen(true)
  }

  function closeTagModal() {
    setIsTagModalOpen(false)
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

    if (tagModalMode === 'add') {
      const nextTagId = devices.flatMap((device) => device.tags || []).length
        ? Math.max(...devices.flatMap((device) => device.tags || []).map((tag) => tag.id)) + 1
        : 1

      setDevices((prev) =>
        prev.map((device) =>
          device.id === activeDevice.id
            ? {
                ...device,
                tags: [
                  ...device.tags,
                  {
                    id: nextTagId,
                    name: tagForm.name || `Tag ${nextTagId}`,
                    type: tagForm.type,
                    description: tagForm.description,
                    address: tagForm.address || '40001',
                    logData: tagForm.logData,
                  },
                ],
              }
            : device,
        ),
      )
    } else if (selectedTag) {
      setDevices((prev) =>
        prev.map((device) =>
          device.id === activeDevice.id
            ? {
                ...device,
                tags: device.tags.map((tag) =>
                  tag.id === selectedTag.id
                    ? {
                        ...tag,
                        name: tagForm.name,
                        type: tagForm.type,
                        description: tagForm.description,
                        address: tagForm.address,
                        logData: tagForm.logData,
                      }
                    : tag,
                ),
              }
            : device,
        ),
      )
    }

    setIsTagModalOpen(false)
    setSelectedTagIds([])
  }

  function handleDeleteTags() {
    if (!activeDevice || !selectedTagIds.length) {
      return
    }

    const confirmed = window.confirm(`Delete ${selectedTagIds.length} selected tag(s)?`)
    if (!confirmed) {
      return
    }

    setDevices((prev) =>
      prev.map((device) =>
        device.id === activeDevice.id
          ? {
              ...device,
              tags: device.tags.filter((tag) => !selectedTagIds.includes(tag.id)),
            }
          : device,
      ),
    )
    setSelectedTagIds([])
  }

  const selectedVisibleCount = tagRows.filter((row) => selectedTagIds.includes(row.id)).length

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
      key: 'project',
      label: 'Project Management',
      icon: <Home size={16} />,
      onClick: () => navigate('/project'),
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

  if (!activeDevice) {
    return null
  }

  return (
    <main className={`project-tag-page ${isDarkMode ? 'is-dark' : ''}`}>
      <header className="project-tag-topbar">
        <div className="project-tag-left">
          <button type="button" className="project-tag-brand-btn" onClick={() => navigate('/project')}>
            <span className="project-tag-brand-title">Tag Management</span>
            <span className="project-tag-brand-subtitle">Review and maintain tags for the selected device.</span>
          </button>
        </div>
        <div className="project-tag-right project-tag-topbar-tools">
          <Text className="project-tag-topbar-time">{time}</Text>
          <Button
            type="text"
            shape="circle"
            className="project-tag-topbar-icon-btn"
            icon={isDarkMode ? <Sun size={20} color="#ffffff" /> : <Moon size={20} color="#595959" />}
            onClick={() => setIsDarkMode(!isDarkMode)}
          />
          <Button
            type="text"
            shape="circle"
            className="project-tag-topbar-icon-btn"
            icon={<Bell size={20} color={isDarkMode ? '#ffffff' : '#595959'} />}
          />
          <Dropdown menu={{ items: settingsMenuItems }} placement="bottomRight" trigger={['click']}>
            <Button
              type="text"
              shape="circle"
              className="project-tag-topbar-icon-btn"
              icon={<Settings size={20} color={isDarkMode ? '#ffffff' : '#595959'} />}
            />
          </Dropdown>
        </div>
      </header>

      <section className="project-tag-content">
        <div className="project-tag-toolbar-card">
          <div className="project-tag-toolbar-main">
            <div className="project-tag-toolbar">
              <button type="button" className="project-tag-action" onClick={openAddTagModal}>
                <Plus size={18} strokeWidth={1.9} />
                <span>Add</span>
              </button>
              <button type="button" className={`project-tag-action ${!canEdit ? 'is-disabled' : ''}`} disabled={!canEdit} onClick={openEditTagModal}>
                <PencilLine size={18} strokeWidth={1.9} />
                <span>Edit</span>
              </button>
              <button type="button" className={`project-tag-action ${!canDelete ? 'is-disabled' : ''}`} disabled={!canDelete} onClick={handleDeleteTags}>
                <Trash2 size={18} strokeWidth={1.9} />
                <span>Delete</span>
              </button>
            </div>

            <div className="project-tag-tabs">
              <button type="button" className={activeTagTab === 'all' ? 'is-active' : ''} onClick={() => setActiveTagTab('all')}>
                {`All (${activeDevice.tags.length})`}
              </button>
              <button type="button" className={activeTagTab === 'analog' ? 'is-active' : ''} onClick={() => setActiveTagTab('analog')}>
                {`Analog (${analogCount})`}
              </button>
              <button type="button" className={activeTagTab === 'discrete' ? 'is-active' : ''} onClick={() => setActiveTagTab('discrete')}>
                {`Discrete (${discreteCount})`}
              </button>
              <button type="button" className={activeTagTab === 'text' ? 'is-active' : ''} onClick={() => setActiveTagTab('text')}>
                {`Text (${textCount})`}
              </button>
            </div>
          </div>

          <div className="project-tag-toolbar-side">
            <div className="project-tag-summary-meta">{tagRows.length ? `${tagRows.length} item(s)` : 'No items'}</div>
            <div className="project-tag-search">
              <Search size={18} strokeWidth={1.9} />
              <input type="text" placeholder="Search tags" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
            </div>
          </div>
        </div>

        <div className="project-tag-table-card">
          <div className="project-tag-table-top">
            <div className="project-tag-pagination">
              <span>{tagRows.length ? `Showing ${tagRows.length} tag(s)` : 'No tags found'}</span>
            </div>
            <div className="project-tag-records">
              <span>Records per page</span>
              <button type="button" className="project-tag-records-btn">100</button>
              <button type="button" className="project-tag-view-btn" aria-label="List view">
                <List size={20} strokeWidth={1.9} />
              </button>
            </div>
          </div>

          <div className="project-tag-table-wrap">
            <table className="project-tag-table">
              <thead>
                <tr>
                  <th className="project-tag-checkbox-col">
                    <input
                      type="checkbox"
                      checked={tagRows.length > 0 && selectedVisibleCount === tagRows.length}
                      onChange={(event) => setSelectedTagIds(event.target.checked ? tagRows.map((row) => row.id) : [])}
                    />
                  </th>
                  <th>Tag Name</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Address</th>
                </tr>
              </thead>
              <tbody>
                {tagRows.map((row) => (
                  <tr key={row.id}>
                    <td className="project-tag-checkbox-col">
                      <input
                        type="checkbox"
                        checked={selectedTagIds.includes(row.id)}
                        onChange={() => toggleTagSelection(row.id)}
                      />
                    </td>
                    <td>{row.name}</td>
                    <td>
                      <span className="project-tag-pill">{row.type}</span>
                    </td>
                    <td>{row.description}</td>
                    <td>{row.address}</td>
                  </tr>
                ))}
                {!tagRows.length && (
                  <tr>
                    <td className="project-tag-empty" colSpan={5}>No tag data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {isTagModalOpen && (
        <div className="project-modal-backdrop" role="presentation" onClick={closeTagModal}>
          <div className="project-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="project-modal-head">
              <h3>{tagModalMode === 'add' ? 'Add Tag' : 'Edit Tag'}</h3>
              {tagModalMode === 'add' && (
                <button type="button" className="project-modal-close" onClick={closeTagModal}>
                  Close
                </button>
              )}
            </div>

            <form className="project-modal-form" onSubmit={handleTagSubmit}>
              <label className="project-modal-field">
                <span>Tag Name</span>
                <input type="text" value={tagForm.name} onChange={(event) => handleTagFieldChange('name', event.target.value)} />
              </label>

              <label className="project-modal-field">
                <span>Tag Type</span>
                <select value={tagForm.type} onChange={(event) => handleTagFieldChange('type', event.target.value)}>
                  <option value="analog">analog</option>
                  <option value="discrete">discrete</option>
                  <option value="text">text</option>
                </select>
              </label>

              <label className="project-modal-field">
                <span>Description</span>
                <input type="text" value={tagForm.description} onChange={(event) => handleTagFieldChange('description', event.target.value)} />
              </label>

              <label className="project-modal-field">
                <span>Address</span>
                <input type="text" value={tagForm.address} onChange={(event) => handleTagFieldChange('address', event.target.value)} />
              </label>

              <fieldset className="project-modal-fieldset">
                <legend>Log Data</legend>
                <label className="project-radio-option">
                  <input
                    type="radio"
                    name="logData"
                    checked={tagForm.logData === 'yes'}
                    onChange={() => handleTagFieldChange('logData', 'yes')}
                  />
                  <span>Yes</span>
                </label>
                <label className="project-radio-option">
                  <input
                    type="radio"
                    name="logData"
                    checked={tagForm.logData === 'no'}
                    onChange={() => handleTagFieldChange('logData', 'no')}
                  />
                  <span>No</span>
                </label>
              </fieldset>

              <div className="project-modal-actions">
                <button type="button" className="project-modal-secondary" onClick={closeTagModal}>
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

export default TagConfigPage
