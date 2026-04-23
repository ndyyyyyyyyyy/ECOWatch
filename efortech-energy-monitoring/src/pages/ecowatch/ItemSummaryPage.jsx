import React, { useState, useEffect } from 'react';
import { Card, Select, Button, Space, Typography, Progress, Row, Col, Spin, message } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';
import { ENERGY_ENDPOINT } from './ecowatchApi';

const { Option } = Select;
const { Title, Text } = Typography;

export default function ItemSummary() {
  const { isDarkMode, checkedAreaNames } = useOutletContext();

  const [selectedArea, setSelectedArea] = useState('Regional');
  const mainAreas = 'RAC,NR1,NR2,UT_NEW,UTILITY';

  const [topMonthlyData, setTopMonthlyData] = useState(new Array(12).fill(0));
  const [pieData, setPieData] = useState([]);
  const [barDataThisYear, setBarDataThisYear] = useState(new Array(12).fill(0));

  const [thisYearTotal, setThisYearTotal] = useState(0);
  const [lastYearTotal, setLastYearTotal] = useState(0);
  const [realtimeDemand, setRealtimeDemand] = useState(0);

  const [rankingData, setRankingData] = useState([]);

  const [loadingMain, setLoadingMain] = useState(false);
  const [loadingBar, setLoadingBar] = useState(false);

  const buildEnergyUrl = (params = {}, areaNames = []) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, String(value));
      }
    });

    const normalizedAreas = Array.isArray(areaNames)
      ? areaNames.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    if (normalizedAreas.length > 0) {
      query.set('areas', normalizedAreas.join(','));
      query.set('include_descendants', 'true');
    }

    return `${ENERGY_ENDPOINT}?${query.toString()}`;
  };

  const pruneSelectedParents = (rows, selectedAreas = []) => {
    const selectedSet = new Set(
      (selectedAreas || []).map((item) => String(item || '').trim()).filter(Boolean)
    );
    if (selectedSet.size === 0) {
      return rows;
    }
    return rows.filter((item) => {
      const tagName = String(item?.tag_name || '').trim();
      const hasChildren = Array.isArray(item?.children_names) && item.children_names.length > 0;
      return !(selectedSet.has(tagName) && hasChildren);
    });
  };

  const getTargetAreas = () => {
    if (!checkedAreaNames || checkedAreaNames.length === 0) {
      return mainAreas;
    }

    const normalized = checkedAreaNames
      .map((area) => (area || '').trim())
      .filter(Boolean)
      .filter((area) => area !== 'MAIN_ELECTRICAL');

    if (normalized.length === 0) {
      return mainAreas;
    }

    return normalized.join(',');
  };

  const fetchDashboardData = async () => {
    setLoadingMain(true);
    setLoadingBar(true);

    try {
      const currentYear = dayjs().year();
      const lastYear = currentYear - 1;
      const targetAreas = getTargetAreas();
      const selectedAreas = targetAreas.split(',').map((item) => item.trim()).filter(Boolean);

      const thisYearUrl = buildEnergyUrl(
        { interval: 'Month', start: `${currentYear}-01-01`, end: `${currentYear}-12-31` },
        selectedAreas
      );
      const lastYearUrl = buildEnergyUrl(
        { interval: 'Month', start: `${lastYear}-01-01`, end: `${lastYear}-12-31` },
        selectedAreas
      );

      const today = dayjs().format('YYYY-MM-DD');
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
      const todayDemandUrl = buildEnergyUrl(
        { metric: 'power', interval: 'Minute', start: today, end: now },
        selectedAreas
      );

      const [thisYearRes, lastYearRes, todayDemandRes] = await Promise.all([
        axios.get(thisYearUrl),
        axios.get(lastYearUrl),
        axios.get(todayDemandUrl),
      ]);

      const thisYearRaw = pruneSelectedParents(thisYearRes.data || [], selectedAreas);
      const lastYearRaw = pruneSelectedParents(lastYearRes.data || [], selectedAreas);
      const todayDemandRaw = pruneSelectedParents(todayDemandRes.data || [], selectedAreas);

      let totalThisYear = 0;
      const monthlyTotals = new Array(12).fill(0);
      const areaTotals = {};
      const tagTotals = {};

      thisYearRaw.forEach((item) => {
        const val = parseFloat(item.value_kwh || 0);
        totalThisYear += val;

        const monthIndex = parseInt(String(item.timestamp).split('-')[1], 10) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          monthlyTotals[monthIndex] += val;
        }

        areaTotals[item.tag_name] = (areaTotals[item.tag_name] || 0) + val;
        tagTotals[item.tag_name] = (tagTotals[item.tag_name] || 0) + val;
      });

      let totalLastYear = 0;
      lastYearRaw.forEach((item) => {
        totalLastYear += parseFloat(item.value_kwh || 0);
      });

      let currentDemand = 0;
      const latestDemandTimestamp = todayDemandRaw.reduce((latest, item) => {
        const value = parseFloat(item.value_kw ?? item.value ?? 0);
        const timestamp = String(item.timestamp || '');
        if (value <= 0) {
          return latest;
        }
        return timestamp > latest ? timestamp : latest;
      }, '');
      todayDemandRaw.forEach((item) => {
        if (String(item.timestamp || '') !== latestDemandTimestamp) {
          return;
        }
        currentDemand += parseFloat(item.value_kw ?? item.value ?? 0);
      });

      setThisYearTotal(totalThisYear);
      setLastYearTotal(totalLastYear);
      setRealtimeDemand(currentDemand);

      setTopMonthlyData(monthlyTotals);
      setBarDataThisYear(monthlyTotals);
      setSelectedArea(targetAreas === mainAreas ? 'Regional' : checkedAreaNames?.[0] || 'Regional');

      const formattedPieData = Object.keys(areaTotals)
        .map((key) => ({ name: key, value: areaTotals[key] }))
        .filter((item) => item.value > 0);
      setPieData(formattedPieData);

      const sortedTags = Object.entries(tagTotals).sort((a, b) => b[1] - a[1]).slice(0, 8);
      const maxRankingVal = sortedTags.length > 0 ? sortedTags[0][1] : 1;

      const formattedRanking = sortedTags.map((tag, index) => ({
        name: `${index + 1}. ${tag[0]}`,
        value: tag[1],
        percent: (tag[1] / maxRankingVal) * 100,
      }));
      setRankingData(formattedRanking);
    } catch (error) {
      console.error('Failed to fetch main data:', error);
      message.error('Failed to load data from server');
    } finally {
      setLoadingMain(false);
      setLoadingBar(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [checkedAreaNames]);

  const handlePieClick = async (params) => {
    const areaName = params.name;
    setSelectedArea(areaName);
    setLoadingBar(true);

    try {
      const currentYear = dayjs().year();
      const url = buildEnergyUrl(
        { interval: 'Month', start: `${currentYear}-01-01`, end: `${currentYear}-12-31` },
        [areaName]
      );
      const res = await axios.get(url);
      const rawData = pruneSelectedParents(res.data || [], [areaName]);

      const monthlyValues = new Array(12).fill(0);
      rawData.forEach((item) => {
        const monthIndex = parseInt(String(item.timestamp).split('-')[1], 10) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          monthlyValues[monthIndex] += parseFloat(item.value_kwh || 0);
        }
      });
      setBarDataThisYear(monthlyValues);
    } catch (error) {
      message.error('Failed to load area details');
    } finally {
      setLoadingBar(false);
    }
  };

  const onEvents = {
    click: handlePieClick,
  };

  const yoyDeviation = thisYearTotal - lastYearTotal;
  const isYoYPositive = yoyDeviation > 0;

  const formatPower = (value) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)} GWh`;
    if (value >= 1000) return `${(value / 1000).toFixed(2)} MWh`;
    return `${value.toFixed(2)} kWh`;
  };

  const round2 = (value) => Number(Number(value || 0).toFixed(2));

  const maxTop = Math.max(...topMonthlyData);
  const targetTop = maxTop > 0 ? Math.round(maxTop * 0.9) : 1000;
  const lastYearTop = topMonthlyData.map((value) => (value > 0 ? Math.round(value * 0.85) : 0));

  const monthlyUsageOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) => formatPower(Number(value || 0)),
    },
    legend: {
      bottom: 0,
      data: ['This year', 'Last year', 'Target usage'],
      textStyle: { color: isDarkMode ? '#d9d9d9' : '#595959' },
    },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
      axisLabel: { color: isDarkMode ? '#d9d9d9' : '#595959' },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: isDarkMode ? '#d9d9d9' : '#595959',
        formatter: (value) => (value >= 1000 ? `${value / 1000}K` : value),
      },
      splitLine: { lineStyle: { type: 'dashed', color: isDarkMode ? '#303030' : '#e8e8e8' } },
    },
    series: [
      { name: 'This year', type: 'bar', itemStyle: { color: '#1890ff' }, data: topMonthlyData.map(round2) },
      { name: 'Last year', type: 'bar', itemStyle: { color: isDarkMode ? '#172b4d' : '#e6f4ff' }, data: lastYearTop.map(round2) },
      {
        name: 'Target usage',
        type: 'line',
        smooth: true,
        lineStyle: { width: 3, type: 'dashed', color: '#ff4d4f' },
        symbol: 'circle',
        itemStyle: { color: '#ff4d4f' },
        data: new Array(12).fill(round2(targetTop)),
      },
    ],
  };

  const maxBar = Math.max(...barDataThisYear);
  const targetBar = maxBar > 0 ? Math.round(maxBar * 0.9) : 450;
  const lastYearBar = barDataThisYear.map((value) => (value > 0 ? Math.round(value * 0.85) : 0));

  const areaMonthlyOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) => formatPower(Number(value || 0)),
    },
    legend: { bottom: 0, textStyle: { color: isDarkMode ? '#d9d9d9' : '#595959' } },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
      axisLabel: { color: isDarkMode ? '#d9d9d9' : '#595959' },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: isDarkMode ? '#d9d9d9' : '#595959',
        formatter: (value) => (value >= 1000 ? `${value / 1000}K` : value),
      },
      splitLine: { lineStyle: { type: 'dashed', color: isDarkMode ? '#303030' : '#e8e8e8' } },
    },
    series: [
      { name: 'This year', type: 'bar', itemStyle: { color: '#1890ff' }, data: barDataThisYear.map(round2) },
      { name: 'Last year', type: 'bar', itemStyle: { color: isDarkMode ? '#172b4d' : '#e6f4ff' }, data: lastYearBar.map(round2) },
      {
        name: 'Target usage',
        type: 'line',
        smooth: true,
        lineStyle: { width: 3, type: 'dashed', color: '#ff4d4f' },
        symbol: 'circle',
        itemStyle: { color: '#ff4d4f' },
        data: new Array(12).fill(round2(targetBar)),
      },
    ],
  };

  const regionalUsageOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (params) => `${params.name} : ${formatPower(Number(params.value || 0))} (${params.percent}%)`,
    },
    series: [
      {
        type: 'pie',
        cursor: 'pointer',
        radius: ['45%', '65%'],
        itemStyle: {
          borderRadius: 4,
          borderColor: isDarkMode ? '#141414' : '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          position: 'outside',
          formatter: '{b}\n{d}%',
          fontWeight: 'bold',
          color: isDarkMode ? '#d9d9d9' : '#595959',
        },
        data: pieData.length > 0 ? pieData : [{ name: 'No Data', value: 0 }],
      },
    ],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Card styles={{ body: { padding: '10px 24px' } }}>
        <Space wrap>
          <span>Area</span>
          <Select defaultValue="MAIN_ELECTRICAL" style={{ width: 180 }} disabled>
            <Option value="MAIN_ELECTRICAL">MAIN_ELECTRICAL</Option>
          </Select>
          <span style={{ marginLeft: 16 }}>Interval</span>
          <Select defaultValue="This year" style={{ width: 120 }}>
            <Option value="This year">This year</Option>
          </Select>
          <Button type="primary" onClick={fetchDashboardData} loading={loadingMain}>
            Refresh
          </Button>
        </Space>
      </Card>

      <Spin spinning={loadingMain}>
        <Row gutter={[10, 10]}>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false}>
              <Text type="secondary">This year usage</Text>
              <Title level={3} style={{ margin: 0 }}>
                {formatPower(thisYearTotal)}
              </Title>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false}>
              <Text type="secondary">Last year usage</Text>
              <Title level={3} style={{ margin: 0 }}>
                {formatPower(lastYearTotal)}
              </Title>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false}>
              <Text type="secondary">YoY deviation</Text>
              <Title level={3} style={{ margin: 0, color: isYoYPositive ? '#ff4d4f' : '#52c41a' }}>
                {isYoYPositive ? '+' : ''}
                {formatPower(yoyDeviation)}
              </Title>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false}>
              <Text type="secondary">Real-time demand</Text>
              <Title level={3} style={{ margin: 0 }}>
                {realtimeDemand.toFixed(2)} kW
              </Title>
            </Card>
          </Col>
        </Row>

        <Row gutter={[10, 10]} align="stretch" style={{ marginTop: 10 }}>
          <Col xs={24} lg={16}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
              <Card title="Monthly Usage" bordered={false}>
                <ReactECharts notMerge={true} option={monthlyUsageOption} theme={isDarkMode ? 'dark' : 'light'} style={{ height: '200px' }} />
              </Card>

              <Row gutter={[10, 10]}>
                <Col xs={24} md={12}>
                  <Card title="Regional Usage" bordered={false}>
                    <ReactECharts
                      notMerge={true}
                      option={regionalUsageOption}
                      theme={isDarkMode ? 'dark' : 'light'}
                      onEvents={onEvents}
                      style={{ height: '200px' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Spin spinning={loadingBar}>
                    <Card title={`${selectedArea === 'Regional' ? 'Overall' : selectedArea} Monthly Usage`} bordered={false}>
                      <ReactECharts notMerge={true} option={areaMonthlyOption} theme={isDarkMode ? 'dark' : 'light'} style={{ height: '200px' }} />
                    </Card>
                  </Spin>
                </Col>
              </Row>
            </div>
          </Col>

          <Col xs={24} lg={8}>
            <Card title="Equipment Usage Ranking" bordered={false} style={{ height: '100%' }}>
              {rankingData.length > 0 ? (
                rankingData.map((item, index) => (
                  <div key={index} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: '13px', fontWeight: 500 }} ellipsis>
                        {item.name}
                      </Text>
                      <Text style={{ fontSize: '13px', flexShrink: 0, paddingLeft: 8 }}>{formatPower(item.value)}</Text>
                    </div>
                    <Progress percent={item.percent} showInfo={false} strokeColor="#1890ff" size="small" />
                  </div>
                ))
              ) : (
                <Text type="secondary">No data available for ranking</Text>
              )}
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}
