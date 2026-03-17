import React, { useState, useEffect } from 'react';
import { Card, Select, Button, Space, Typography, Progress, Row, Col } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';

const { Option } = Select;
const { Title, Text } = Typography;

export default function ItemSummary() {
  const { isDarkMode } = useOutletContext();
  
  const [selectedArea, setSelectedArea] = useState("Regional");
  const [energyType, setEnergyType] = useState('electricity');
  const [barDataThisYear, setBarDataThisYear] = useState(new Array(12).fill(0));
  const [loadingBar, setLoadingBar] = useState(false);

  const fetchBarData = (areaName) => {
    setLoadingBar(true);
    const currentYear = new Date().getFullYear();
    
    let url = `http://localhost:5000/energy?interval=Month&start=${currentYear}-01-01&end=${currentYear}-12-31&areas=${areaName}`;

    axios.get(url)
      .then(res => {
        const rawData = Array.isArray(res.data) ? res.data : (res.data.data || []);
        const monthlyValues = new Array(12).fill(0);

        rawData.forEach(item => {
          if (item.timestamp) {
            const monthIndex = parseInt(item.timestamp.split('-')[1], 10) - 1;
            if (monthIndex >= 0 && monthIndex < 12) {
              monthlyValues[monthIndex] = item.value_kwh;
            }
          }
        });

        setBarDataThisYear(monthlyValues);
        setLoadingBar(false);
      })
      .catch(err => {
        console.error("Gagal ambil data bar:", err);
        setLoadingBar(false);
      });
  };

  useEffect(() => {
    if (selectedArea && selectedArea !== "Regional") {
      fetchBarData(selectedArea);
    }
  }, [selectedArea]);

  const onEvents = {
    'click': (params) => {
      setSelectedArea(params.name);
    }
  };

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
    grid: { left: '3%', right: '4%', bottom: '15%', top: '3%', containLabel: true },
    xAxis: { type: 'category', data: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'] },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: isDarkMode ? '#303030' : '#e8e8e8' } } },
    series: [
      { name: 'This year', type: 'bar', itemStyle: { color: '#1890ff' }, data: [1500, 2000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { name: 'Last year', type: 'bar', itemStyle: { color: isDarkMode ? '#172b4d' : '#e6f4ff' }, data: [2100, 2200, 1800, 1900, 2000, 2100, 2200, 2300, 2100, 2000, 1900, 2500] },
      { name: 'Target usage', type: 'line', smooth: true, lineStyle: { width: 3, type: 'dashed', color: '#ff4d4f' }, symbol: 'circle', itemStyle: { color: '#ff4d4f' }, data: [1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800, 1800] },
    ]
  };

  const regionalUsageOption = {
    tooltip: { trigger: 'item', formatter: '{b} : {c}%' },
    series: [
      {
        type: 'pie',
        cursor: 'pointer',
        radius: ['45%', '65%'],
        itemStyle: { borderRadius: 4, borderColor: isDarkMode ? '#141414' : '#fff', borderWidth: 2 },
        label: { show: true, position: 'outside', formatter: '{b}\n{c}%', fontWeight: 'bold' },
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
    grid: { left: '3%', right: '4%', bottom: '15%', top: '3%', containLabel: true },
    xAxis: { 
      type: 'category', 
      data: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'] 
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: isDarkMode ? '#303030' : '#e8e8e8' } } },
    series: [
      { name: 'This year', type: 'bar', itemStyle: { color: '#1890ff' }, data: barDataThisYear },
      { name: 'Last year', type: 'bar', itemStyle: { color: isDarkMode ? '#172b4d' : '#e6f4ff' }, data: [550, 600, 580, 700, 650, 500, 0, 0, 0, 0, 0, 0] },
      { name: 'Target usage', type: 'line', smooth: true, lineStyle: { width: 3, type: 'dashed', color: '#ff4d4f' }, symbol: 'circle', itemStyle: { color: '#ff4d4f' }, data: [450, 450, 450, 450, 450, 450, 450, 450, 450, 450, 450, 450] },
    ]
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Card styles={{ body: { padding: '10px 24px' } }}>
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

      <Row gutter={[10, 10]}>
        <Col xs={24} sm={12} lg={6}><Card bordered={false}><Text type="secondary">This year usage</Text><Title level={3} style={{ margin: 0 }}>3.41 GWh</Title></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card bordered={false}><Text type="secondary">Last year usage</Text><Title level={3} style={{ margin: 0 }}>22.71 GWh</Title></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card bordered={false}><Text type="secondary">YoY deviation</Text><Title level={3} style={{ margin: 0, color: '#52c41a' }}>-19.30 GWh</Title></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card bordered={false}><Text type="secondary">Real-time demand</Text><Title level={3} style={{ margin: 0 }}>2,618.47 kW</Title></Card></Col>
      </Row>

      <Row gutter={[10, 10]} align="stretch">
        <Col xs={24} lg={16}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
            <Card title="Monthly Usage" bordered={false} loading={loadingBar}>
              <ReactECharts option={monthlyUsageOption} theme={isDarkMode ? 'dark' : 'light'} style={{ height: '200px' }} />
            </Card>
            
            <Row gutter={[10, 10]}>
              <Col xs={24} md={12}>
                <Card title="Regional Usage" bordered={false}>
                  <ReactECharts 
                    option={regionalUsageOption} 
                    theme={isDarkMode ? 'dark' : 'light'} 
                    onEvents={onEvents} 
                    style={{ height: '250px' }} 
                  />
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title={`${selectedArea === "Regional" ? "Area" : selectedArea} Monthly Usage`} bordered={false}>
                  <ReactECharts option={racMonthlyOption} theme={isDarkMode ? 'dark' : 'light'} style={{ height: '250px' }} />
                </Card>
              </Col>
            </Row>
          </div>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Equipment Usage Ranking" bordered={false} style={{ height: '100%' }}>
            {rankingData.map((item, index) => (
              <div key={index} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: '13px', fontWeight: 500 }}>{item.name}</Text>
                  <Text style={{ fontSize: '13px' }}>{item.value} MWh</Text>
                </div>
                <Progress percent={item.percent} showInfo={false} strokeColor="#1890ff" size="small"/>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
