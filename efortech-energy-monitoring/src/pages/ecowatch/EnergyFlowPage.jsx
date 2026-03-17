import React, { useState, useEffect } from 'react';
import { Card, Select, DatePicker, Button, Space, Spin } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';

const { Option } = Select;
const { RangePicker } = DatePicker;

export default function EnergyFlowPage() {
  const { isDarkMode } = useOutletContext();
  const [loading, setLoading] = useState(false);
  const [sankeyData, setSankeyData] = useState({ nodes: [], links: [] });
  const [dateRange, setDateRange] = useState([]);

  const getColorByArea = (name) => {
    if (!name) return '#8c8c8c';
    if (name.includes('MAIN')) return '#a6a6a6';
    if (name.includes('NR1')) return '#52c41a';
    if (name.includes('NR2')) return '#ffa940';
    if (name.includes('UT_NEW') || name.includes('TURBO')) return '#ffc53d';
    if (name.includes('UTILITY') || name.includes('COMPRESSOR')) return '#ff85c0';
    if (name.includes('RAC')) return '#36cfc9';
    return '#5cdbd3'; 
  };

  const fetchSankeyData = async () => {
    setLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      let start = `${currentYear}-01-01`;
      let end = `${currentYear}-12-31`;

      if (dateRange && dateRange.length === 2) {
        start = dateRange[0].format('YYYY-MM-DD');
        end = dateRange[1].format('YYYY-MM-DD');
      }

      const url = `http://LAPTOP-KJ75ERV3:5000/energy?interval=Month&start=${start}&end=${end}`;
      const response = await axios.get(url);
      const rawData = response.data;

      const nodeDict = {};
      
      rawData.forEach(item => {
        if (!nodeDict[item.tag_name]) {
          nodeDict[item.tag_name] = { name: item.tag_name, parent: item.parent_name, directVal: 0, children: [] };
        }
        nodeDict[item.tag_name].directVal += item.value_kwh;

        if (item.parent_name) {
          if (!nodeDict[item.parent_name]) {
            nodeDict[item.parent_name] = { name: item.parent_name, parent: null, directVal: 0, children: [] };
          }
          if (!nodeDict[item.parent_name].children.includes(item.tag_name)) {
            nodeDict[item.parent_name].children.push(item.tag_name);
          }
          nodeDict[item.tag_name].parent = item.parent_name;
        }
      });

      const getTotalValue = (nodeName) => {
        const node = nodeDict[nodeName];
        if (!node) return 0;
        let sum = node.directVal;
        node.children.forEach(childName => {
          sum += getTotalValue(childName);
        });
        return sum;
      };

      const nodes = [];
      const links = [];

      Object.values(nodeDict).forEach(node => {
        const totalNodeValue = getTotalValue(node.name);

        if (totalNodeValue > 0) {
          nodes.push({ 
            name: node.name, 
            value: Math.round(totalNodeValue),
            itemStyle: { color: getColorByArea(node.name) } 
          });

          if (node.parent && nodeDict[node.parent]) {
            const parentTotal = getTotalValue(node.parent);
            if (parentTotal > 0) {
              links.push({
                source: node.parent,
                target: node.name,
                value: Math.round(totalNodeValue)
              });
            }
          }
        }
      });

      if (nodes.length === 0) nodes.push({ name: 'No Data' });

      setSankeyData({ nodes, links });
    } catch (error) {
      console.error("Gagal memproses data Sankey:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSankeyData();
  }, []);

  const sankeyOption = {
    tooltip: { 
      trigger: 'item', 
      triggerOn: 'mousemove',
      formatter: (params) => {
        if (params.dataType === 'node') {
          return `${params.name}: <b>${params.data.value?.toLocaleString()} kWh</b>`;
        }
        return `${params.data.source} ➔ ${params.data.target}: <b>${params.value?.toLocaleString()} kWh</b>`;
      }
    },
    series: [
      {
        type: 'sankey',
        layout: 'none',
        emphasis: { focus: 'adjacency' },
        nodeAlign: 'justify',
        nodeWidth: 15,
        nodeGap: 15,
        label: { 
          show: true, 
          fontSize: 11, 
          fontWeight: '500',
          color: isDarkMode ? '#fff' : '#000',
          formatter: (params) => `${params.name}: ${params.data.value?.toLocaleString()} kWh`
        },
        lineStyle: { color: 'source', curveness: 0.4, opacity: 0.45 },
        itemStyle: { borderWidth: 0, opacity: 1 },
        data: sankeyData.nodes,
        links: sankeyData.links
      }
    ]
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Card styles={{ body: { padding: '10px 24px' } }}>
        <Space wrap>
          <span>Energy item</span>
          <Select defaultValue="Electricity" style={{ width: 150 }}>
            <Option value="Electricity">Electricity</Option>
          </Select>

          <span style={{ marginLeft: '16px' }}>Time</span>
          <RangePicker onChange={(dates) => setDateRange(dates)} />
          
          <Button type="primary" onClick={fetchSankeyData} loading={loading}>
            Search
          </Button>
        </Space>
      </Card>

      <Card bordered={false} styles={{ body: { padding: '24px' } }}>
        <Spin spinning={loading}>
          <ReactECharts 
            option={sankeyOption} 
            theme={isDarkMode ? 'dark' : 'light'} 
            style={{ height: '750px', width: '100%' }} 
          />
        </Spin>
      </Card>
    </div>
  );
}
