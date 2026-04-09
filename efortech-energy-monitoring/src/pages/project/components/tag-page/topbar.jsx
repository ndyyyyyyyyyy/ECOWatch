import { Button, Dropdown, Typography } from 'antd'
import { Bell, Home, LogOut, Moon, Settings, Sun, User } from 'lucide-react'

const { Text } = Typography

export default function TagTopBar({ navigate, time, isDarkMode, setIsDarkMode, user, onSignOut }) {
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
    { type: 'divider' },
    {
      key: 'logout',
      label: 'Logout',
      icon: <LogOut size={16} color="#ff4d4f" />,
      onClick: onSignOut,
      danger: true,
    },
  ]

  return (
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
  )
}
