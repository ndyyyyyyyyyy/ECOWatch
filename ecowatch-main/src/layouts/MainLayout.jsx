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
      { key: '/area-usage', label: 'Area Usage' },
      { key: '/demand', label: 'Demand' },
      { key: '/item-summary', label: 'Item Summary' },
      { key: '/tou-period', label: 'TOU Period' },
    ],
  },
  {
    key: 'effect-analysis',
    label: 'Effect Analysis',
    children: [
      { key: '/energy-ranking', label: 'Energy Ranking' },
      { key: '/energy-flow', label: 'Energy Flow' },
      { key: '/loss-analysis', label: 'Loss Analysis' },
    ],
  },
  {
    key: 'report-management',
    label: 'Report Management',
    children: [
      { key: '/annual-report', label: 'Annual Report' },
    ],
  }
];

const treeData = [
  {
    title: 'MAIN_ELECTRICAL',
    key: '0-0',
    children: [
      { title: 'RAC', key: '0-0-0', children: [{ title: 'LVMDP_RAC', key: '0-0-0-0' }] },
      { title: 'NR1', key: '0-0-1',
        children: [
          { title: 'LVMDP_NR1', key: '0-0-1-0' },
          { title: 'DB1', key: '0-0-1-1' },
          { title: 'DB2', key: '0-0-1-2' },
          { title: 'DB3', key: '0-0-1-3', children: [
            { title: 'CHAMBER_AR1', key: '0-0-1-3-0' },
            { title: 'LP_OFFICE_REFF_2', key: '0-0-1-3-1' },
            { title: 'H_PRESS_MC1', key: '0-0-1-3-2' },
            { title: 'V_F_MALE_C_NR1', key: '0-0-1-3-3' },
            { title: 'V_F_FEMALE_B_NR1', key: '0-0-1-3-4' },
            { title: 'V_F_FEMALE_A_NR1', key: '0-0-1-3-5' },
          ] },
        ] },
      { title: 'NR2', key: '0-0-2', children: [{ title: 'LVMDP_NR2', key: '0-0-2-0' }] },
      { title: 'UT_NEW', key: '0-0-3', children: [{ title: 'LVMDP_UT_NEW', key: '0-0-3-0' }] },
      { title: 'UTILITY', key: '0-0-4', children: [{ title: 'LVMDP_UTILITY', key: '0-0-4-0' }] },
    ],
  },
  {
    title: 'ELECTRIC_TRANSFORMER',
    key: '0-1',
    children: [
      { title: 'LVMDP_RAC', key: '0-1-0' },
      { title: 'LVMDP_NR1', key: '0-1-1' },
      { title: 'LVMDP_NR2', key: '0-1-2' },
      { title: 'LVMDP_UT_NEW', key: '0-1-3' },
      { title: 'LVMDP_UTILITY', key: '0-1-4' },
    ],
  },
];

const LiveClock = ({ isDarkMode }) => {
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const options = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
      setTime(now.toLocaleString('en-GB', options).replace(',', ''));
    };
    updateDateTime(); 
    const timer = setInterval(updateDateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return <Text style={{ color: isDarkMode ? '#d9d9d9' : '#595959', fontSize: '14px', margin: 0 }}>{time}</Text>;
};

