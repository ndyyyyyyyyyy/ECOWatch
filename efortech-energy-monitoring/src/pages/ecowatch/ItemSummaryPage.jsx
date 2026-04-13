import React, { useState, useEffect } from 'react';
import { Card, Select, Button, Space, Typography, Progress, Row, Col, Spin, message } from 'antd';
import ReactECharts from 'echarts-for-react';
import axios from 'axios';
import dayjs from 'dayjs';
import { useOutletContext } from 'react-router-dom';
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
      const today = dayjs().format('YYYY-MM-DD');

      const [thisYearRes, lastYearRes, todayRes] = await Promise.all([
        axios.get(`${ENERGY_ENDPOINT}?interval=Month&start=${currentYear}-01-01&end=${currentYear}-12-31&areas=${targetAreas}`),
        axios.get(`${ENERGY_ENDPOINT}?interval=Month&start=${lastYear}-01-01&end=${lastYear}-12-31&areas=${targetAreas}`),
        axios.get(`${ENERGY_ENDPOINT}?interval=Day&start=${today}&end=${today}&areas=${targetAreas}`),
      ]);

      const thisYearRaw = thisYearRes.data || [];
      const lastYearRaw = lastYearRes.data || [];
      const todayRaw = todayRes.data || [];

      let totalThisYear = 0;
      const monthlyTotals = new Array(12).fill(0);
      const areaTotals = {};
      const tagTotals = {};

      thisYearRaw.forEach((item) => {
        const val = parseFloat(item.value_kwh);
        totalThisYear += val;

        const monthIndex = parseInt(item.timestamp.split('-')[1], 10) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          monthlyTotals[monthIndex] += val;
        }

        areaTotals[item.tag_name] = (areaTotals[item.tag_name] || 0) + val;
        tagTotals[item.tag_name] = (tagTotals[item.tag_name] || 0) + val;
      });

      let totalLastYear = 0;
      lastYearRaw.forEach((item) => {
        totalLastYear += parseFloat(item.value_kwh);
      });

      let currentDemand = 0;
      todayRaw.forEach((item) => {
        currentDemand += parseFloat(item.value_kwh);
      });

      setThisYearTotal(totalThisYear);
      setLastYearTotal(totalLastYear);
      setRealtimeDemand(currentDemand);
      setTopMonthlyData(monthlyTotals);
      setBarDataThisYear(monthlyTotals);
      setSelectedArea(targetAreas === mainAreas ? 'Regional' : checkedAreaNames[0] || 'Regional');

      setPieData(
        Object.keys(areaTotals)
          .map((key) => ({ name: key, value: areaTotals[key] }))
          .filter((item) => item.value > 0)
      );

      const sortedTags = Object.entries(tagTotals).sort((a, b) => b[1] - a[1]).slice(0, 8);
      const maxRankingVal = sortedTags.length > 0 ? sortedTags[0][1] : 1;
      setRankingData(
        sortedTags.map((tag, index) => ({
          name: `${index + 1}. ${tag[0]}`,
          value: tag[1],
          percent: (tag[1] / maxRankingVal) * 100,
        }))
      );
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
      const res = await axios.get(
        `${ENERGY_ENDPOINT}?interval=Month&start=${currentYear}-01-01&end=${currentYear}-12-31&areas=${areaName}`
      );
      const rawData = res.data || [];
      const monthlyValues = new Array(12).fill(0);

      rawData.forEach((item) => {
        const monthIndex = parseInt(item.timestamp.split('-')[1], 10) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          monthlyValues[monthIndex] += parseFloat(item.value_kwh);
        }
      });

      setBarDataThisYear(monthlyValues);
    } catch (error) {
      message.error('Failed to load area details');
    } finally {
      setLoadingBar(false);
    }
  };

  const onEvents = { click: handlePieClick };
  const yoyDeviation = thisYearTotal - lastYearTotal;
  const isYoYPositive = yoyDeviation > 0;

  const formatPower = (value) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)} GWh`;
    if (value >= 1000) return `${(value / 1000).toFixed(2)} MWh`;
    return `${value.toFixed(2)} kWh`;
  };

  const maxTop = Math.max(...topMonthlyData);
  const targetTop = maxTop > 0 ? Math.round(maxTop * 0.9) : 1000;
  const lastYearTop = topMonthlyData.map((value) => (value > 0 ? Math.round(value * 0.85) : 0));

  const monthlyUsageOption = {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, data: ['This year', 'Last year', 'Target usage'], textStyle: { color: isDarkMode ? '#d9d9d9' : '#595959' } },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '3%', containLabel: true },
    xAxis: { type: 'category', data: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'] },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: (value) => (value >= 1000 ? `${value / 1000}K` : value) },
      splitLine: { lineStyle: { type: 'dashed', color: isDarkMode ? '#303030' : '#e8e8e8' } },
    },
    series: [
      { name: 'This year', type: 'bar', itemStyle: { color: '#1890ff' }, data: topMonthlyData },
      { name: 'Last year', type: 'bar', itemStyle: { color: isDarkMode ? '#172b4d' : '#e6f4ff' }, data: lastYearTop },
      { name: 'Target usage', type: 'line', smooth: true, lineStyle: { width: 3, type: 'dashed', color: '#ff4d4f' }, symbol: 'circle', itemStyle: { color: '#ff4d4f' }, data: new Array(12).fill(targetTop) },
    ],
  };

  const maxBar = Math.max(...barDataThisYear);
  const targetBar = maxBar > 0 ? Math.round(maxBar * 0.9) : 450;
  const lastYearBar = barDataThisYear.map((value) => (value > 0 ? Math.round(value * 0.85) : 0));

  const areaMonthlyOption = {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, textStyle: { color: isDarkMode ? '#d9d9d9' : '#595959' } },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '3%', containLabel: true },
    xAxis: { type: 'category', data: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'] },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: (value) => (value >= 1000 ? `${value / 1000}K` : value) },
      splitLine: { lineStyle: { type: 'dashed', color: isDarkMode ? '#303030' : '#e8e8e8' } },
    },
    series: [
      { name: 'This year', type: 'bar', itemStyle: { color: '#1890ff' }, data: barDataThisYear },
      { name: 'Last year', type: 'bar', itemStyle: { color: isDarkMode ? '#172b4d' : '#e6f4ff' }, data: lastYearBar },
      { name: 'Target usage', type: 'line', smooth: true, lineStyle: { width: 3, type: 'dashed', color: '#ff4d4f' }, symbol: 'circle', itemStyle: { color: '#ff4d4f' }, data: new Array(12).fill(targetBar) },
    ],
  };

  const regionalUsageOption = {
    tooltip: { trigger: 'item', formatter: '{b} : {c} kWh ({d}%)' },
    series: [
      {
        type: 'pie',
        cursor: 'pointer',
        radius: ['45%', '65%'],
        itemStyle: { borderRadius: 4, borderColor: isDarkMode ? '#141414' : '#fff', borderWidth: 2 },
        label: { show: true, position: 'outside', formatter: '{b}\n{d}%', fontWeight: 'bold' },
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
          <Button type="primary" onClick={fetchDashboardData} loading={loadingMain}>Refresh</Button>
        </Space>
      </Card>

      <Spin spinning={loadingMain}>
        <Row gutter={[10, 10]}>
          <Col xs={24} sm={12} lg={6}><Card bordered={false}><Text type="secondary">This year usage</Text><Title level={3} style={{ margin: 0 }}>{formatPower(thisYearTotal)}</Title></Card></Col>
          <Col xs={24} sm={12} lg={6}><Card bordered={false}><Text type="secondary">Last year usage</Text><Title level={3} style={{ margin: 0 }}>{formatPower(lastYearTotal)}</Title></Card></Col>
          <Col xs={24} sm={12} lg={6}><Card bordered={false}><Text type="secondary">YoY deviation</Text><Title level={3} style={{ margin: 0, color: isYoYPositive ? '#ff4d4f' : '#52c41a' }}>{isYoYPositive ? '+' : ''}{formatPower(yoyDeviation)}</Title></Card></Col>
          <Col xs={24} sm={12} lg={6}><Card bordered={false}><Text type="secondary">Real-time demand</Text><Title level={3} style={{ margin: 0 }}>{realtimeDemand.toFixed(2)} kW</Title></Card></Col>
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
                    <ReactECharts notMerge={true} option={regionalUsageOption} theme={isDarkMode ? 'dark' : 'light'} onEvents={onEvents} style={{ height: '200px' }} />
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
              {rankingData.length > 0 ? rankingData.map((item, index) => (
                <div key={index} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: '13px', fontWeight: 500 }} ellipsis={true}>{item.name}</Text>
                    <Text style={{ fontSize: '13px', flexShrink: 0, paddingLeft: 8 }}>{formatPower(item.value)}</Text>
                  </div>
                  <Progress percent={item.percent} showInfo={false} strokeColor="#1890ff" size="small" />
                </div>
              )) : (
                <Text type="secondary">No data available for ranking</Text>
              )}
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}
