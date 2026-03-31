import React, { useState, useEffect } from 'react';
import { Card, Select, DatePicker, Button, Space, Spin, message } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { ENERGY_ENDPOINT } from './ecowatchApi';

const { Option } = Select;
const { RangePicker } = DatePicker;

export default function EnergyFlowPage() {
  const { isDarkMode } = useOutletContext();
  const [loading, setLoading] = useState(false);
  const [sankeyData, setSankeyData] = useState({ nodes: [], links: [] });
  const [selectedDates, setSelectedDates] = useState([]);

  const getColorByArea = (name) => {
    if (!name) return '#8c8c8c';
    if (name.includes('MAIN')) return '#595959';
    if (name.includes('NR1')) return '#389e0d';
    if (name.includes('NR2')) return '#d46b08';
    if (name.includes('UT_NEW') || name.includes('TURBO')) return '#d48806';
    if (name.includes('UTILITY') || name.includes('COMPRESSOR')) return '#c41d7f';
    if (name.includes('RAC')) return '#08979c';
    return '#8c8c8c';
  };

  const fetchSankeyData = async () => {
    setLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      let start = `${currentYear}-01-01`;
      let end = `${currentYear}-12-31`;

      if (selectedDates && selectedDates.length === 2 && selectedDates[0] !== '') {
        start = selectedDates[0];
        end = selectedDates[1];
      }

      const url = `${ENERGY_ENDPOINT}?interval=Day&start=${start}&end=${end}`;
      const response = await axios.get(url);
      const rawData = response.data;
      const nodeDict = {};

      rawData.forEach((item) => {
        if (!nodeDict[item.tag_name]) {
          nodeDict[item.tag_name] = {
            name: item.tag_name,
            parent: item.parent_name,
            directVal: 0,
            children: [],
            totalFlow: 0,
            depth: 0,
          };
        }
        nodeDict[item.tag_name].directVal += item.value_kwh;

        if (item.parent_name) {
          if (!nodeDict[item.parent_name]) {
            nodeDict[item.parent_name] = {
              name: item.parent_name,
              parent: null,
              directVal: 0,
              children: [],
              totalFlow: 0,
              depth: 0,
            };
          }
          if (!nodeDict[item.parent_name].children.includes(item.tag_name)) {
            nodeDict[item.parent_name].children.push(item.tag_name);
          }
          nodeDict[item.tag_name].parent = item.parent_name;
        }
      });

      const calculateRealisticFlow = (nodeName, visitedNodes = new Set(), currentDepth = 0) => {
        const node = nodeDict[nodeName];
        if (!node) return 0;
        if (visitedNodes.has(nodeName)) return 0;

        visitedNodes.add(nodeName);
        node.depth = currentDepth;

        let sum = node.directVal;
        node.children.forEach((childName) => {
          sum += calculateRealisticFlow(childName, new Set(visitedNodes), currentDepth + 1);
        });

        node.totalFlow = sum;
        return sum;
      };

      Object.values(nodeDict).forEach((node) => {
        if (!node.parent) {
          calculateRealisticFlow(node.name, new Set(), 0);
        }
      });

      const nodes = [];
      const links = [];
      const addedNodes = new Set();

      const addNodeDFS = (nodeName) => {
        if (addedNodes.has(nodeName)) return;
        const node = nodeDict[nodeName];
        if (!node || node.totalFlow <= 0) return;

        nodes.push({
          name: node.name,
          value: Math.round(node.totalFlow),
          depth: node.depth,
          itemStyle: { color: getColorByArea(node.name) },
        });
        addedNodes.add(nodeName);

        const sortedChildren = [...node.children].sort((a, b) => {
          const valA = nodeDict[a] ? nodeDict[a].totalFlow : 0;
          const valB = nodeDict[b] ? nodeDict[b].totalFlow : 0;
          return valB - valA;
        });

        sortedChildren.forEach((childName) => {
          const childNode = nodeDict[childName];
          if (childNode && childNode.totalFlow > 0) {
            links.push({
              source: node.name,
              target: childName,
              value: Math.round(childNode.totalFlow),
            });
            addNodeDFS(childName);
          }
        });
      };

      const rootNodes = Object.values(nodeDict)
        .filter((node) => !node.parent)
        .sort((a, b) => b.totalFlow - a.totalFlow);
      rootNodes.forEach((root) => addNodeDFS(root.name));

      if (nodes.length === 0) {
        nodes.push({ name: 'No Data' });
      }

      setSankeyData({ nodes, links });
    } catch (error) {
      console.error('Failed to process Sankey data:', error);
      message.error('Failed to fetch Sankey data.');
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
      },
    },
    series: [
      {
        type: 'sankey',
        nodeAlign: 'left',
        layoutIterations: 0,
        emphasis: { focus: 'adjacency' },
        nodeWidth: 20,
        nodeGap: 8,
        label: {
          show: true,
          position: 'right',
          fontSize: 12,
          fontWeight: '500',
          color: isDarkMode ? '#fff' : '#000',
          formatter: (params) => `${params.name}: ${params.data.value?.toLocaleString()} kWh`,
        },
        lineStyle: {
          color: 'source',
          curveness: 0.5,
          opacity: 0.4,
        },
        itemStyle: {
          borderWidth: 0,
        },
        data: sankeyData.nodes,
        links: sankeyData.links,
      },
    ],
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
          <RangePicker onChange={(dates, dateStrings) => setSelectedDates(dateStrings)} />

          <Button type="primary" onClick={fetchSankeyData} loading={loading}>
            Search
          </Button>
        </Space>
      </Card>

      <Card bordered={false} styles={{ body: { padding: '24px' } }}>
        <Spin spinning={loading}>
          <div
            style={{
              backgroundColor: isDarkMode ? '#0d1117' : '#ffffff',
              padding: '20px',
              borderRadius: '8px',
            }}
          >
            <ReactECharts
              notMerge={true}
              option={sankeyOption}
              theme={isDarkMode ? 'dark' : 'light'}
              style={{ height: '800px', width: '100%' }}
            />
          </div>
        </Spin>
      </Card>
    </div>
  );
}
