import React, { useState } from 'react';
import { Card, Select, DatePicker, Button, Space, Table, Radio, Typography } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useOutletContext } from 'react-router-dom';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text } = Typography;

export default function EnergyRanking() {
  const { isDarkMode } = useOutletContext();
  const [rankingType, setRankingType] = useState('YoY');

  const categories = ['RAC-Electricity', 'UTILITY-Electricity', 'NR2-Electricity', 'NR1-Electricity', 'UT_NEW-Electricity'];
  const lastYearData = [7572.79, 113494.61, 346208.30, 387433.89, 482007.25];
  const currentData = [7575.86, 248554.69, 471805.01, 544092.21, 684680.00];
  const growthRates = ['-83.13', '119.00', '36.28', '40.43', '42.05'];

  const rankingOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: function (params) {
        let html = params[0].name + '<br/>';
        params.forEach(p => {
          const val = Math.abs(p.value).toLocaleString();
          html += `${p.marker} ${p.seriesName}: ${val} kWh<br/>`;
        });
        return html;
      }
    },
    legend: { 
      bottom: 0, 
      data: ['Last year', 'Current'],
      textStyle: { color: isDarkMode ? '#d9d9d9' : '#595959' }
    },
    grid: { left: '3%', right: '10%', bottom: '10%', containLabel: true },
    xAxis: [
      {
        type: 'value',
        axisLabel: {
          color: isDarkMode ? '#d9d9d9' : '#595959',
          formatter: function (value) {
            return Math.abs(value) / 1000 + 'K';
          }
        },
        splitLine: { 
          lineStyle: { 
            type: 'dashed',
            color: isDarkMode ? '#303030' : '#e8e8e8'
          } 
        }
      }
    ],
    yAxis: [
      {
        type: 'category',
        axisTick: { show: false },
        data: categories,
        axisLabel: { color: isDarkMode ? '#d9d9d9' : '#595959' }
      }
    ],
    series: [
      {
        name: 'Last year',
        type: 'bar',
        stack: 'Total',
        data: lastYearData.map(val => -val), 
        itemStyle: { color: '#91caff' },
        label: { 
          show: true, 
          position: 'left', 
          color: isDarkMode ? '#d9d9d9' : '#8c8c8c',
          formatter: (p) => Math.abs(p.value).toLocaleString()
        },
      },
      {
        name: 'Current',
        type: 'bar',
        stack: 'Total',
        data: currentData,
        itemStyle: { color: '#1677ff' },
        label: { 
          show: true, 
          position: 'right', 
          color: isDarkMode ? '#1677ff' : '#1677ff',
          formatter: (p) => `${p.value.toLocaleString()} (${growthRates[p.dataIndex]}%)` 
        },
      }
    ]
  };

  const columns = [
    { title: 'Area', dataIndex: 'area', key: 'area' },
    { title: 'Total usage(kWh)', dataIndex: 'totalUsage', key: 'totalUsage', align: 'right' },
    { title: 'Last year(kWh)', dataIndex: 'lastYear', key: 'lastYear', align: 'right' },
    { 
      title: 'YoY growth rate(%)', 
      dataIndex: 'growth', 
      key: 'growth', 
      align: 'right',
      render: (text) => (
        <Text style={{ color: parseFloat(text) > 0 ? '#ff4d4f' : '#52c41a' }}>
          {text}
        </Text>
      )
    },
  ];

  const tableData = categories.map((cat, index) => ({
    key: index,
    area: cat,
    totalUsage: currentData[index].toLocaleString(undefined, { minimumFractionDigits: 2 }),
    lastYear: lastYearData[index].toLocaleString(undefined, { minimumFractionDigits: 2 }),
    growth: growthRates[index]
  })).reverse();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      
      <Card bodyStyle={{ padding: '10px 24px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <Space wrap>
          <span>Energy item</span>
          <Select defaultValue="Electricity" style={{ width: 150 }}>
            <Option value="Electricity">Electricity</Option>
          </Select>
          
          <span style={{ marginLeft: '16px' }}>Time</span>
          <Select defaultValue="Month" style={{ width: 100 }}>
            <Option value="Month">Month</Option>
            <Option value="Week">Week</Option>
            <Option value="Day">Day</Option>
          </Select>
          <DatePicker picker="month" />
          
          <Button type="primary">Search</Button>
        </Space>
      </Card>

      <Card 
        title="Energy ranking" 
        bordered={false}
        extra={
          <Radio.Group value={rankingType} onChange={(e) => setRankingType(e.target.value)} buttonStyle="solid">
            <Radio.Button value="YoY">YoY</Radio.Button>
            <Radio.Button value="MoM">MoM</Radio.Button>
          </Radio.Group>
        }
      >
        <ReactECharts 
          option={rankingOption} 
          theme={isDarkMode ? 'dark' : 'light'} 
          style={{ height: '400px' }} 
        />
      </Card>

      <Card title="Area details" bordered={false}>
        <Table 
          columns={columns} 
          dataSource={tableData} 
          pagination={{ pageSize: 5 }} 
          size="small" 
        />
      </Card>

    </div>
  );
}