export default function TagFormModal({
  isTagModalOpen,
  tagModalMode,
  tagForm,
  handleTagFieldChange,
  handleTagSubmit,
  closeTagModal,
}) {
  if (!isTagModalOpen) return null

  return (
    <div className="project-modal-backdrop" role="presentation">
      <div className="project-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="project-modal-head">
          <h3>{tagModalMode === 'add' ? 'Add Tag' : 'Edit Tag'}</h3>
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
  )
}
