import React, { useState, useEffect } from 'react';
import { Card, Select, DatePicker, Button, Space, message } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import './AreaUsage.css';

const { Option } = Select;
const { RangePicker } = DatePicker;

const AREA_USAGE_DUMMY_DATA = [
  { timestamp: '00:00', tag_name: 'V_F_MALE_C_NR1', value_kwh: 160 },
  { timestamp: '01:00', tag_name: 'V_F_MALE_C_NR1', value_kwh: 170 },
  { timestamp: '02:00', tag_name: 'V_F_MALE_C_NR1', value_kwh: 180 },
  { timestamp: '03:00', tag_name: 'V_F_MALE_C_NR1', value_kwh: 170 },
  { timestamp: '04:00', tag_name: 'V_F_MALE_C_NR1', value_kwh: 150 },
  { timestamp: '05:00', tag_name: 'V_F_MALE_C_NR1', value_kwh: 160 },
  { timestamp: '06:00', tag_name: 'V_F_MALE_C_NR1', value_kwh: 150 },
  { timestamp: '07:00', tag_name: 'V_F_MALE_C_NR1', value_kwh: 160 },
  { timestamp: '00:00', tag_name: 'DB_2', value_kwh: 130 },
  { timestamp: '01:00', tag_name: 'DB_2', value_kwh: 180 },
  { timestamp: '02:00', tag_name: 'DB_2', value_kwh: 130 },
  { timestamp: '03:00', tag_name: 'DB_2', value_kwh: 100 },
  { timestamp: '04:00', tag_name: 'DB_2', value_kwh: 140 },
  { timestamp: '05:00', tag_name: 'DB_2', value_kwh: 150 },
  { timestamp: '06:00', tag_name: 'DB_2', value_kwh: 130 },
  { timestamp: '07:00', tag_name: 'DB_2', value_kwh: 240 },
  { timestamp: '00:00', tag_name: 'V_F_MALE_B_NR1', value_kwh: 100 },
  { timestamp: '01:00', tag_name: 'V_F_MALE_B_NR1', value_kwh: 150 },
  { timestamp: '02:00', tag_name: 'V_F_MALE_B_NR1', value_kwh: 200 },
  { timestamp: '03:00', tag_name: 'V_F_MALE_B_NR1', value_kwh: 130 },
  { timestamp: '04:00', tag_name: 'V_F_MALE_B_NR1', value_kwh: 80 },
  { timestamp: '05:00', tag_name: 'V_F_MALE_B_NR1', value_kwh: 110 },
  { timestamp: '06:00', tag_name: 'V_F_MALE_B_NR1', value_kwh: 140 },
  { timestamp: '07:00', tag_name: 'V_F_MALE_B_NR1', value_kwh: 130 },
  { timestamp: '00:00', tag_name: 'DB3', value_kwh: 20 },
  { timestamp: '01:00', tag_name: 'DB3', value_kwh: 30 },
  { timestamp: '02:00', tag_name: 'DB3', value_kwh: 40 },
  { timestamp: '03:00', tag_name: 'DB3', value_kwh: 20 },
  { timestamp: '04:00', tag_name: 'DB3', value_kwh: 30 },
  { timestamp: '05:00', tag_name: 'DB3', value_kwh: 20 },
  { timestamp: '06:00', tag_name: 'DB3', value_kwh: 40 },
  { timestamp: '07:00', tag_name: 'DB3', value_kwh: 80 },
];

