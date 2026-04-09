import { List } from 'lucide-react'

import { getTagAddressValue, getTagMatchTone } from '../../projectStorage.js'

export default function TagTable({
  activeDeviceType,
  tagRows,
  selectedTagIds,
  setSelectedTagIds,
  toggleTagSelection,
  selectedVisibleCount,
}) {
  return (
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
              <th>Status</th>
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
                <td>{getTagAddressValue(activeDeviceType, row)}</td>
                <td>
                  <span className={`project-tag-pill project-tag-pill-status is-${row.matchStatus || 'waiting'}`}>{getTagMatchTone(row)}</span>
                </td>
              </tr>
            ))}
            {!tagRows.length && (
              <tr>
                <td className="project-tag-empty" colSpan={6}>No tag data available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
