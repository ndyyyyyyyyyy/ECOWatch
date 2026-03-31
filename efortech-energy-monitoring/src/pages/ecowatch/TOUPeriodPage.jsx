import React, { useState, useEffect } from 'react';
import { Card, Select, DatePicker, Button, Space, Row, Col, message, Spin } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';
import { ENERGY_ENDPOINT } from './ecowatchApi';

const { Option } = Select;
const { RangePicker } = DatePicker;

const TARIFF_OFF_PEAK = 1039;
const TARIFF_ON_PEAK = 1558;

export default function TOUPeriod() {
  const { isDarkMode, checkedAreaNames } = useOutletContext();

  const [intervalWaktu, setIntervalWaktu] = useState('Day');
  const [dateRange, setDateRange] = useState([dayjs().subtract(7, 'day'), dayjs()]);
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState({
    peakKwh: 0,
    offPeakKwh: 0,
    peakCost: 0,
    offPeakCost: 0,
  });
  const [lineChartData, setLineChartData] = useState({ dates: [], peak: [], offPeak: [] });
  const [barChartData, setBarChartData] = useState({ tags: [], values: [] });

  const fetchTOUData = async () => {
    if (!dateRange || dateRange.length !== 2) {
      message.warning('Choose a date range!');
      return;
    }

    setLoading(true);
    try {
      const start = dateRange[0].format('YYYY-MM-DD');
      const end = dateRange[1].format('YYYY-MM-DD');
      const targetAreas =
        checkedAreaNames && checkedAreaNames.length > 0
          ? checkedAreaNames.join(',')
          : 'MAIN_ELECTRICAL';

      const url = `${ENERGY_ENDPOINT}?interval=Hour&start=${start}&end=${end}&areas=${targetAreas}`;
      const response = await axios.get(url);
      const rawData = response.data || [];

      let peakKwh = 0;
      let offPeakKwh = 0;
      let peakCost = 0;
      let offPeakCost = 0;

      const timeSeriesMap = {};
      const tagUsageMap = {};

      rawData.forEach((item) => {
        const val = parseFloat(item.value_kwh);
        const [datePart, timePart] = item.timestamp.split(' ');
        const hour = parseInt(timePart.split(':')[0], 10);
        const isPeak = hour >= 17 && hour < 22;

        if (isPeak) {
          peakKwh += val;
          peakCost += val * TARIFF_ON_PEAK;
        } else {
          offPeakKwh += val;
          offPeakCost += val * TARIFF_OFF_PEAK;
        }

        const timeKey = intervalWaktu === 'Month' ? datePart.substring(0, 7) : datePart;
        if (!timeSeriesMap[timeKey]) {
          timeSeriesMap[timeKey] = { peak: 0, offPeak: 0 };
        }

        if (isPeak) {
          timeSeriesMap[timeKey].peak += val;
        } else {
          timeSeriesMap[timeKey].offPeak += val;
        }

        if (!tagUsageMap[item.tag_name]) {
          tagUsageMap[item.tag_name] = 0;
        }
        tagUsageMap[item.tag_name] += val;
      });

      setSummaryData({ peakKwh, offPeakKwh, peakCost, offPeakCost });

      const sortedDates = Object.keys(timeSeriesMap).sort();
      setLineChartData({
        dates: sortedDates,
        peak: sortedDates.map((date) => timeSeriesMap[date].peak.toFixed(2)),
        offPeak: sortedDates.map((date) => timeSeriesMap[date].offPeak.toFixed(2)),
      });

      const sortedTags = Object.entries(tagUsageMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30);

      setBarChartData({
        tags: sortedTags.map((tag) => tag[0]),
        values: sortedTags.map((tag) => tag[1].toFixed(2)),
      });
    } catch (error) {
      console.error('Error fetching data TOU:', error);
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTOUData();
  }, [checkedAreaNames]);

  const totalKwh = summaryData.peakKwh + summaryData.offPeakKwh;
  const peakPct = totalKwh > 0 ? ((summaryData.peakKwh / totalKwh) * 100).toFixed(2) : 0;
  const offPeakPct =
    totalKwh > 0 ? ((summaryData.offPeakKwh / totalKwh) * 100).toFixed(2) : 0;

  const totalCost = summaryData.peakCost + summaryData.offPeakCost;
  const peakCostPct =
    totalCost > 0 ? ((summaryData.peakCost / totalCost) * 100).toFixed(2) : 0;
  const offPeakCostPct =
    totalCost > 0 ? ((summaryData.offPeakCost / totalCost) * 100).toFixed(2) : 0;

  const touElectricityOption = {
    title: {
      text: `${totalKwh > 1000 ? `${(totalKwh / 1000).toFixed(2)} MWh` : `${totalKwh.toFixed(2)} kWh`}\n\nTotal usage`,
      left: '24%',
      top: 'center',
      textAlign: 'center',
      textStyle: {
        fontSize: 13,
        color: isDarkMode ? '#fff' : '#333',
        fontWeight: 'bold',
      },
    },
    tooltip: { trigger: 'item', formatter: '{b}: {c} kWh ({d}%)' },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: isDarkMode ? '#d9d9d9' : '#595959' },
    },
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
          {
            value: summaryData.peakKwh.toFixed(2),
            name: `On-peak (${peakPct}%)`,
            itemStyle: { color: '#faad14' },
          },
          {
            value: summaryData.offPeakKwh.toFixed(2),
            name: `Off-peak (${offPeakPct}%)`,
            itemStyle: { color: '#52c41a' },
          },
        ],
      },
    ],
  };

  const touCostOption = {
    title: {
      text: `${(totalCost / 1000).toFixed(2)} K IDR\n\nTotal cost`,
      left: '24%',
      top: 'center',
      textAlign: 'center',
      textStyle: {
        fontSize: 13,
        color: isDarkMode ? '#fff' : '#333',
        fontWeight: 'bold',
      },
    },
    tooltip: { trigger: 'item', formatter: '{b}: IDR {c} ({d}%)' },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: isDarkMode ? '#d9d9d9' : '#595959' },
    },
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
          {
            value: summaryData.peakCost.toFixed(2),
            name: `On-peak (${peakCostPct}%)`,
            itemStyle: { color: '#faad14' },
          },
          {
            value: summaryData.offPeakCost.toFixed(2),
            name: `Off-peak (${offPeakCostPct}%)`,
            itemStyle: { color: '#52c41a' },
          },
        ],
      },
    ],
  };

  const touLineOption = {
    tooltip: { trigger: 'axis' },
    legend: {
      bottom: 0,
      data: ['On-peak', 'Off-peak'],
      textStyle: { color: isDarkMode ? '#d9d9d9' : '#595959' },
    },
    grid: { top: '10%', left: '3%', right: '4%', bottom: '15%', containLabel: true },
    dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 30, height: 15 }],
    xAxis: { type: 'category', boundaryGap: false, data: lineChartData.dates },
    yAxis: {
      type: 'value',
      name: 'kWh',
      splitLine: {
        lineStyle: { type: 'dashed', color: isDarkMode ? '#303030' : '#e8e8e8' },
      },
    },
    series: [
      {
        name: 'On-peak',
        type: 'line',
        itemStyle: { color: '#faad14' },
        areaStyle: { opacity: 0.1 },
        data: lineChartData.peak,
      },
      {
        name: 'Off-peak',
        type: 'line',
        itemStyle: { color: '#52c41a' },
        areaStyle: { opacity: 0.1 },
        data: lineChartData.offPeak,
      },
    ],
  };

  const topUsageOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { top: '15%', left: '3%', right: '4%', bottom: '15%', containLabel: true },
    dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 10, height: 15 }],
    xAxis: {
      type: 'category',
      data: barChartData.tags,
      axisLabel: { interval: 0, rotate: 30 },
    },
    yAxis: {
      type: 'value',
      name: 'kWh',
      splitLine: {
        lineStyle: { type: 'dashed', color: isDarkMode ? '#303030' : '#e8e8e8' },
      },
    },
    series: [
      {
        name: 'Usage',
        type: 'bar',
        barWidth: '30%',
        itemStyle: { color: '#1677ff', borderRadius: [4, 4, 0, 0] },
        data: barChartData.values,
      },
    ],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Card
        styles={{
          body: {
            padding: '10px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          },
        }}
      >
        <Space wrap>
          <span>Energy item</span>
          <Select defaultValue="Electricity" style={{ width: 120 }}>
            <Option value="Electricity">Electricity</Option>
          </Select>
          <span style={{ marginLeft: 16 }}>Interval</span>
          <Select value={intervalWaktu} onChange={setIntervalWaktu} style={{ width: 100 }}>
            <Option value="Day">Day</Option>
            <Option value="Month">Month</Option>
          </Select>
          <span style={{ marginLeft: 16 }}>Time</span>
          <RangePicker value={dateRange} onChange={setDateRange} allowClear={false} />
          <Button type="primary" onClick={fetchTOUData} loading={loading}>
            Search
          </Button>
        </Space>
      </Card>

      <Spin spinning={loading}>
        <Row gutter={16}>
          <Col span={12}>
            <Card title="TOU Electricity" bordered={false}>
              <ReactECharts
                notMerge
                option={touElectricityOption}
                theme={isDarkMode ? 'dark' : 'light'}
                style={{ height: '230px' }}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card title="TOU Cost" bordered={false}>
              <ReactECharts
                notMerge
                option={touCostOption}
                theme={isDarkMode ? 'dark' : 'light'}
                style={{ height: '230px' }}
              />
            </Card>
          </Col>
        </Row>

        <Card title="TOU Period (Trend)" bordered={false} style={{ marginTop: 10 }}>
          <ReactECharts
            notMerge
            option={touLineOption}
            theme={isDarkMode ? 'dark' : 'light'}
            style={{ height: '300px' }}
          />
        </Card>

        <Card title="Top Usage (By Area)" bordered={false} style={{ marginTop: 10 }}>
          <ReactECharts
            notMerge
            option={topUsageOption}
            theme={isDarkMode ? 'dark' : 'light'}
            style={{ height: '250px' }}
          />
        </Card>
      </Spin>
    </div>
  );
}
