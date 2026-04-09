import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import './project-page.css'
import ProjectTopBar from './components/project-page/topbar.jsx'
import DeviceSidebar from './components/project-page/sidebar.jsx'
import DeviceDetails from './components/project-page/devicedetails.jsx'
import DeviceModals from './components/project-page/devicemodal.jsx'
import { useProjectManager } from './hooks/useProjectManager.jsx'

function ProjectPage({ user, onSignOut }) {
  const navigate = useNavigate()
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [time, setTime] = useState('')
  const manager = useProjectManager()

  const {
    devices,
    activeDeviceId,
    activeDevice,
    activeDeviceItems,
    visibleActiveDeviceProperties,
    isAddModalOpen,
    isEditModalOpen,
    isDeleteModalOpen,
    addForm,
    editForm,
    addFormFields,
    editFormFields,
    canDeleteDevice,
    addDisabled,
    editDisabled,
    toggleSelectedDevice,
    openAddModal,
    openEditModal,
    openDeleteModal,
    closeAddModal,
    closeEditModal,
    closeDeleteModal,
    handleAddFieldChange,
    handleEditFieldChange,
    handleAddSubmit,
    handleEditSubmit,
    handleDeleteDevice,
    handleDeployDevice,
  } = manager

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

  return (
    <main className={`project-page ${isDarkMode ? 'is-dark' : ''}`}>
      <ProjectTopBar
        time={time}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        user={user}
        onSignOut={onSignOut}
        navigate={navigate}
      />

      <section className="project-content">
        <div className="project-layout">
          <DeviceSidebar
            devices={devices}
            activeDeviceId={activeDeviceId}
            toggleSelectedDevice={toggleSelectedDevice}
            openAddModal={openAddModal}
            openDeleteModal={openDeleteModal}
            addDisabled={addDisabled}
            canDeleteDevice={canDeleteDevice}
          />

          <div className="project-main-panel">
            <DeviceDetails
              activeDevice={activeDevice}
              activeDeviceItems={activeDeviceItems}
              visibleActiveDeviceProperties={visibleActiveDeviceProperties}
              editDisabled={editDisabled}
              openEditModal={openEditModal}
              handleDeployDevice={handleDeployDevice}
              openTagConfiguration={openTagConfiguration}
            />
          </div>
        </div>
      </section>

      <DeviceModals
        isEditModalOpen={isEditModalOpen}
        isAddModalOpen={isAddModalOpen}
        isDeleteModalOpen={isDeleteModalOpen}
        activeDevice={activeDevice}
        editFormFields={editFormFields}
        editForm={editForm}
        handleEditFieldChange={handleEditFieldChange}
        handleEditSubmit={handleEditSubmit}
        closeEditModal={closeEditModal}
        addFormFields={addFormFields}
        addForm={addForm}
        handleAddFieldChange={handleAddFieldChange}
        handleAddSubmit={handleAddSubmit}
        closeAddModal={closeAddModal}
        handleDeleteDevice={handleDeleteDevice}
        closeDeleteModal={closeDeleteModal}
      />
    </main>
  )
}

export default ProjectPage
