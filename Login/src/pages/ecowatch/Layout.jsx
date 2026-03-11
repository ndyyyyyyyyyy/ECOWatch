import React, { useState, useEffect } from 'react';
import { Layout, Menu, Input, Tree, Button, Typography, ConfigProvider, theme, Dropdown } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sun, Moon, Search, Menu as MenuIcon, Settings, User, LogOut, Home, Bell } from 'lucide-react'; 

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

const menuItems = [
  {
    key: 'energy-monitor',
    label: 'Energy Monitor',
    children: [
      { key: '/ecowatch/area-usage', label: 'Area Usage' },
      { key: '/ecowatch/demand', label: 'Demand' },
      { key: '/ecowatch/item-summary', label: 'Item Summary' },
      { key: '/ecowatch/tou-period', label: 'TOU Period' },
    ],
  },
  {
    key: 'effect-analysis',
    label: 'Effect Analysis',
    children: [
      { key: '/ecowatch/energy-ranking', label: 'Energy Ranking' },
      { key: '/ecowatch/energy-flow', label: 'Energy Flow' },
    ],
  },
  {
    key: 'report-management',
    label: 'Report Management',
    children: [
      { key: '/ecowatch/annual-report', label: 'Annual Report' },
    ],
  }
];

const treeData = [
  {
    title: 'MAIN_ELECTRICAL',
    key: '0-0',
    children: [
      {
        title: 'ELECTRIC_TRANSFORMER',
        key: '0-0-0',
        children: [
          { title: 'LVMDP_RAC', key: '0-0-0-0' },
          { title: 'LVMDP_NR1', key: '0-0-0-1' },
          { title: 'LVMDP_NR2', key: '0-0-0-2' },
        ],
      },
      {
        title: 'ELECTRIC_AIR_COMP',
        key: '0-0-1',
        children: [
          { title: 'SCREW_COMPRESSOR1', key: '0-0-1-0' },
        ],
      },
    ],
  },
];

