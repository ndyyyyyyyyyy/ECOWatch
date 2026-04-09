import { ChevronRight, Cpu, PencilLine, SquarePlus } from 'lucide-react'

import { getUnitNumberLabel } from '../../projectStorage.js'

export default function DeviceDetails({
  activeDevice,
  activeDeviceItems,
  visibleActiveDeviceProperties,
  editDisabled,
  openEditModal,
  handleDeployDevice,
  openTagConfiguration,
}) {
  if (!activeDevice) {
    return (
      <div className="project-empty-state">
        <h2>Select a device</h2>
        <p>Choose one device from the left panel to inspect properties and open its tag manager.</p>
      </div>
    )
  }

  return (
    <>
      <section className="project-summary-card">
        <div className="project-summary-copy">
          <p className="project-summary-kicker">Selected Device</p>
          <div className="project-summary-title-row">
            <div>
              <h2>{activeDevice.name}</h2>
            </div>
            <div className="project-summary-actions">
              <button
                type="button"
                className={`project-summary-deploy-btn ${activeDevice.deployed ? 'is-deployed' : ''}`}
                disabled={Boolean(activeDevice.deployed)}
                onClick={handleDeployDevice}
              >
                {activeDevice.deployed ? 'Deployed' : 'Deploy'}
              </button>
              <button type="button" className="project-summary-edit-btn" disabled={editDisabled} onClick={openEditModal}>
                <PencilLine size={18} strokeWidth={1.8} />
                Edit
              </button>
            </div>
          </div>
          {!activeDevice.deployed && (
            <p className="project-summary-note">Configuration saved as draft. Deploy this device to start polling and publishing data.</p>
          )}
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
            <strong>{getUnitNumberLabel(activeDevice)}</strong>
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
  )
}
