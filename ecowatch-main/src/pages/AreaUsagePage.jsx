import React, { useState, useEffect, useMemo } from "react";
import { Card, Select, DatePicker, Button, Space, message, Spin } from "antd";
import { DotLoader } from "react-spinners";
import ReactECharts from "echarts-for-react";
import { useOutletContext } from "react-router-dom";
import axios from "axios";
import { RefreshCw } from "lucide-react";
import "../style/AreaUsage.css";

const { Option } = Select;
const { RangePicker } = DatePicker;

export default function AreaUsagePage() {
  const { isDarkMode, checkedAreaNames } = useOutletContext();

  const [intervalWaktu, setIntervalWaktu] = useState(() => {
    return sessionStorage.getItem("savedInterval") || "Hour";
  });
  const [dateRange, setDateRange] = useState(null);
  const [chartData, setChartData] = useState([]);
  
  const [loading, setLoading] = useState(false);

  const fetchData = () => {
    setLoading(true);

    let url = `http://localhost:5000/energy?interval=${intervalWaktu}`;

    if (dateRange && dateRange.length === 2) {
      const startDate = dateRange[0].format("YYYY-MM-DD");
      const endDate = dateRange[1].format("YYYY-MM-DD");
      url += `&start=${startDate}&end=${endDate}`;
    }

    if (checkedAreaNames && checkedAreaNames.length > 0) {
      url += `&areas=${checkedAreaNames.join(",")}`;
    }

    sessionStorage.setItem("savedInterval", intervalWaktu);

    axios.get(url)
      .then(res => {
        const dataArray = Array.isArray(res.data) ? res.data : (res.data.data || []);
        setChartData(dataArray);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error mengambil data:", err);
        message.error("Gagal mengambil data dari server");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, [checkedAreaNames]);

  const areaUsageOption = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return {
        title: { 
          text: "Tidak ada data untuk area yang dicentang / Data Kosong", 
          left: "center", top: "center",
          textStyle: { color: isDarkMode ? '#d9d9d9' : '#888', fontWeight: 'normal', fontSize: 14 }
        },
        series: [] 
      };
    }

    const xAxisData = [...new Set(chartData.map(d => d.timestamp))].sort();
    const tags = [...new Set(chartData.map(d => d.tag_name))];

    const dataMap = {};
    chartData.forEach(d => {
      if (!dataMap[d.tag_name]) dataMap[d.tag_name] = {};
      dataMap[d.tag_name][d.timestamp] = d.value_kwh;
    });

    const series = tags.map(tag => ({
      name: tag,
      type: "bar",
      stack: "Total",
      emphasis: { focus: "series" },
      data: xAxisData.map(time => {
        return dataMap[tag]?.[time] || 0;
      })
    }));

    return {
      tooltip: { trigger: "axis" },
      legend: { bottom: 0, type: "scroll", textStyle: { color: isDarkMode ? "#d9d9d9" : "#595959" } },
      grid: { top: "5%", left: "3%", right: "4%", bottom: "80px", containLabel: true },
      dataZoom: [{ type: "slider", bottom: 35, height: 15 }, { type: "inside" }],
      xAxis: { 
        type: "category", 
        data: xAxisData, 
        axisLabel: { color: isDarkMode ? "#d9d9d9" : "#595959" } 
      },
      yAxis: { 
        type: "value", 
        name: "kWh",
        nameTextStyle: { color: isDarkMode ? "#d9d9d9" : "#595959" },
        axisLabel: { color: isDarkMode ? "#d9d9d9" : "#595959" },
        splitLine: { lineStyle: { color: isDarkMode ? "#303030" : "#e8e8e8", type: "dashed" } } 
      },
      series: series
    };
  }, [chartData, isDarkMode]);

  const refreshButton = (
    <Button 
      type="text" 
      icon={<RefreshCw size={16} />}
      loading={loading} 
      onClick={fetchData}
      style={{ color: isDarkMode ? '#a6a6a6' : '#8c8c8c' }}
    />
  );

  return (
    <div className="area-usage-container">
      <Card styles={{ body: { padding: "10px 24px", overflowX: "auto" } }} className="full-width-card">
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

      <Card 
        title="Area Usage" 
        variant="borderless" 
        className="full-width-card" 
        style={{ marginTop: '5px' }}
        extra={refreshButton}
      >
        <Spin 
          spinning={loading} 
          indicator={<DotLoader color="#1890ff" size={40} />}
        >
          <ReactECharts 
            option={areaUsageOption} 
            notMerge={true} 
            theme={isDarkMode ? "dark" : "light"} 
            style={{ height: "620px", width: "100%" }} 
          />
        </Spin>
      </Card>
    </div>
  );
}
