import { Button, Dropdown, Typography } from 'antd'
import { Bell, Home, LogOut, Moon, Settings, Sun, User } from 'lucide-react'

const { Text } = Typography

export default function ProjectTopBar({ time, isDarkMode, setIsDarkMode, user, onSignOut, navigate }) {
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
      key: 'portal',
      label: 'App Launcher (Portal)',
      icon: <Home size={16} />,
      onClick: () => navigate('/portal'),
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
    <header className="project-topbar">
      <div className="project-left">
        <button type="button" className="project-brand-btn" onClick={() => navigate('/portal')}>
          <span className="project-brand-title">Project Manager</span>
          <span className="project-brand-subtitle">Manage devices and jump into tag configuration from a single workspace.</span>
        </button>
      </div>
      <div className="project-right project-topbar-tools">
        <Text className="project-topbar-time">{time}</Text>
        <Button
          type="text"
          shape="circle"
          className="project-topbar-icon-btn"
          icon={isDarkMode ? <Sun size={20} color="#ffffff" /> : <Moon size={20} color="#595959" />}
          onClick={() => setIsDarkMode(!isDarkMode)}
        />
        <Button
          type="text"
          shape="circle"
          className="project-topbar-icon-btn"
          icon={<Bell size={20} color={isDarkMode ? '#ffffff' : '#595959'} />}
        />
        <Dropdown menu={{ items: settingsMenuItems }} placement="bottomRight" trigger={['click']}>
          <Button
            type="text"
            shape="circle"
            className="project-topbar-icon-btn"
            icon={<Settings size={20} color={isDarkMode ? '#ffffff' : '#595959'} />}
          />
        </Dropdown>
      </div>
    </header>
  )
}