export default function MainLayout() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [collapsed, setCollapsed] = useState(false); 
  const [time, setTime] = useState("");
  const [currentUser, setCurrentUser] = useState('');

  const navigate = useNavigate();
  const location = useLocation();

  const hideAreaSidebarPaths = ['/ecowatch/item-summary'];
  const showAreaSidebar = !hideAreaSidebarPaths.includes(location.pathname);

  useEffect(() => {
    const savedUser = localStorage.getItem('loggedInUser');
    if (savedUser) {
      setCurrentUser(savedUser.charAt(0).toUpperCase() + savedUser.slice(1));
    } else {
      setCurrentUser('Guest');
    }

    const updateDateTime = () => {
      const now = new Date();
      const options = { 
        weekday: 'short', 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false 
      };
      setTime(now.toLocaleString('en-GB', options).replace(',', ''));
    };

    updateDateTime();
    const timer = setInterval(updateDateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/sign-out', {
      method: 'POST',
      credentials: 'include',
    });
    localStorage.removeItem('loggedInUser');
    navigate('/login');
  };

  const settingsMenuItems = [
    {
      key: 'user-info',
      label: (
        <div style={{ padding: '4px 0', borderBottom: '1px solid #f0f0f0', marginBottom: '4px' }}>
          <Text strong style={{ display: 'block' }}>{currentUser}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>{currentUser.toLowerCase()}</Text>
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
    {
      type: 'divider',
    },
    {
      key: 'logout',
      label: 'Logout',
      icon: <LogOut size={16} color="#ff4d4f" />,
      onClick: handleLogout,
      danger: true,
    },
  ];

  return (
    <ConfigProvider theme={{ algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
      <Layout style={{ height: '100vh', overflow: 'hidden' }}>
        
        <Header 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '0 24px',
            height: '64px',
            lineHeight: '64px',
            backgroundColor: isDarkMode ? '#141414' : '#ffffff', 
            borderBottom: isDarkMode ? '1px solid #303030' : '1px solid #E5E5E5',
            boxShadow: isDarkMode ? '0 1px 4px rgba(0,0,0,0.5)' : '0 1px 4px rgba(0,0,0,0.05)',
            position: 'sticky', 
            top: 0, 
            zIndex: 1000 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <Button 
              type="text" 
              icon={<MenuIcon size={24} color={isDarkMode ? '#ffffff' : '#000000'} />} 
              onClick={() => setCollapsed(!collapsed)} 
              style={{ padding: 1 }}
            />

            <Title level={4} style={{ margin: 0, color: isDarkMode ? '#ffffff' : '#595959', fontWeight: 500 }}>
              Energy Management System
            </Title>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Text 
              style={{ 
                color: isDarkMode ? '#d9d9d9' : '#595959', 
                fontSize: '14px',
                margin: 0
              }}
            >
              {time}
            </Text>
            
            <Button 
              type="text" 
              shape="circle" 
              icon={isDarkMode ? <Sun size={20} color="#ffffff" /> : <Moon size={20} color="#595959" />} 
              onClick={() => setIsDarkMode(!isDarkMode)} 
            />

            <Button 
              type="text" 
              shape="circle" 
              icon={<Bell size={20} color={isDarkMode ? '#ffffff' : '#595959'} />} 
              onClick={() => console.log('Notification clicked')}
            />

            <Dropdown 
              menu={{ items: settingsMenuItems }} 
              placement="bottomRight"
              trigger={['click']}
            >
              <Button 
                type="text" 
                shape="circle" 
                icon={<Settings size={20} color={isDarkMode ? '#ffffff' : '#595959'} />} 
              />
            </Dropdown>

          </div>
        </Header>

        <Layout style={{ height: 'calc(100vh - 64px)' }}>
          
          <Sider 
            width={170} 
            theme={isDarkMode ? 'dark' : 'light'} 
            style={{ 
              backgroundColor: isDarkMode ? '#141414' : '#ffffff',
              borderRight: isDarkMode ? '1px solid #303030' : '1px solid #f0f0f0',
              paddingTop: '16px',
              zIndex: 10,
              height: '100%',     
              overflowY: 'auto'   
            }}
            collapsible          
            trigger={null}       
            collapsed={collapsed}
          >
            <Menu
              mode="inline"
              selectedKeys={[location.pathname]}
              defaultOpenKeys={['energy-monitor', 'effect-analysis', 'report-management']}
              style={{ height: '100%', borderRight: 0 }}
              items={menuItems}
              onClick={({ key }) => navigate(key)} 
            />
          </Sider>

          {showAreaSidebar && (
            <Sider 
              width={270} 
              theme={isDarkMode ? 'dark' : 'light'} 
              style={{ 
                padding: '16px', 
                backgroundColor: isDarkMode ? '#141414' : '#ffffff',
                borderRight: isDarkMode ? '1px solid #303030' : '1px solid #f0f0f0', 
                zIndex: 9,
                height: '100%',     
                overflowY: 'auto'   
              }}
            >
              <Title level={5} style={{ marginTop: 0 }}>Area</Title>
              <Input 
                placeholder="Search" 
                prefix={<Search size={16} />} 
                style={{ marginBottom: 16 }} 
              />
              
              <Tree
                checkable
                showLine
                defaultExpandedKeys={['0-0', '0-0-0']}
                treeData={treeData}
                onSelect={(selectedKeys) => console.log('Area Terpilih (Klik Teks):', selectedKeys)}
                onCheck={(checkedKeys) => console.log('Area Dicentang (Checkbox):', checkedKeys)}
              />

            </Sider>
          )}

          <Content 
            style={{ 
              padding: '10px', 
              backgroundColor: isDarkMode ? '#000000' : '#f4f7fe', 
              height: '100%',     
              overflowY: 'auto'   
            }}
          >
            <Outlet context={{ isDarkMode }} /> 
          </Content>

        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