export default function MainLayout() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('appTheme');
    return savedTheme === 'dark'; 
  });
  
  const [collapsed, setCollapsed] = useState(false); 
  const [currentUser, setCurrentUser] = useState('');

  //checkedKeys
  const [checkedKeys, setCheckedKeys] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [checkedAreaNames, setCheckedAreaNames] = useState([]); 

  const navigate = useNavigate();
  const location = useLocation();

  const hideAreaSidebarPaths = ['/item-summary']; 
  const showAreaSidebar = !hideAreaSidebarPaths.includes(location.pathname);

  useEffect(() => {
    const savedUser = localStorage.getItem('loggedInUser');
    if (savedUser) setCurrentUser(savedUser.charAt(0).toUpperCase() + savedUser.slice(1));
    else setCurrentUser('Guest');
  }, []);

  useEffect(() => {
    localStorage.setItem('appTheme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const handleLogout = () => {
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
    { key: 'portal', label: 'App Launcher (Portal)', icon: <Home size={16} />, onClick: () => navigate('/portal') },
    { type: 'divider' },
    { key: 'logout', label: 'Logout', icon: <LogOut size={16} color="#ff4d4f" />, onClick: handleLogout, danger: true },
  ];

  return (
    <ConfigProvider theme={{ algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
      <Layout style={{ height: '100vh', overflow: 'hidden' }}>
        
        <Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', height: '64px', backgroundColor: isDarkMode ? '#141414' : '#ffffff', borderBottom: isDarkMode ? '1px solid #303030' : '1px solid #E5E5E5', position: 'sticky', top: 0, zIndex: 1000 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <Button type="text" icon={<MenuIcon size={24} color={isDarkMode ? '#ffffff' : '#000000'} />} onClick={() => setCollapsed(!collapsed)} style={{ padding: 1 }} />
            <Title level={4} style={{ margin: 0, color: isDarkMode ? '#ffffff' : '#595959', fontWeight: 500 }}>Energy Management System</Title>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <LiveClock isDarkMode={isDarkMode} />
            <Button type="text" shape="circle" icon={isDarkMode ? <Sun size={20} color="#ffffff" /> : <Moon size={20} color="#595959" />} onClick={() => setIsDarkMode(!isDarkMode)} />
            <Button type="text" shape="circle" icon={<Bell size={20} color={isDarkMode ? '#ffffff' : '#595959'} />} />
            <Dropdown menu={{ items: settingsMenuItems }} placement="bottomRight" trigger={['click']}>
              <Button type="text" shape="circle" icon={<Settings size={20} color={isDarkMode ? '#ffffff' : '#595959'} />} />
            </Dropdown>
          </div>
        </Header>

        <Layout style={{ height: 'calc(100vh - 64px)' }}>
          <Sider width={170} theme={isDarkMode ? 'dark' : 'light'} style={{ backgroundColor: isDarkMode ? '#141414' : '#ffffff', borderRight: isDarkMode ? '1px solid #303030' : '1px solid #f0f0f0', paddingTop: '10px', zIndex: 10, height: '100%', overflowY: 'auto' }} collapsible trigger={null} collapsed={collapsed}>
            <Menu mode="inline" selectedKeys={[location.pathname]} defaultOpenKeys={['energy-monitor', 'effect-analysis', 'report-management']} style={{ height: '100%', borderRight: 0 }} items={menuItems} onClick={({ key }) => navigate(key)} />
          </Sider>

          {showAreaSidebar && (
            <Sider width={245} theme={isDarkMode ? 'dark' : 'light'} style={{ padding: '16px', backgroundColor: isDarkMode ? '#141414' : '#ffffff', borderRight: isDarkMode ? '1px solid #303030' : '1px solid #f0f0f0', zIndex: 9, height: '100%', overflowY: 'auto' }}>
              <Title level={5} style={{ marginTop: 0 }}>Area</Title>
              <Input placeholder="Search" prefix={<Search size={16} />} style={{ marginBottom: 16 }} />
              
              <Tree
                checkable
                showLine
                defaultExpandedKeys={['0-0', '0-0-0']}
                treeData={treeData}
                checkedKeys={checkedKeys}
                selectedKeys={selectedKeys}
                onCheck={(keys, info) => {
                  setCheckedKeys(keys);
                  setCheckedAreaNames(info.checkedNodes.map(node => node.title)); 
                }}
                onSelect={(keys, info) => {
                  setSelectedKeys(keys); 
                  const clickedKey = info.node.key;
                  const clickedTitle = info.node.title; 
                  
                  let newCheckedKeys = [...checkedKeys];
                  let newCheckedNames = [...checkedAreaNames];
                  
                  if (newCheckedKeys.includes(clickedKey)) {
                    newCheckedKeys = newCheckedKeys.filter((k) => k !== clickedKey);
                    newCheckedNames = newCheckedNames.filter((n) => n !== clickedTitle);
                  } else {
                    newCheckedKeys.push(clickedKey);
                    newCheckedNames.push(clickedTitle);
                  }
                  
                  setCheckedKeys(newCheckedKeys);
                  setCheckedAreaNames(newCheckedNames);
                }}
              />
            </Sider>
          )}

          <Content style={{ padding: '10px', backgroundColor: isDarkMode ? '#000000' : '#f4f7fe', height: '100%', overflowY: 'auto' }}>
            <Outlet context={{ isDarkMode, checkedAreaNames }} /> 
          </Content>

        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
