import React, { useState } from 'react';
import { Card, Select, DatePicker, Button, Space, Table } from 'antd';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { useOutletContext } from 'react-router-dom';
import './Demand.css';

const { Option } = Select;
const { RangePicker } = DatePicker;

export default function DemandPage() {
  const { isDarkMode } = useOutletContext();
  const [intervalWaktu, setIntervalWaktu] = useState('Minute');

  const demandOption = {
    tooltip: { trigger: 'axis' },
    grid: {top: '13%', left: '3%', right: '3%', bottom: '50px', containLabel: true},
    dataZoom: [{ type: 'inside', start: 0, end: 100, height: 15 }, { type: 'slider', bottom: 0, height: 20 }],
    xAxis: { 
      type: 'category', 
      boundaryGap: false,
      data: ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '09:30'] 
    },
    yAxis: { type: 'value', name: 'kW', splitLine: { lineStyle: { type: 'dashed' } } },
    series: [
      {
        name: 'Demand',
        type: 'line',
        data: [130, 0, 90, 80, 100, 0, 85, 100, 0, 120, 144.59],
        itemStyle: { color: '#52c41a' },
        lineStyle: { width: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(82, 196, 26, 0.6)' },
            { offset: 1, color: 'rgba(82, 196, 26, 0.05)' }
          ])
        },
        markPoint: {
          data: [{ type: 'max', name: 'Peak Demand' }],
          itemStyle: { color: '#52c41a' },
          label: { color: '#fff', fontWeight: 'bold' }
        }
      }
    ]
  };

  const columns = [
    { title: 'Date', dataIndex: 'date', key: 'date' },
    { title: 'Electricity period', dataIndex: 'period', key: 'period' },
    { title: 'Demand(kW)', dataIndex: 'demand', key: 'demand' },
    { title: 'Time', dataIndex: 'time', key: 'time' },
  ];

  const tableData = [
    { key: '1', date: '2026/02/24', period: 'Off-peak', demand: '144.59', time: '08:30' },
    { key: '2', date: '2026/02/24', period: 'All time', demand: '150.97', time: '09:30' },
  ];

  return (
    <div className="demand-container">
      
      <Card bodyStyle={{ padding: '10px 24px' }}>
        <div className="demand-filter-wrapper">
          <Space>
            <span>Interval</span>
            <Select value={intervalWaktu} onChange={setIntervalWaktu} className="demand-select">
              <Option value="Minute">Minute</Option>
              <Option value="Hour">Hour</Option>
            </Select>
            <span className="demand-label-time">Time</span>
            <RangePicker />
            <Button type="primary" className="demand-btn-search">Search</Button>
          </Space>
        </div>
      </Card>

      <Card title="Demand" bordered={false}>
        <ReactECharts option={demandOption} theme={isDarkMode ? 'dark' : 'light'} className="demand-chart" />
      </Card>

      <Card title="Data analysis" bordered={false}>
        <Table 
          dataSource={tableData} 
          columns={columns} 
          size="small" 
          scroll={{ y: 200 }} 
          pagination={{
            showSizeChanger: true, 
            showQuickJumper: true, 
            showTotal: (total) => `Total ${total}`, 
            defaultPageSize: 10, 
            pageSizeOptions: ['10', '20', '50', '100']
          }}
        />
      </Card>
      
    </div>
  );
}
