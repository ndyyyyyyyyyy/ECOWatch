import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Typography, Space, Select, DatePicker, Button, Spin, message } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';
import { ENERGY_ENDPOINT } from './ecowatchApi';

const { Option } = Select;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function LossAnalysis() {
  const { isDarkMode, checkedAreaNames } = useOutletContext();

  const [intervalWaktu, setIntervalWaktu] = useState('Day');
  const [dateRange, setDateRange] = useState([dayjs().subtract(7, 'day'), dayjs()]);
  const [loading, setLoading] = useState(false);
  const [branchName, setBranchName] = useState('MAIN_ELECTRICAL');
  const [lossData, setLossData] = useState([]);
  const [summaryData, setSummaryData] = useState({ parentTotal: 0, childrenTotal: 0 });

  const fetchLossData = async () => {
    if (!dateRange || dateRange.length !== 2) {
      message.warning('Pilih rentang tanggal!');
      return;
    }

    setLoading(true);

    try {
      const start = dateRange[0].format('YYYY-MM-DD');
      const end = dateRange[1].format('YYYY-MM-DD');
      const targetParent = checkedAreaNames && checkedAreaNames.length > 0 ? checkedAreaNames[0] : 'MAIN_ELECTRICAL';
      setBranchName(targetParent);
      const parentRes = await axios.get(
        `${ENERGY_ENDPOINT}?interval=${intervalWaktu}&start=${start}&end=${end}&areas=${targetParent}`
      );
      const parentData = parentRes.data || [];

      if (!parentData.length) {
        setLossData([]);
        return;
      }

      const childrenList = parentData[0].children_names || [];
      let allRawData = [...parentData];

      if (childrenList.length > 0) {
        const childrenRes = await axios.get(
          `${ENERGY_ENDPOINT}?interval=${intervalWaktu}&start=${start}&end=${end}&areas=${childrenList.join(',')}`
        );
        allRawData = [...allRawData, ...(childrenRes.data || [])];
      }

      const timeMap = {};
      let totalParentUsage = 0;
      let totalChildrenUsage = 0;

      allRawData.forEach((item) => {
        const ts = item.timestamp;
        if (!timeMap[ts]) timeMap[ts] = { time: ts, parentVal: 0, childrenVal: 0 };

        const val = parseFloat(item.value_kwh);
        if (item.tag_name === targetParent) {
          timeMap[ts].parentVal += val;
          totalParentUsage += val;
        } else {
          timeMap[ts].childrenVal += val;
          totalChildrenUsage += val;
        }
      });

      const formattedData = Object.values(timeMap)
        .sort((a, b) => a.time.localeCompare(b.time))
        .map((row, index) => {
          const lossVal = Math.max(0, row.parentVal - row.childrenVal);
          let balanceRt = 100;

          if (row.parentVal > 0) {
            balanceRt = (row.childrenVal / row.parentVal) * 100;
            if (balanceRt > 100) balanceRt = 100;
          } else if (row.parentVal === 0 && row.childrenVal === 0) {
            balanceRt = 0;
          }

          return {
            key: index,
            time: row.time.split(' ')[0],
            selectedBranch: row.parentVal,
            subBranch: row.childrenVal,
            lossValue: lossVal,
            balanceRate: balanceRt,
          };
        });

      setLossData(formattedData);
      setSummaryData({ parentTotal: totalParentUsage, childrenTotal: totalChildrenUsage });
    } catch (error) {
      console.error('Failed to fetch Loss Analysis data', error);
      message.error('Failed to contact server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLossData();
  }, [checkedAreaNames]);

  const xData = lossData.map((row) => row.time);
  const branchUsage = lossData.map((row) => row.selectedBranch.toFixed(2));
  const subBranchUsage = lossData.map((row) => row.subBranch.toFixed(2));
  const balanceRate = lossData.map((row) => row.balanceRate.toFixed(2));

  const totalLoss = Math.max(0, summaryData.parentTotal - summaryData.childrenTotal);
  let totalBalance = 100;
  if (summaryData.parentTotal > 0) {
    totalBalance = (summaryData.childrenTotal / summaryData.parentTotal) * 100;
    if (totalBalance > 100) totalBalance = 100;
  } else if (summaryData.parentTotal === 0 && summaryData.childrenTotal === 0) {
    totalBalance = 0;
  }

  const tableColumns = [
    { title: 'Time', dataIndex: 'time', key: 'time', width: '15%' },
    {
      title: `${branchName} usage (kWh)`,
      dataIndex: 'selectedBranch',
      align: 'right',
      render: (value) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    },
    {
      title: 'Sub-branch usage (kWh)',
      dataIndex: 'subBranch',
      align: 'right',
      render: (value) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    },
    {
      title: 'Loss value (kWh)',
      dataIndex: 'lossValue',
      align: 'right',
      render: (value) => (
        <Text type={value > 0 ? 'danger' : ''}>
          {value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'Balance rate (%)',
      dataIndex: 'balanceRate',
      align: 'right',
      render: (value) => `${value.toFixed(2)}%`,
    },
  ];

  const lossAnalysisOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: {
      bottom: 0,
      data: [`${branchName} usage`, 'Sub-branch usage', 'Balance rate'],
      textStyle: { color: isDarkMode ? '#d9d9d9' : '#595959' },
    },
    grid: { left: '5%', right: '5%', bottom: 80, top: '10%', containLabel: true },
    dataZoom: [
      {
        type: 'slider',
        bottom: 35,
        height: 15,
        borderColor: 'transparent',
        backgroundColor: isDarkMode ? '#1f1f1f' : '#e6f4ff',
        fillerColor: isDarkMode ? 'rgba(22, 119, 255, 0.3)' : 'rgba(22, 119, 255, 0.2)',
      },
      { type: 'inside' },
    ],
    xAxis: [{ type: 'category', data: xData, axisTick: { alignWithLabel: true }, axisLabel: { color: isDarkMode ? '#d9d9d9' : '#595959' } }],
    yAxis: [
      {
        type: 'value',
        name: 'Energy usage(kWh)',
        position: 'left',
        nameTextStyle: { color: isDarkMode ? '#d9d9d9' : '#595959' },
        axisLabel: {
          color: isDarkMode ? '#d9d9d9' : '#595959',
          formatter: (value) => (value >= 1000 ? `${value / 1000}K` : value),
        },
        splitLine: { lineStyle: { type: 'dashed', color: isDarkMode ? '#303030' : '#e8e8e8' } },
      },
      {
        type: 'value',
        name: 'Balance rate(%)',
        position: 'right',
        min: 0,
        max: 100,
        nameTextStyle: { color: isDarkMode ? '#d9d9d9' : '#595959' },
        axisLabel: { color: isDarkMode ? '#d9d9d9' : '#595959', formatter: '{value}' },
        splitLine: { show: false },
      },
    ],
    series: [
      { name: `${branchName} usage`, type: 'bar', yAxisIndex: 0, itemStyle: { color: '#1677ff' }, data: branchUsage },
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
          <span style={{ marginLeft: 16 }}>Interval</span>
          <Select value={intervalWaktu} onChange={setIntervalWaktu} style={{ width: 120 }}>
            <Option value="Day">Day</Option>
            <Option value="Month">Month</Option>
          </Select>
          <span style={{ marginLeft: 16 }}>Time</span>
          <RangePicker value={dateRange} onChange={setDateRange} allowClear={false} />
          <Button type="primary" onClick={fetchLossData} loading={loading}>Search</Button>
        </Space>
      </Card>

      <Spin spinning={loading}>
        <Row gutter={[10, 10]}>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} bodyStyle={{ padding: '20px' }} style={{ height: '100%' }}>
              <Text type="secondary" style={{ fontSize: '13px' }}>{branchName} usage</Text>
              <Title level={3} style={{ margin: 0, color: isDarkMode ? '#fff' : '#000' }}>
                {summaryData.parentTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                <Text style={{ fontSize: '14px', fontWeight: 'normal', color: isDarkMode ? '#a6a6a6' : '#595959' }}>kWh</Text>
              </Title>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} bodyStyle={{ padding: '20px' }} style={{ height: '100%' }}>
              <Text type="secondary" style={{ fontSize: '13px' }}>Sub-branch usage</Text>
              <Title level={3} style={{ margin: 0, color: isDarkMode ? '#fff' : '#000' }}>
                {summaryData.childrenTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                <Text style={{ fontSize: '14px', fontWeight: 'normal', color: isDarkMode ? '#a6a6a6' : '#595959' }}>kWh</Text>
              </Title>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} bodyStyle={{ padding: '20px' }} style={{ height: '100%' }}>
              <Text type="secondary" style={{ fontSize: '13px' }}>Loss value</Text>
              <Title level={3} style={{ margin: 0, color: totalLoss > 0 ? '#ff4d4f' : (isDarkMode ? '#fff' : '#000') }}>
                {totalLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                <Text style={{ fontSize: '14px', fontWeight: 'normal', color: isDarkMode ? '#a6a6a6' : '#595959' }}>kWh</Text>
              </Title>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} bodyStyle={{ padding: '20px' }} style={{ height: '100%' }}>
              <Text type="secondary" style={{ fontSize: '13px' }}>Balance rate</Text>
              <Title level={3} style={{ margin: 0, color: isDarkMode ? '#fff' : '#000' }}>
                {totalBalance.toFixed(2)}{' '}
                <Text style={{ fontSize: '14px', fontWeight: 'normal', color: isDarkMode ? '#a6a6a6' : '#595959' }}>%</Text>
              </Title>
            </Card>
          </Col>
        </Row>

        <Row gutter={[10, 10]} style={{ marginTop: '10px' }}>
          <Col span={24}>
            <Card title="Loss analysis" bordered={false}>
              <ReactECharts notMerge option={lossAnalysisOption} theme={isDarkMode ? 'dark' : 'light'} style={{ height: '350px' }} />
            </Card>
          </Col>
          <Col span={24}>
            <Card title="Loss detail" bordered={false} bodyStyle={{ padding: 0 }}>
              <Table dataSource={lossData} columns={tableColumns} pagination={false} scroll={{ y: 300 }} size="middle" />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}
