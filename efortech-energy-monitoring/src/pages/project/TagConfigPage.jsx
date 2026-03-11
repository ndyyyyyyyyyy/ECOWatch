import { useEffect, useMemo, useState } from 'react'
import './project-tag-config-page.css'
import efortechLogo from '../../assets/efortech_logo.png'
import { List, PencilLine, Plus, Search, Trash2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { loadProjectDevices, saveProjectDevices } from './projectDummyData.js'

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
  const [isTagModalOpen, setIsTagModalOpen] = useState(false)
  const [tagModalMode, setTagModalMode] = useState('add')
  const [tagForm, setTagForm] = useState(emptyTagForm)

  const activeDevice = useMemo(
    () => devices.find((device) => String(device.id) === String(deviceId)) ?? null,
    [devices, deviceId],
  )

  const tagRows = useMemo(() => {
    if (!activeDevice) {
      return []
    }

    const keyword = searchTerm.trim().toLowerCase()
    if (!keyword) {
      return activeDevice.tags
    }

    return activeDevice.tags.filter((tag) => tag.name.toLowerCase().includes(keyword))
  }, [activeDevice, searchTerm])

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

  if (!activeDevice) {
    return null
  }

  return (
    <main className="project-tag-page">
      <header className="project-tag-topbar">
        <div className="project-tag-left">
          <button type="button" className="project-tag-logo-btn" onClick={() => navigate('/portal')}>
            <img className="project-tag-logo" src={efortechLogo} alt="Efortech" />
          </button>
          <button type="button" className="project-tag-back-btn" onClick={() => navigate('/project')}>
            Back to Project
          </button>
        </div>
        <div className="project-tag-right">
          <span className="project-tag-user">{user}</span>
          <button type="button" className="project-tag-signout-btn" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <section className="project-tag-content">
        <div className="project-tag-toolbar">
          <button type="button" className="project-tag-action" onClick={openAddTagModal}>
            <Plus size={28} strokeWidth={1.8} />
            <span>Insert</span>
          </button>
          <button type="button" className={`project-tag-action ${!canEdit ? 'is-disabled' : ''}`} disabled={!canEdit} onClick={openEditTagModal}>
            <PencilLine size={24} strokeWidth={1.8} />
            <span>Edit</span>
          </button>
          <button type="button" className="project-tag-action is-disabled" disabled>
            <PencilLine size={24} strokeWidth={1.8} />
            <span>Batch Edit</span>
          </button>
          <button type="button" className={`project-tag-action ${!canDelete ? 'is-disabled' : ''}`} disabled={!canDelete} onClick={handleDeleteTags}>
            <Trash2 size={24} strokeWidth={1.8} />
            <span>Delete</span>
          </button>
        </div>

        <div className="project-tag-meta">
          <div className="project-tag-breadcrumb">
            <span>{activeDevice.name}</span>
            <span>/</span>
            <strong>{`Tag(${activeDevice.tags.length})`}</strong>
          </div>
          <div className="project-tag-search">
            <Search size={22} strokeWidth={1.8} />
            <input type="text" placeholder="Tag Name Search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
          </div>
        </div>

        <div className="project-tag-tabs">
          <button type="button" className="is-active">{`All (${activeDevice.tags.length})`}</button>
          <button type="button">{`Analog Tag (${analogCount})`}</button>
          <button type="button">{`Discrete Tag (${discreteCount})`}</button>
          <button type="button" disabled>{`Text Tag (${textCount})`}</button>
        </div>

        <div className="project-tag-table-card">
          <div className="project-tag-table-top">
            <div className="project-tag-pagination">
              <span>{tagRows.length ? `1-${tagRows.length} of ${tagRows.length}` : '0-0 of 0'}</span>
            </div>
            <div className="project-tag-records">
              <span>Records per page</span>
              <button type="button" className="project-tag-records-btn">100</button>
              <button type="button" className="project-tag-view-btn" aria-label="List view">
                <List size={22} strokeWidth={1.8} />
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
                      checked={tagRows.length > 0 && selectedTagIds.length === tagRows.length}
                      onChange={(event) =>
                        setSelectedTagIds(event.target.checked ? tagRows.map((row) => row.id) : [])
                      }
                    />
                  </th>
                  <th>Tag Name</th>
                  <th>Tag Type</th>
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
              <button type="button" className="project-modal-close" onClick={closeTagModal}>
                Close
              </button>
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
                  <option value="datalog">datalog</option>
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
