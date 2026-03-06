import React, { useState } from 'react';
import { Card, Select, DatePicker, Button, Space } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useOutletContext } from 'react-router-dom';

const { Option } = Select;
const { RangePicker } = DatePicker;

export default function AreaUsagePage() {
  const { isDarkMode } = useOutletContext(); 
  const [intervalWaktu, setIntervalWaktu] = useState('Hour');

  const areaUsageOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { 
        type: 'shadow',
        shadowStyle: {
          width: 'auto',
          opacity: 0.3
        }
       }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '80px',
      containLabel: true
    },
    dataZoom: [
      { 
        type: 'slider', 
        bottom: 35,
        height: 15,
        start: 0, 
        end: 100 
      },
      { type: 'inside' }
    ],
    legend: {
      bottom: 0,
      type: 'scroll',
      textStyle: {
        color: isDarkMode ? '#d9d9d9' : '#595959'
      }
    },
    xAxis: {
      type: 'category',
      data: ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00'],
      axisLabel: {
        color: isDarkMode ? '#d9d9d9' : '#595959'
      }
    },
    yAxis: {
      type: 'value',
      name: 'kWh',
      nameTextStyle: {
        color: isDarkMode ? '#d9d9d9' : '#595959'
      },
      axisLabel: {
        color: isDarkMode ? '#d9d9d9' : '#595959'
      },
      splitLine: { 
        lineStyle: { 
          type: 'dashed',
          color: isDarkMode ? '#303030' : '#e8e8e8'
        } 
      }
    },
    series: [
      {
        name: 'V_F_MALE_C_NR1',
        type: 'bar',
        stack: 'Total',
        barWidth: '30%',
        emphasis: { focus: 'series' },
        itemStyle: { color: '#1677ff' },
        data: [160, 170, 180, 170, 150, 160, 150, 160]
      },
      {
        name: 'DB_2',
        type: 'bar',
        stack: 'Total',
        emphasis: { focus: 'series' },
        itemStyle: { color: '#52c41a' },
        data: [130, 180, 130, 100, 140, 150, 130, 240]
      },
      {
        name: 'V_F_MALE_B_NR1',
        type: 'bar',
        stack: 'Total',
        emphasis: { focus: 'series' },
        itemStyle: { color: '#fbe923' },
        data: [100, 150, 200, 130, 80, 110, 140, 130]
      },
      {
        name: 'DB3',
        type: 'bar',
        stack: 'Total',
        emphasis: { focus: 'series' },
        itemStyle: { color: '#cc2feb' },
        data: [20, 30, 40, 20, 30, 20, 40, 80]
      }
    ]
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Card bodyStyle={{ padding: '10px 24px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <Space wrap>
          <span>Energy item</span>
          <Select defaultValue="Electricity" style={{ width: 120 }}>
            <Option value="Electricity">Electricity</Option>
            <Option value="Water">Water</Option>
          </Select>

          <span>Conversion method</span>
          <Select defaultValue="Default" style={{ width: 120 }}>
            <Option value="Default">Default</Option>
            <Option value="Standard coal">Standard coal</Option>
          </Select>

          <span>Interval</span>
          <Select value={intervalWaktu} onChange={setIntervalWaktu} style={{ width: 100 }}>
            <Option value="Year">Year</Option>
            <Option value="Month">Month</Option>
            <Option value="Day">Day</Option>
            <Option value="Hour">Hour</Option>
          </Select>

          <span>Time</span>
          <RangePicker />
          <Button type="primary">Search</Button>
        </Space>
      </Card>

      <Card title="Area usage" bordered={false} hoverable>
        <ReactECharts 
          option={areaUsageOption} 
          theme={isDarkMode ? 'dark' : 'light'} 
          style={{ height: '500px' }} 
        />
      </Card>
    </div>
  );
}