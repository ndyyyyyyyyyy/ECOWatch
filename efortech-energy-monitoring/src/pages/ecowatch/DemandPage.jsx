import React, { useState, useEffect } from 'react';
import { Card, Select, DatePicker, Button, Space, Table, message } from 'antd';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';
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

  const fetchDemandData = async () => {
    if (!dateRange || dateRange.length !== 2) {
      message.warning('Choose a date range first!');
      return;
    }

    setLoading(true);
    try {
      const start = dateRange[0].format('YYYY-MM-DD');
      const end = dateRange[1].format('YYYY-MM-DD');

      let url = `${ENERGY_ENDPOINT}?interval=${intervalWaktu}&start=${start}&end=${end}`;
      if (checkedAreaNames && checkedAreaNames.length > 0) {
        url += `&areas=${checkedAreaNames.join(',')}`;
      } else {
        url += '&areas=MAIN_ELECTRICAL';
      }

      const response = await axios.get(url);
      const rawData = response.data || [];
      const aggregatedData = {};

      rawData.forEach((item) => {
        if (!aggregatedData[item.timestamp]) {
          aggregatedData[item.timestamp] = 0;
        }
        aggregatedData[item.timestamp] += parseFloat(item.value_kwh);
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

  const seriesName =
    checkedAreaNames && checkedAreaNames.length > 0
      ? checkedAreaNames.length === 1
        ? checkedAreaNames[0]
        : 'Total Selected Areas'
      : 'Demand (MAIN_ELECTRICAL)';

  const demandOption = {
    tooltip: { trigger: 'axis' },
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
      splitLine: {
        lineStyle: { type: 'dashed', color: isDarkMode ? '#303030' : '#e8e8e8' },
      },
    },
    series: [
      {
        name: seriesName,
        type: 'line',
        data: chartSeries,
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

  return (
    <div className="demand-container">
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
              defaultValue={[dayjs(), dayjs()]}
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

      <Card title="Demand" bordered={false} loading={loading} style={{ marginTop: 5 }}>
        <ReactECharts
          notMerge={true}
          option={demandOption}
          theme={isDarkMode ? 'dark' : 'light'}
          className="demand-chart"
          style={{ height: '350px' }}
        />
      </Card>

      <Card title="Data analysis" bordered={false} style={{ marginTop: 5 }}>
        <Table
          dataSource={tableData}
          columns={columns}
          size="small"
          scroll={{ y: 240 }}
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
