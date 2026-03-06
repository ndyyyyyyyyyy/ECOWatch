import React, { useState } from 'react';
import { Card, Select, DatePicker, Button, Space, Row, Col } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useOutletContext } from 'react-router-dom';

const { Option } = Select;
const { RangePicker } = DatePicker;

export default function TOUPeriod() {
  const { isDarkMode } = useOutletContext();
  const [intervalWaktu, setIntervalWaktu] = useState('Day');

  const touElectricityOption = {
    title: {
      text: '106.93 MWh\n\nTotal usage',
      left: '25%',
      top: 'center',
      textAlign: 'center',
      textStyle: { fontSize: 14, color: isDarkMode ? '#fff' : '#333', fontWeight: 'bold' }
    },
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', right: '10%', top: 'center', textStyle: { color: isDarkMode ? '#d9d9d9' : '#595959' } },
    series: [
      {
        name: 'Electricity',
        type: 'pie',
        radius: ['60%', '80%'],
        center: ['25%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        data: [
          { value: 1.11, name: 'On-peak (1.04%)', itemStyle: { color: '#faad14' } },
          { value: 105.82, name: 'Off-peak (98.96%)', itemStyle: { color: '#52c41a' } }
        ]
      }
    ]
  };

  const touCostOption = {
    title: {
      text: '111,333.66 K IDR\n\nTotal cost',
      left: '25%',
      top: 'center',
      textAlign: 'center',
      textStyle: { fontSize: 14, color: isDarkMode ? '#fff' : '#333', fontWeight: 'bold' }
    },
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', right: '10%', top: 'center', textStyle: { color: isDarkMode ? '#d9d9d9' : '#595959' } },
    series: [
      {
        name: 'Cost',
        type: 'pie',
        radius: ['60%', '80%'],
        center: ['25%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        data: [
          { value: 1728.46, name: 'On-peak (1.55%)', itemStyle: { color: '#faad14' } },
          { value: 109605.20, name: 'Off-peak (98.45%)', itemStyle: { color: '#52c41a' } }
        ]
      }
    ]
  };

  const touLineOption = {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, data: ['On-peak', 'Off-peak'], textStyle: { color: isDarkMode ? '#d9d9d9' : '#595959' } },
    grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
    dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 30, height: 15 }],
    xAxis: { type: 'category', boundaryGap: false, data: ['01/25', '01/29', '02/02', '02/06', '02/10', '02/14', '02/18', '02/22', '02/24'] },
    yAxis: { type: 'value', name: 'kWh', splitLine: { lineStyle: { type: 'dashed', color: isDarkMode ? '#303030' : '#e8e8e8' } } },
    series: [
      { name: 'On-peak', type: 'line', itemStyle: { color: '#faad14' }, data: [0, 0, 0, 0, 0, 0, 0, 20000, 0] },
      { name: 'Off-peak', type: 'line', itemStyle: { color: '#52c41a' }, data: [0, 0, 0, 0, 0, 0, 0, 100000, 0] }
    ]
  };

  const topUsageOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
    dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 10, height: 15 }],
    xAxis: { type: 'category', data: ['LVMDP_RAC', 'NR1', 'NR2', 'UT_NEW'] },
    yAxis: { type: 'value', name: 'kWh', splitLine: { lineStyle: { type: 'dashed', color: isDarkMode ? '#303030' : '#e8e8e8' } } },
    series: [
      { name: 'Usage', type: 'bar', barWidth: '20%', itemStyle: { color: '#1677ff' }, data: [110000, 80000, 60000, 30000] }
    ]
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Card bodyStyle={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <Space wrap>
          <span>Energy item</span>
          <Select defaultValue="Electricity" style={{ width: 120 }}><Option value="Electricity">Electricity</Option></Select>
          <span>Interval</span>
          <Select value={intervalWaktu} onChange={setIntervalWaktu} style={{ width: 100 }}>
            <Option value="Day">Day</Option>
            <Option value="Month">Month</Option>
          </Select>
          <span>Time</span>
          <RangePicker />
          <Button type="primary">Search</Button>
        </Space>
      </Card>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="TOU electricity" bordered={false}>
            <ReactECharts option={touElectricityOption} theme={isDarkMode ? 'dark' : 'light'} style={{ height: '250px' }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="TOU cost" bordered={false}>
            <ReactECharts option={touCostOption} theme={isDarkMode ? 'dark' : 'light'} style={{ height: '250px' }} />
          </Card>
        </Col>
      </Row>

      <Card title="TOU Period" bordered={false}>
        <ReactECharts option={touLineOption} theme={isDarkMode ? 'dark' : 'light'} style={{ height: '300px' }} />
      </Card>

      <Card title="Top 30 usage" bordered={false}>
        <ReactECharts option={topUsageOption} theme={isDarkMode ? 'dark' : 'light'} style={{ height: '250px' }} />
      </Card>
    </div>
  );
}