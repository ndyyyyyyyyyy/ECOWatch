import React, { useState, useEffect } from 'react';
import { Card, Select, DatePicker, Button, Space, Row, Col, message, Spin, Segmented, ConfigProvider } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';
import { RefreshCw, Download, BarChart2, LineChart } from 'lucide-react';
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
  const [topChartType, setTopChartType] = useState('bar');

  const formatEnergy = (value) => {
    const numericValue = Number(value || 0);
    if (numericValue >= 1000000) return `${(numericValue / 1000000).toFixed(2)} GWh`;
    if (numericValue >= 1000) return `${(numericValue / 1000).toFixed(2)} MWh`;
    return `${numericValue.toFixed(2)} kWh`;
  };

  const formatAxisEnergy = (value) => {
    const numericValue = Number(value || 0);
    if (numericValue >= 1000000) return `${(numericValue / 1000000).toFixed(2)}G`;
    if (numericValue >= 1000) return `${(numericValue / 1000).toFixed(2)}M`;
    return numericValue.toFixed(2);
  };

  const round2 = (value) => Number(Number(value || 0).toFixed(2));

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
          : 'Office';

      const backendInterval = intervalWaktu === 'Month' ? 'Day' : 'Hour';
      const url = `${ENERGY_ENDPOINT}?interval=${backendInterval}&start=${start}&end=${end}&areas=${targetAreas}`;
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
        peak: sortedDates.map((date) => round2(timeSeriesMap[date].peak)),
        offPeak: sortedDates.map((date) => round2(timeSeriesMap[date].offPeak)),
      });

      const sortedTags = Object.entries(tagUsageMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30);

      setBarChartData({
        tags: sortedTags.map((tag) => tag[0]),
        values: sortedTags.map((tag) => round2(tag[1])),
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

  const handleExportTrendCsv = () => {
    if (!lineChartData.dates || lineChartData.dates.length === 0) {
      message.warning('No data to export!');
      return;
    }

    const headers = ['Date/Time', 'On-peak (kWh)', 'Off-peak (kWh)'];
    const rows = lineChartData.dates.map(
      (date, index) => `${date},${lineChartData.peak[index]},${lineChartData.offPeak[index]}`
    );
    const csvContent = `data:text/csv;charset=utf-8,${headers.join(',')}\n${rows.join('\n')}`;
    const encodedUri = encodeURI(csvContent);

    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TOU_Trend_${dayjs().format('YYYYMMDD_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    message.success('TOU Trend data exported successfully!');
  };

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
    tooltip: {
      trigger: 'item',
      formatter: (params) => `${params.name}: ${formatEnergy(params.value)} (${params.percent}%)`,
    },
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
            value: round2(summaryData.peakKwh),
            name: `On-peak (${peakPct}%)`,
            itemStyle: { color: '#faad14' },
          },
          {
            value: round2(summaryData.offPeakKwh),
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
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) => formatEnergy(value),
    },
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
      nameTextStyle: { color: isDarkMode ? '#d9d9d9' : '#595959' },
      axisLabel: {
        color: isDarkMode ? '#d9d9d9' : '#595959',
        formatter: (value) => formatAxisEnergy(value),
      },
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
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (value) => formatEnergy(value),
    },
    grid: { top: '15%', left: '3%', right: '4%', bottom: '15%', containLabel: true },
    dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 10, height: 15 }],
    xAxis: {
      type: 'category',
      data: barChartData.tags,
      axisLabel: { interval: 0, rotate: 30, color: isDarkMode ? '#d9d9d9' : '#595959' },
    },
    yAxis: {
      type: 'value',
      name: 'kWh',
      nameTextStyle: { color: isDarkMode ? '#d9d9d9' : '#595959' },
      axisLabel: {
        color: isDarkMode ? '#d9d9d9' : '#595959',
        formatter: (value) => formatAxisEnergy(value),
      },
      splitLine: {
        lineStyle: { type: 'dashed', color: isDarkMode ? '#303030' : '#e8e8e8' },
      },
    },
    series: [
      {
        name: 'Usage',
        type: topChartType,
        barWidth: '30%',
        smooth: true,
        itemStyle: {
          color: '#1677ff',
          borderRadius: topChartType === 'bar' ? [4, 4, 0, 0] : 0,
        },
        areaStyle: topChartType === 'line' ? { color: '#1677ff', opacity: 0.1 } : null,
        data: barChartData.values,
      },
    ],
  };

  const segmentedTheme = {
    components: {
      Segmented: {
        itemSelectedBg: isDarkMode ? '#112a45' : '#e6f4ff',
        itemSelectedColor: isDarkMode ? '#69c0ff' : '#1677ff',
        itemColor: isDarkMode ? '#a6a6a6' : '#8c8c8c',
        trackBg: isDarkMode ? '#141414' : '#ffffff',
        trackPadding: 2,
      },
    },
  };

  const trendControls = (
    <Space size="small">
      <Button
        type="text"
        icon={<RefreshCw size={18} />}
        loading={loading}
        onClick={fetchTOUData}
        style={{ color: isDarkMode ? '#a6a6a6' : '#8c8c8c' }}
        title="Refresh Data"
      />
      <Button
        type="text"
        icon={<Download size={18} />}
        onClick={handleExportTrendCsv}
        style={{ color: isDarkMode ? '#a6a6a6' : '#8c8c8c' }}
        title="Download CSV"
      />
    </Space>
  );

  const topUsageControls = (
    <Space size="middle" wrap align="center">
      <ConfigProvider theme={segmentedTheme}>
        <Segmented
          options={[
            { value: 'bar', icon: <BarChart2 size={18} style={{ verticalAlign: 'middle', marginTop: 4 }} /> },
            { value: 'line', icon: <LineChart size={18} style={{ verticalAlign: 'middle', marginTop: 4 }} /> },
          ]}
          value={topChartType}
          onChange={setTopChartType}
          style={{ backgroundColor: 'transparent', border: isDarkMode ? '1px solid #303030' : '1px solid #d9d9d9' }}
        />
      </ConfigProvider>

      <Button
        type="text"
        icon={<RefreshCw size={18} />}
        loading={loading}
        onClick={fetchTOUData}
        style={{
          color: isDarkMode ? '#a6a6a6' : '#8c8c8c',
          display: 'flex',
          justifyContent: 'center',
          marginTop: '2px',
        }}
        title="Refresh Data"
      />
    </Space>
  );

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

        <Card title="TOU Period (Trend)" bordered={false} extra={trendControls} style={{ marginTop: 10 }}>
          <ReactECharts
            notMerge
            option={touLineOption}
            theme={isDarkMode ? 'dark' : 'light'}
            style={{ height: '300px' }}
          />
        </Card>

        <Card title="Top Usage (By Area)" bordered={false} extra={topUsageControls} style={{ marginTop: 10 }}>
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
