import React, { useState, useEffect } from 'react';
import { Card, Select, DatePicker, Button, Space, Table, message, Spin } from 'antd';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';
import { RefreshCw, Download } from 'lucide-react';
import './Demand.css';
import { ENERGY_ENDPOINT } from './ecowatchApi';

const { Option } = Select;
const { RangePicker } = DatePicker;

export default function DemandPage() {
  const { isDarkMode, checkedAreaNames } = useOutletContext();

  const [intervalWaktu, setIntervalWaktu] = useState('Minute');
  const [dateRange, setDateRange] = useState([dayjs(), dayjs()]);
  const [loading, setLoading] = useState(false);
  const [chartXAxis, setChartXAxis] = useState([]);
  const [chartSeries, setChartSeries] = useState([]);
  const [tableData, setTableData] = useState([]);

  const formatKw = (value) => `${Number(value || 0).toFixed(2)} kW`;

  const fetchDemandData = async () => {
    if (!dateRange || dateRange.length !== 2) {
      message.warning('Choose a date range first!');
      return;
    }

    setLoading(true);
    try {
      const start = dateRange[0].format('YYYY-MM-DD');
      const end = dateRange[1].format('YYYY-MM-DD');

      let url = `${ENERGY_ENDPOINT}?metric=power&interval=${intervalWaktu}&start=${start}&end=${end}`;
      if (checkedAreaNames && checkedAreaNames.length > 0) {
        url += `&areas=${checkedAreaNames.join(',')}`;
      } else {
        url += '&areas=Office';
      }

      const response = await axios.get(url);
      const rawData = response.data || [];
      const aggregatedData = {};

      rawData.forEach((item) => {
        if (!aggregatedData[item.timestamp]) {
          aggregatedData[item.timestamp] = 0;
        }
        aggregatedData[item.timestamp] += parseFloat(item.value_kw ?? item.value ?? 0);
      });

      const timestamps = Object.keys(aggregatedData).sort();
      const xData = [];
      const sData = [];
      const tData = [];

      timestamps.forEach((ts, index) => {
        const val = aggregatedData[ts];
        xData.push(ts);
        sData.push(val);

        const [datePart, timePart] = ts.split(' ');
        tData.push({
          key: index.toString(),
          date: datePart,
          period: 'All time',
          demand: val.toFixed(2),
          time: timePart || '00:00',
        });
      });

      setChartXAxis(xData);
      setChartSeries(sData);
      setTableData(tData.reverse());
    } catch (error) {
      console.error('Failed to fetch demand data:', error);
      message.error('Failed to load data from server!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDemandData();
  }, [checkedAreaNames]);

  const handleExportCsv = () => {
    if (!tableData || tableData.length === 0) {
      message.warning('No data to export!');
      return;
    }

    const headers = ['Date', 'Electricity Period', 'Demand (kW)', 'Time'];
    const rows = tableData.map((d) => `${d.date},${d.period},${d.demand},${d.time}`);
    const csvContent = `data:text/csv;charset=utf-8,${headers.join(',')}\n${rows.join('\n')}`;
    const encodedUri = encodeURI(csvContent);

    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DemandData_${dayjs().format('YYYYMMDD_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    message.success('Demand data exported successfully!');
  };

  const seriesName =
    checkedAreaNames && checkedAreaNames.length > 0
      ? checkedAreaNames.length === 1
        ? checkedAreaNames[0]
        : 'Total Selected Areas'
      : 'Demand (Office)';

  const demandOption = {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) => formatKw(value),
    },
    grid: { top: '13%', left: '3%', right: '3%', bottom: '50px', containLabel: true },
    dataZoom: [
      { type: 'inside', start: 0, end: 100, height: 15 },
      { type: 'slider', bottom: 0, height: 20 },
    ],
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: chartXAxis,
    },
    yAxis: {
      type: 'value',
      name: 'kW',
      axisLabel: {
        formatter: (value) => Number(value).toFixed(2),
      },
      splitLine: {
        lineStyle: { type: 'dashed', color: isDarkMode ? '#303030' : '#e8e8e8' },
      },
    },
    series: [
      {
        name: seriesName,
        type: 'line',
        data: chartSeries.map((value) => Number(Number(value).toFixed(2))),
        itemStyle: { color: '#52c41a' },
        lineStyle: { width: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(82, 196, 26, 0.6)' },
            { offset: 1, color: 'rgba(82, 196, 26, 0.05)' },
          ]),
        },
        markPoint: {
          data: [{ type: 'max', name: 'Peak Demand' }],
          itemStyle: { color: '#52c41a' },
          label: { color: '#fff', fontWeight: 'bold' },
        },
      },
    ],
  };

  const columns = [
    { title: 'Date', dataIndex: 'date', key: 'date' },
    { title: 'Electricity period', dataIndex: 'period', key: 'period' },
    { title: 'Demand (kW)', dataIndex: 'demand', key: 'demand' },
    { title: 'Time', dataIndex: 'time', key: 'time' },
  ];

  const extraControls = (
    <Space size="small">
      <Button
        type="text"
        icon={<RefreshCw size={18} />}
        loading={loading}
        onClick={fetchDemandData}
        style={{ color: isDarkMode ? '#a6a6a6' : '#8c8c8c' }}
        title="Refresh Data"
      />
      <Button
        type="text"
        icon={<Download size={18} />}
        onClick={handleExportCsv}
        style={{ color: isDarkMode ? '#a6a6a6' : '#8c8c8c' }}
        title="Download CSV"
      />
    </Space>
  );

  return (
    <div className="demand-container" style={{ height: 'calc(100vh - 80px)' }}>
      <Card styles={{ body: { padding: '10px 24px' } }}>
        <div className="demand-filter-wrapper">
          <Space wrap>
            <span>Interval</span>
            <Select
              value={intervalWaktu}
              onChange={setIntervalWaktu}
              className="demand-select"
              style={{ width: 120 }}
            >
              <Option value="Minute">Minute</Option>
              <Option value="Hour">Hour</Option>
            </Select>
            <span className="demand-label-time" style={{ marginLeft: 16 }}>
              Time
            </span>
            <RangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates)}
              allowClear={false}
            />
            <Button
              type="primary"
              className="demand-btn-search"
              onClick={fetchDemandData}
              loading={loading}
            >
              Search
            </Button>
          </Space>
        </div>
      </Card>

      <Card title="Demand" bordered={false} extra={extraControls} style={{ marginTop: 5 }}>
        <Spin spinning={loading}>
          <ReactECharts
            notMerge={true}
            option={demandOption}
            theme={isDarkMode ? 'dark' : 'light'}
            className="demand-chart"
            style={{ height: 'calc(40vh - 70px)', minHeight: '220px', width: '100%' }}
          />
        </Spin>
      </Card>

      <Card
        title="Data analysis"
        bordered={false}
        style={{ marginTop: 5, flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}
        styles={{ body: { flex: 1, paddingBottom: 0 } }}
      >
        <Table
          dataSource={tableData}
          columns={columns}
          size="small"
          scroll={{ y: 'calc(40vh - 90px)' }}
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `Total ${total} data`,
            defaultPageSize: 10,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
        />
      </Card>
    </div>
  );
}
