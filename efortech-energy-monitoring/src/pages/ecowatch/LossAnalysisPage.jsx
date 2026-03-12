import React from 'react';
import { Card, Row, Col, Table, Typography, Space, Select, DatePicker, Button } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useOutletContext } from 'react-router-dom';

const { Option } = Select;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function LossAnalysisPage() {
  const { isDarkMode } = useOutletContext();

  const lossDates = [];
  const branchUsage = [];
  const subBranchUsage = [];
  const balanceRate = [];

  for (let i = 25; i <= 31; i += 1) lossDates.push(`01/${i}`);
  for (let i = 1; i <= 24; i += 1) lossDates.push(`02/${i < 10 ? `0${i}` : i}`);

  lossDates.forEach((date) => {
    if (date === '02/02') {
      branchUsage.push(0);
      subBranchUsage.push(0);
      balanceRate.push(100);
    } else if (date === '02/23') {
      branchUsage.push(1957361.86);
      subBranchUsage.push(1957361.86);
      balanceRate.push(100);
    } else {
      branchUsage.push(0);
      subBranchUsage.push(0);
      balanceRate.push(0);
    }
  });

  const tableData = lossDates.map((date, index) => {
    const lossVal = branchUsage[index] - subBranchUsage[index];
    return {
      key: index,
      time: date,
      selectedBranch: branchUsage[index].toLocaleString('en-US', { minimumFractionDigits: 2 }),
      subBranch: subBranchUsage[index].toLocaleString('en-US', { minimumFractionDigits: 2 }),
      lossValue: lossVal.toLocaleString('en-US', { minimumFractionDigits: 2 }),
      balanceRate: balanceRate[index] === 0 ? '--' : `${balanceRate[index]}.00`,
    };
  });

  const tableColumns = [
    { title: 'Time', dataIndex: 'time', key: 'time', width: '15%' },
    { title: 'Selected branch usage(kWh)', dataIndex: 'selectedBranch', key: 'selectedBranch', align: 'right' },
    { title: 'Sub-branch usage(kWh)', dataIndex: 'subBranch', key: 'subBranch', align: 'right' },
    { title: 'Loss value(kWh)', dataIndex: 'lossValue', key: 'lossValue', align: 'right' },
    { title: 'Balance rate(%)', dataIndex: 'balanceRate', key: 'balanceRate', align: 'right' },
  ];

  const lossAnalysisOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: {
      bottom: 0,
      data: ['Selected branch usage', 'Sub-branch usage', 'Balance rate'],
      textStyle: { color: isDarkMode ? '#d9d9d9' : '#595959' },
    },
    grid: { left: '5%', right: '5%', bottom: 80, top: '10%', containLabel: true },
    dataZoom: [
      {
        type: 'slider',
        bottom: 35,
        height: 15,
        start: 0,
        end: 100,
        borderColor: 'transparent',
        backgroundColor: isDarkMode ? '#1f1f1f' : '#e6f4ff',
        fillerColor: isDarkMode ? 'rgba(22, 119, 255, 0.3)' : 'rgba(22, 119, 255, 0.2)',
      },
      { type: 'inside' },
    ],
    xAxis: [{ type: 'category', data: lossDates, axisTick: { alignWithLabel: true } }],
    yAxis: [
      {
        type: 'value',
        name: 'Energy usage(kWh)',
        position: 'left',
        axisLabel: { formatter: (value) => (value > 0 ? `${value / 1000}K` : '0') },
        splitLine: { lineStyle: { type: 'dashed', color: isDarkMode ? '#303030' : '#e8e8e8' } },
      },
      {
        type: 'value',
        name: 'Balance rate(%)',
        position: 'right',
        min: 0,
        max: 100,
        axisLabel: { formatter: '{value}' },
        splitLine: { show: false },
      },
    ],
    series: [
      { name: 'Selected branch usage', type: 'bar', yAxisIndex: 0, itemStyle: { color: '#1677ff' }, data: branchUsage },
      { name: 'Sub-branch usage', type: 'bar', yAxisIndex: 0, itemStyle: { color: '#bae0ff' }, data: subBranchUsage },
      { name: 'Balance rate', type: 'line', yAxisIndex: 1, itemStyle: { color: '#faad14' }, lineStyle: { width: 2 }, data: balanceRate },
    ],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Card bodyStyle={{ padding: '10px 24px' }} bordered={false}>
        <Space wrap>
          <span>Energy item</span>
          <Select defaultValue="Electricity" style={{ width: 150 }}>
            <Option value="Electricity">Electricity</Option>
          </Select>
          <span>Interval</span>
          <Select defaultValue="Day" style={{ width: 120 }}>
            <Option value="Day">Day</Option>
            <Option value="Month">Month</Option>
          </Select>
          <span>Time</span>
          <RangePicker />
          <Button type="primary">Search</Button>
        </Space>
      </Card>

      <Row gutter={[10, 10]}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} bodyStyle={{ padding: '20px' }} style={{ height: '100%' }}>
            <Text type="secondary">Selected branch usage</Text>
            <Title level={3} style={{ margin: 0 }}>1,957,361.86 <Text style={{ fontSize: '14px', fontWeight: 'normal' }}>kWh</Text></Title>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} bodyStyle={{ padding: '20px' }} style={{ height: '100%' }}>
            <Text type="secondary">Sub-branch usage</Text>
            <Title level={3} style={{ margin: 0 }}>1,957,361.86 <Text style={{ fontSize: '14px', fontWeight: 'normal' }}>kWh</Text></Title>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} bodyStyle={{ padding: '20px' }} style={{ height: '100%' }}>
            <Text type="secondary">Loss value</Text>
            <Title level={3} style={{ margin: 0 }}>0.00 <Text style={{ fontSize: '14px', fontWeight: 'normal' }}>kWh</Text></Title>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} bodyStyle={{ padding: '20px' }} style={{ height: '100%' }}>
            <Text type="secondary">Balance rate</Text>
            <Title level={3} style={{ margin: 0 }}>100.00 <Text style={{ fontSize: '14px', fontWeight: 'normal' }}>%</Text></Title>
          </Card>
        </Col>
      </Row>

      <Row gutter={[10, 10]}>
        <Col span={24}>
          <Card title="Loss analysis" bordered={false}>
            <ReactECharts
              option={lossAnalysisOption}
              theme={isDarkMode ? 'dark' : 'light'}
              style={{ height: '350px' }}
            />
          </Card>
        </Col>
        <Col span={24}>
          <Card title="Loss detail" bordered={false} bodyStyle={{ padding: 0 }}>
            <Table
              dataSource={tableData}
              columns={tableColumns}
              pagination={false}
              scroll={{ y: 300 }}
              size="middle"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
