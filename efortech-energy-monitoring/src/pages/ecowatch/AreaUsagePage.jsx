import React, { useState, useEffect, useMemo } from "react";
import { Card, Select, DatePicker, Button, Space, message, Spin, Segmented, ConfigProvider, Divider } from "antd";
import { DotLoader } from "react-spinners";
import ReactECharts from "echarts-for-react";
import { useOutletContext } from "react-router-dom";
import axios from "axios";
import { RefreshCw, Download, BarChart2, LineChart } from "lucide-react";
import dayjs from "dayjs";
import "./AreaUsage.css";
import { ENERGY_ENDPOINT } from "./ecowatchApi";

const { Option } = Select;
const { RangePicker } = DatePicker;

export default function AreaUsagePage() {
  const { isDarkMode, checkedAreaNames } = useOutletContext();

  const [intervalWaktu, setIntervalWaktu] = useState(() => {
    return sessionStorage.getItem("savedInterval") || "Day";
  });
  const [dateRange, setDateRange] = useState(() => {
    const savedStart = sessionStorage.getItem("savedAreaUsageStart");
    const savedEnd = sessionStorage.getItem("savedAreaUsageEnd");
    if (savedStart && savedEnd) {
      return [dayjs(savedStart), dayjs(savedEnd)];
    }
    return [dayjs().startOf("month"), dayjs().endOf("month")];
  });
  const [chartData, setChartData] = useState([]);
  const [compChartData, setCompChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState("bar");
  const [comparisonMode, setComparisonMode] = useState("Target energy");

  const fetchData = async () => {
    setLoading(true);

    try {
      let url = `${ENERGY_ENDPOINT}?interval=${intervalWaktu}`;
      let compUrl = `${ENERGY_ENDPOINT}?interval=${intervalWaktu}`;

      if (dateRange && dateRange[0] && dateRange[1]) {
        const startDate = dateRange[0].format("YYYY-MM-DD");
        const endDate = dateRange[1].format("YYYY-MM-DD");
        url += `&start=${startDate}&end=${endDate}`;

        sessionStorage.setItem("savedAreaUsageStart", startDate);
        sessionStorage.setItem("savedAreaUsageEnd", endDate);

        if (comparisonMode === "YoY") {
          compUrl += `&start=${dateRange[0].subtract(1, "year").format("YYYY-MM-DD")}&end=${dateRange[1]
            .subtract(1, "year")
            .format("YYYY-MM-DD")}`;
        } else if (comparisonMode === "MoM") {
          compUrl += `&start=${dateRange[0].subtract(1, "month").format("YYYY-MM-DD")}&end=${dateRange[1]
            .subtract(1, "month")
            .format("YYYY-MM-DD")}`;
        }
      }

      if (checkedAreaNames && checkedAreaNames.length > 0) {
        const areaStr = checkedAreaNames.join(",");
        url += `&areas=${areaStr}`;
        compUrl += `&areas=${areaStr}`;
      }

      sessionStorage.setItem("savedInterval", intervalWaktu);

      const res = await axios.get(url);
      const dataArray = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setChartData(dataArray);

      if (comparisonMode !== "Target energy") {
        const compRes = await axios.get(compUrl);
        const compArray = Array.isArray(compRes.data) ? compRes.data : (compRes.data.data || []);
        setCompChartData(compArray);
      } else {
        setCompChartData([]);
      }
    } catch (err) {
      console.error("Error to fetch data:", err);
      message.error("Failed to fetch data from server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [checkedAreaNames, comparisonMode]);

  const handleExportCsv = () => {
    if (!chartData || chartData.length === 0) {
      message.warning("No data to export");
      return;
    }

    const headers = ["Timestamp", "Area/Tag Name", "Value (kWh)"];
    const rows = chartData.map((item) => `${item.timestamp},${item.tag_name},${item.value_kwh}`);
    const csvContent = `data:text/csv;charset=utf-8,${headers.join(",")}\n${rows.join("\n")}`;
    const encodedUri = encodeURI(csvContent);

    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AreaUsage_${dayjs().format("YYYYMMDD_HHmm")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    message.success("CSV exported");
  };

  const areaUsageOption = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return {
        backgroundColor: "transparent",
        tooltip: { trigger: "axis" },
        legend: { bottom: 0, type: "scroll", textStyle: { color: isDarkMode ? "#d9d9d9" : "#595959" } },
        grid: { top: "5%", left: "3%", right: "4%", bottom: "80px", containLabel: true },
        title: {
          text: "No data available for selected areas / Empty data",
          left: "center",
          top: "center",
          textStyle: { color: isDarkMode ? "#d9d9d9" : "#888", fontWeight: "normal", fontSize: 14 },
        },
        series: [],
      };
    }

    const xAxisData = [...new Set(chartData.map((d) => d.timestamp))].sort();
    const tags = [...new Set(chartData.map((d) => d.tag_name))];

    const dataMap = {};
    chartData.forEach((d) => {
      if (!dataMap[d.tag_name]) {
        dataMap[d.tag_name] = {};
      }
      dataMap[d.tag_name][d.timestamp] = d.value_kwh;
    });

    const compDataMap = {};
    if (comparisonMode !== "Target energy" && compChartData.length > 0) {
      compChartData.forEach((d) => {
        if (!compDataMap[d.tag_name]) {
          compDataMap[d.tag_name] = [];
        }
        compDataMap[d.tag_name].push(d.value_kwh);
      });
    }

    const series = [];
    tags.forEach((tag) => {
      series.push({
        name: tag,
        type: chartType,
        stack: chartType === "bar" ? "Total" : null,
        emphasis: { focus: "series" },
        smooth: true,
        data: xAxisData.map((time) => dataMap[tag]?.[time] || 0),
      });

      if (comparisonMode !== "Target energy") {
        series.push({
          name: `${tag} (${comparisonMode})`,
          type: chartType,
          stack: chartType === "bar" ? "CompTotal" : null,
          smooth: true,
          lineStyle: { type: "dashed", width: 2 },
          itemStyle: { opacity: 0.6, borderType: "dashed" },
          data: xAxisData.map((_, index) => compDataMap[tag]?.[index] || 0),
        });
      }
    });

    return {
      tooltip: { trigger: "axis" },
      legend: { bottom: 0, type: "scroll", textStyle: { color: isDarkMode ? "#d9d9d9" : "#595959" } },
      grid: { top: "5%", left: "3%", right: "4%", bottom: "80px", containLabel: true },
      dataZoom: [{ type: "slider", bottom: 35, height: 15 }, { type: "inside" }],
      xAxis: {
        type: "category",
        data: xAxisData,
        axisLabel: { color: isDarkMode ? "#d9d9d9" : "#595959" },
      },
      yAxis: {
        type: "value",
        name: "kWh",
        nameTextStyle: { color: isDarkMode ? "#d9d9d9" : "#595959" },
        axisLabel: { color: isDarkMode ? "#d9d9d9" : "#595959" },
        splitLine: { lineStyle: { color: isDarkMode ? "#303030" : "#e8e8e8", type: "dashed" } },
      },
      series,
    };
  }, [chartData, compChartData, isDarkMode, chartType, comparisonMode]);

  const dashboardControlTheme = {
    components: {
      Segmented: {
        itemSelectedBg: isDarkMode ? "#112a45" : "#e6f4ff",
        itemSelectedColor: isDarkMode ? "#69c0ff" : "#1677ff",
        itemColor: isDarkMode ? "#a6a6a6" : "#8c8c8c",
        trackBg: isDarkMode ? "#141414" : "#ffffff",
        trackPadding: 2,
      },
    },
  };

  const extraControls = (
    <Space size="middle" wrap align="center">
      <ConfigProvider theme={dashboardControlTheme}>
        <Segmented
          options={["Target energy", "YoY", "MoM"]}
          value={comparisonMode}
          onChange={setComparisonMode}
          style={{ border: isDarkMode ? "1px solid #303030" : "1px solid #d9d9d9" }}
        />

        <Divider type="vertical" style={{ height: "20px", margin: "0 4px", borderColor: isDarkMode ? "#303030" : "#d9d9d9" }} />

        <Segmented
          options={[
            { value: "line", icon: <LineChart size={18} style={{ verticalAlign: "middle", marginTop: 4 }} /> },
            { value: "bar", icon: <BarChart2 size={18} style={{ verticalAlign: "middle", marginTop: 4 }} /> },
          ]}
          value={chartType}
          onChange={setChartType}
          style={{ backgroundColor: "transparent" }}
        />
      </ConfigProvider>

      <Space size="small">
        <Button
          type="text"
          icon={<RefreshCw size={18} />}
          loading={loading}
          onClick={fetchData}
          style={{ color: isDarkMode ? "#a6a6a6" : "#8c8c8c" }}
          title="Refresh Data"
        />
        <Button
          type="text"
          icon={<Download size={18} />}
          onClick={handleExportCsv}
          style={{ color: isDarkMode ? "#a6a6a6" : "#8c8c8c" }}
          title="Download CSV"
        />
      </Space>
    </Space>
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
            <RangePicker
              className="picker-time"
              value={dateRange}
              onChange={(dates) => setDateRange(dates)}
            />
          </Space>
          <Button type="primary" onClick={fetchData}>Search</Button>
        </Space>
      </Card>

      <Card 
        title="Area Usage" 
        variant="borderless" 
        className="full-width-card" 
        style={{ marginTop: '5px' }}
        extra={extraControls}
      >
        <Spin 
          spinning={loading} 
          indicator={<DotLoader color="#1890ff" size={40} />}
        >
          <ReactECharts 
            option={areaUsageOption} 
            notMerge={true} 
            style={{ height: "620px", width: "100%" }} 
          />
        </Spin>
      </Card>
    </div>
  );
}
