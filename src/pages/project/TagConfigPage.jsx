import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import './project-tag-config-page.css'
import TagTopBar from './components/tag-page/topbar.jsx'
import TagToolbar from './components/tag-page/toolbar.jsx'
import TagTable from './components/tag-page/tagtable.jsx'
import TagFormModal from './components/tag-page/tagformmodal.jsx'
import { useProjectTagManager } from './hooks/useProjectTagManager.jsx'

function TagConfigPage({ user, onSignOut }) {
  const navigate = useNavigate()
  const { deviceId } = useParams()
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [time, setTime] = useState('')
  const manager = useProjectTagManager(deviceId)

  const {
    activeDevice,
    activeDeviceType,
    tagRows,
    selectedTagIds,
    searchTerm,
    activeTagTab,
    isTagModalOpen,
    tagModalMode,
    tagForm,
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
    closeTagModal,
    toggleTagSelection,
    handleTagFieldChange,
    handleTagSubmit,
    handleDeleteTags,
  } = manager

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

  if (!activeDevice) {
    return null
  }

  return (
    <main className={`project-tag-page ${isDarkMode ? 'is-dark' : ''}`}>
      <TagTopBar
        navigate={navigate}
        time={time}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        user={user}
        onSignOut={onSignOut}
      />

      <section className="project-tag-content">
        <TagToolbar
          activeDevice={activeDevice}
          tagRows={tagRows}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          activeTagTab={activeTagTab}
          setActiveTagTab={setActiveTagTab}
          canEdit={canEdit}
          canDelete={canDelete}
          analogCount={analogCount}
          discreteCount={discreteCount}
          textCount={textCount}
          openAddTagModal={openAddTagModal}
          openEditTagModal={openEditTagModal}
          handleDeleteTags={handleDeleteTags}
        />

        <TagTable
          activeDeviceType={activeDeviceType}
          tagRows={tagRows}
          selectedTagIds={selectedTagIds}
          setSelectedTagIds={setSelectedTagIds}
          toggleTagSelection={toggleTagSelection}
          selectedVisibleCount={selectedVisibleCount}
        />
      </section>

      <TagFormModal
        isTagModalOpen={isTagModalOpen}
        tagModalMode={tagModalMode}
        tagForm={tagForm}
        handleTagFieldChange={handleTagFieldChange}
        handleTagSubmit={handleTagSubmit}
        closeTagModal={closeTagModal}
      />
    </main>
  )
}

export default TagConfigPage
