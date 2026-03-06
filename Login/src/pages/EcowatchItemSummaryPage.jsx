import React, { useState } from 'react';
import { Card, Select, Button, Space, Typography, Radio, Progress } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useOutletContext } from 'react-router-dom';

import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const { Option } = Select;
const { Title, Text } = Typography;

export default function ItemSummary() {
  const { isDarkMode } = useOutletContext();
  const [energyType, setEnergyType] = useState('electricity');

  const rankingData = [
    { name: '1. TURBO_ATLAS3', value: 512.14, percent: 100 },
    { name: '2. TURBO_ATLAS2', value: 411.75, percent: 80 },
    { name: '3. SCREW_COMPRE...', value: 252.42, percent: 50 },
    { name: '4. TURBO_ATLAS1', value: 251.99, percent: 49 },
    { name: '5. DB_2', value: 209.23, percent: 40 },
    { name: '6. V_F_MALE_C_NR1', value: 205.77, percent: 38 },
    { name: '7. V_F_MALE_A_NR2', value: 202.84, percent: 37 },
    { name: '8. SCREW_COMPRE...', value: 171.17, percent: 32 },
  ];

  const monthlyUsageOption = {
    tooltip: { trigger: 'axis' },
    legend: { 
      bottom: 0, 
      data: ['This year', 'Last year', 'Target usage'], 
      textStyle: { color: isDarkMode ? '#d9d9d9' : '#595959' } 
    },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'] },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: isDarkMode ? '#303030' : '#e8e8e8' } } },
    series: [
      { 
        name: 'This year', 
        type: 'bar', 
        itemStyle: { color: '#1890ff' }, 
        data: [1500, 2000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] 
      },
      { 
        name: 'Last year', 
        type: 'bar', 
        itemStyle: { color: isDarkMode ? '#172b4d' : '#e6f4ff' }, 
        data: [2100, 2200, 1800, 1900, 2000, 2100, 2200, 2300, 2100, 2000, 1900, 2500] 
      },
      // TAMBAHKAN OBJEK TARGET DI BAWAH INI
      { 
        name: 'Target usage', 
        type: 'line', // Menggunakan garis agar kontras dengan bar
        smooth: true, // Membuat garis melengkung halus
        lineStyle: { 
          width: 3, 
          type: 'dashed', // Garis putus-putus untuk menandakan target
          color: '#ff4d4f' // Warna merah agar terlihat sebagai batas
        },
        symbol: 'circle',
        itemStyle: { color: '#ff4d4f' },
        data: [1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800] 
      },
    ]
  };

  const regionalUsageOption = {
    tooltip: { trigger: 'item', formatter: '{b} : {c}%' },
    legend: { show: false },
    series: [
      {
        type: 'pie',
        radius: ['45%', '65%'],
        itemStyle: { borderRadius: 4, borderColor: isDarkMode ? '#141414' : '#fff', borderWidth: 2 },
        label: { show: true, position: 'outside', formatter: '{b}\n{c}%', fontWeight: 'bold' },
        labelLine: { show: true, length: 10, length2: 10 },
        data: [
          { value: 0.46, name: 'RAC', itemStyle: { color: '#4a99ed' } },
          { value: 26.62, name: 'NR1', itemStyle: { color: '#58db88' } },
          { value: 24.65, name: 'NR2', itemStyle: { color: '#e09340' } },
          { value: 34.44, name: 'UT_NEW', itemStyle: { color: '#e1cd49' } },
          { value: 13.83, name: 'UTILITY', itemStyle: { color: '#734bf3' } }
        ]
      }
    ]
  };

  const racMonthlyOption = {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, textStyle: { color: isDarkMode ? '#d9d9d9' : '#595959' } },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: ['01', '03', '05', '07', '09', '11'] },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: isDarkMode ? '#303030' : '#e8e8e8' } } },
    series: [
      { name: 'This year', type: 'bar', itemStyle: { color: '#1890ff' }, data: [80, 0, 0, 0, 0, 0] },
      { name: 'Last year', type: 'bar', itemStyle: { color: isDarkMode ? '#172b4d' : '#e6f4ff' }, data: [550, 600, 580, 700, 650, 500] },
    ]
  };

  const layout = [
    { i: 'stat1', x: 0, y: 0, w: 3, h: 1, static: true },
    { i: 'stat2', x: 3, y: 0, w: 3, h: 1, static: true },
    { i: 'stat3', x: 6, y: 0, w: 3, h: 1, static: true },
    { i: 'stat4', x: 9, y: 0, w: 3, h: 1, static: true },

    { i: 'monthly', x: 0, y: 1, w: 8, h: 3 },
    { i: 'ranking', x: 8, y: 1, w: 4, h: 6 },
    { i: 'regional', x: 0, y: 4, w: 4, h: 3 },
    { i: 'rac', x: 4, y: 4, w: 4, h: 3 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px',padding: '10px 10px 0 10px' }}>
      
      <Card bodyStyle={{ padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <Space wrap>
          <span>Area</span>
          <Select defaultValue="MAIN_ELECTRICAL" style={{ width: 180 }}>
            <Option value="MAIN_ELECTRICAL">MAIN_ELECTRICAL</Option>
          </Select>
          <span>Interval</span>
          <Select defaultValue="This year" style={{ width: 120 }}>
            <Option value="This year">This year</Option>
            <Option value="Last year">Last year</Option>
          </Select>
          <Button type="primary">Search</Button>
        </Space>
      </Card>

      <ResponsiveGridLayout 
        className="layout" 
        layouts={{ lg: layout }} 
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }} 
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }} 
        rowHeight={100}
        draggableHandle=".ant-card-head" 
        margin={[10, 10]}
      >
        
        <div key="stat1">
          <Card bordered={false} bodyStyle={{ padding: '16px', height: '100%' }} style={{ height: '100%' }}>
            <Text type="secondary">This year usage</Text>
            <Title level={3} style={{ margin: 0 }}>3.41 <Text style={{ fontSize: '14px', fontWeight: 'normal' }}>GWh</Text></Title>
          </Card>
        </div>
        <div key="stat2">
          <Card bordered={false} bodyStyle={{ padding: '16px', height: '100%' }} style={{ height: '100%' }}>
            <Text type="secondary">Last year usage</Text>
            <Title level={3} style={{ margin: 0 }}>22.71 <Text style={{ fontSize: '14px', fontWeight: 'normal' }}>GWh</Text></Title>
          </Card>
        </div>
        <div key="stat3">
          <Card bordered={false} bodyStyle={{ padding: '16px', height: '100%' }} style={{ height: '100%' }}>
            <Text type="secondary">YoY deviation</Text>
            <Title level={3} style={{ margin: 0, color: '#52c41a' }}>-19.30 <Text style={{ fontSize: '14px', fontWeight: 'normal', color: '#52c41a' }}>GWh</Text></Title>
          </Card>
        </div>
        <div key="stat4">
          <Card bordered={false} bodyStyle={{ padding: '16px', height: '100%' }} style={{ height: '100%' }}>
            <Text type="secondary">Real-time demand</Text>
            <Title level={3} style={{ margin: 0 }}>2,618.47 <Text style={{ fontSize: '14px', fontWeight: 'normal' }}>kW</Text></Title>
          </Card>
        </div>

        <div key="monthly">
          <Card title="Monthly usage" bordered={false} style={{ height: '100%' }} bodyStyle={{ height: 'calc(100% - 56px)' }}>
            <ReactECharts option={monthlyUsageOption} theme={isDarkMode ? 'dark' : 'light'} style={{ height: '100%' }} />
          </Card>
        </div>

        <div key="regional">
          <Card title="Regional usage" bordered={false} style={{ height: '100%' }} bodyStyle={{ height: 'calc(100% - 56px)' }}>
            <ReactECharts option={regionalUsageOption} theme={isDarkMode ? 'dark' : 'light'} style={{ height: '100%' }} />
          </Card>
        </div>

        <div key="rac">
          <Card title="RAC Monthly usage" bordered={false} style={{ height: '100%' }} bodyStyle={{ height: 'calc(100% - 56px)' }}>
            <ReactECharts option={racMonthlyOption} theme={isDarkMode ? 'dark' : 'light'} style={{ height: '100%' }} />
          </Card>
        </div>

        <div key="ranking">
          <Card title="Equipment usage ranking" bordered={false} style={{ height: '100%' }} bodyStyle={{ height: 'calc(100% - 56px)', overflowY: 'auto' }}>
            {rankingData.map((item, index) => (
              <div key={index} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <Text style={{ fontSize: '13px' }}>{item.name}</Text>
                  <Text style={{ fontSize: '13px' }}>{item.value} MWh</Text>
                </div>
                <Progress percent={item.percent} showInfo={false} strokeColor="#1890ff" trailColor={isDarkMode ? '#303030' : '#f5f5f5'} size="small"/>
              </div>
            ))}
          </Card>
        </div>

      </ResponsiveGridLayout>
    </div>
  );
}