export default function AreaUsagePage() {
  const { isDarkMode } = useOutletContext();

  const [intervalWaktu, setIntervalWaktu] = useState(() => {
    return sessionStorage.getItem('savedInterval') || 'Hour';
  });
  const [dateRange, setDateRange] = useState(null);
  const [chartData, setChartData] = useState([]);

  const applyData = (payload, showNotice = false) => {
    const dataArray = Array.isArray(payload) ? payload : payload?.data || [];

    if (dataArray.length > 0) {
      setChartData(dataArray);
      return;
    }

    setChartData(AREA_USAGE_DUMMY_DATA);
    if (showNotice) {
      message.warning('Area Usage memakai data dummy karena API belum tersedia.');
    }
  };

  const fetchData = () => {
    let url = `http://localhost:5000/energy?interval=${intervalWaktu}`;

    if (dateRange && dateRange.length === 2) {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');
      url += `&start=${startDate}&end=${endDate}`;
    }

    sessionStorage.setItem('savedInterval', intervalWaktu);
    sessionStorage.setItem('savedEnergyUrl', url);

    axios
      .get(url)
      .then((res) => {
        applyData(res.data, true);
      })
      .catch((err) => {
        console.error('Error mengambil data:', err);
        applyData([], true);
      });
  };

  useEffect(() => {
    const savedUrl = sessionStorage.getItem('savedEnergyUrl');

    if (savedUrl) {
      axios
        .get(savedUrl)
        .then((res) => {
          applyData(res.data, true);
        })
        .catch((err) => {
          console.error('Error mengambil data:', err);
          applyData([], true);
        });
    } else {
      fetchData();
    }
  }, []);

  const xAxisData = [...new Set(chartData.map((d) => d.timestamp))].sort();
  const tags = [...new Set(chartData.map((d) => d.tag_name))];

  const series = tags.map((tag) => ({
    name: tag,
    type: 'bar',
    stack: 'Total',
    emphasis: { focus: 'series' },
    data: xAxisData.map((time) => {
      const item = chartData.find((d) => d.tag_name === tag && d.timestamp === time);
      return item ? item.value_kwh : 0;
    }),
  }));

  const areaUsageOption = {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, type: 'scroll', textStyle: { color: isDarkMode ? '#d9d9d9' : '#595959' } },
    grid: { top: '5%', left: '3%', right: '4%', bottom: '80px', containLabel: true },
    dataZoom: [{ type: 'slider', bottom: 35, height: 15 }, { type: 'inside' }],
    xAxis: {
      type: 'category',
      data: xAxisData,
      axisLabel: {
        color: isDarkMode ? '#d9d9d9' : '#595959',
      },
    },
    yAxis: {
      type: 'value',
      name: 'kWh',
      nameTextStyle: {
        color: isDarkMode ? '#d9d9d9' : '#595959',
      },
      axisLabel: {
        color: isDarkMode ? '#d9d9d9' : '#595959',
      },
    },
    series,
  };

  return (
    <div className="area-usage-container">
      <Card styles={{ body: { padding: '10px 24px', overflowX: 'auto' } }} className="full-width-card">
        <Space size="middle" wrap={false} className="filter-wrapper">
          <Space size="small">
            <span className="filter-label">Energy item</span>
            <Select defaultValue="Electricity" className="select-energy">
              <Option value="Electricity">Electricity</Option>
            </Select>
          </Space>

          <Space size="small">
            <span className="filter-label">Interval</span>
            <Select value={intervalWaktu} onChange={setIntervalWaktu} className="select-interval">
              <Option value="Year">Year</Option>
              <Option value="Month">Month</Option>
              <Option value="Day">Day</Option>
              <Option value="Hour">Hour</Option>
              <Option value="Minute">Minute</Option>
            </Select>
          </Space>

          <Space size="small">
            <span className="filter-label">Time</span>
            <RangePicker className="picker-time" onChange={(dates) => setDateRange(dates)} />
          </Space>

          <Button type="primary" onClick={fetchData}>Search</Button>
        </Space>
      </Card>

      <Card title="Area Usage" variant="borderless" className="full-width-card" style={{ marginTop: '5px' }}>
        <ReactECharts
          option={areaUsageOption}
          theme={isDarkMode ? 'dark' : 'light'}
          style={{ height: '620px', width: '100%' }}
        />
      </Card>
    </div>
  );
}
