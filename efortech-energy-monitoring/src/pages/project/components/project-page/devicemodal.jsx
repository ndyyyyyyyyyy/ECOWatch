export default function DeviceModals({
  isEditModalOpen,
  isAddModalOpen,
  isDeleteModalOpen,
  activeDevice,
  editFormFields,
  editForm,
  handleEditFieldChange,
  handleEditSubmit,
  closeEditModal,
  addFormFields,
  addForm,
  handleAddFieldChange,
  handleAddSubmit,
  closeAddModal,
  handleDeleteDevice,
  closeDeleteModal,
}) {
  return (
    <>
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
    </>
  )
}
