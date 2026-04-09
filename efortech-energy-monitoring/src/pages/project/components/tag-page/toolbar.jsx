import { PencilLine, Plus, Search, Trash2 } from 'lucide-react'

export default function TagToolbar({
  activeDevice,
  tagRows,
  searchTerm,
  setSearchTerm,
  activeTagTab,
  setActiveTagTab,
  canEdit,
  canDelete,
  analogCount,
  discreteCount,
  textCount,
  openAddTagModal,
  openEditTagModal,
  handleDeleteTags,
}) {
  return (
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
  )
}
