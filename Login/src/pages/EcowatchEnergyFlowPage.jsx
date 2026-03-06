import React from 'react';
import { Card, Select, DatePicker, Button, Space } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useOutletContext } from 'react-router-dom';

const { Option } = Select;
const { RangePicker } = DatePicker;

export default function EnergyFlowPage() {
  const { isDarkMode } = useOutletContext(); 

  const sankeyOption = {
    tooltip: { 
      trigger: 'item', 
      triggerOn: 'mousemove',
      formatter: function (params) {
        if (params.dataType === 'node') {
          return `${params.name}: ${params.value.toLocaleString()} kWh`;
        } else {
          return `${params.data.source} ➔ ${params.data.target}: ${params.value.toLocaleString()} kWh`;
        }
      }
    },
    series: [
      {
        type: 'sankey',
        emphasis: { focus: 'adjacency' },
        nodeAlign: 'left',
        label: { 
          show: true, 
          fontSize: 11, 
          color: isDarkMode ? '#fff' : '#333',
          formatter: '{b}' 
        },
        lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.4 },
        itemStyle: { borderWidth: 0, opacity: 0.8 },
        
        data: [
          { name: 'MAIN_ELECTRICAL', itemStyle: { color: '#8c8c8c' } },
          
          { name: 'NR1', itemStyle: { color: '#52c41a' } },
          { name: 'NR2', itemStyle: { color: '#faad14' } },
          { name: 'UT_NEW', itemStyle: { color: '#1890ff' } },
          { name: 'UTILITY', itemStyle: { color: '#eb2f96' } },
          
          { name: 'LVMDP_NR1', itemStyle: { color: '#52c41a' } },
          { name: 'LVMDP_NR2', itemStyle: { color: '#faad14' } },
          { name: 'SDP3_NR2', itemStyle: { color: '#faad14' } },
          { name: 'LVMDP_UTILITY', itemStyle: { color: '#eb2f96' } },
          { name: 'TURBO_ATLAS2', itemStyle: { color: '#1890ff' } },
          { name: 'TURBO_ATLAS3', itemStyle: { color: '#1890ff' } },

          { name: 'DB_2', itemStyle: { color: '#52c41a' } },
          { name: 'V_F_MALE_C_NR1', itemStyle: { color: '#52c41a' } },
          { name: 'V_F_MALE_B_NR1', itemStyle: { color: '#52c41a' } },
          { name: 'V_F_MALE_A_NR1', itemStyle: { color: '#52c41a' } },
          { name: 'SDP1_NR2', itemStyle: { color: '#faad14' } },
          { name: 'SDP2_NR2', itemStyle: { color: '#faad14' } },
          { name: 'TURBO_ATLAS1', itemStyle: { color: '#faad14' } },
          { name: 'MAIN_PP_COMPRESSOR', itemStyle: { color: '#eb2f96' } },
          { name: 'UTILITY_CHAMBER', itemStyle: { color: '#eb2f96' } }
        ],
        
        links: [
          { source: 'MAIN_ELECTRICAL', target: 'NR1', value: 600000 },
          { source: 'MAIN_ELECTRICAL', target: 'NR2', value: 500000 },
          { source: 'MAIN_ELECTRICAL', target: 'UT_NEW', value: 700000 },
          { source: 'MAIN_ELECTRICAL', target: 'UTILITY', value: 200000 },

          { source: 'NR1', target: 'LVMDP_NR1', value: 600000 },
          { source: 'NR2', target: 'LVMDP_NR2', value: 300000 },
          { source: 'NR2', target: 'SDP3_NR2', value: 200000 },
          { source: 'UT_NEW', target: 'TURBO_ATLAS2', value: 350000 },
          { source: 'UT_NEW', target: 'TURBO_ATLAS3', value: 350000 },
          { source: 'UTILITY', target: 'LVMDP_UTILITY', value: 200000 },

          { source: 'LVMDP_NR1', target: 'DB_2', value: 150000 },
          { source: 'LVMDP_NR1', target: 'V_F_MALE_C_NR1', value: 150000 },
          { source: 'LVMDP_NR1', target: 'V_F_MALE_B_NR1', value: 150000 },
          { source: 'LVMDP_NR1', target: 'V_F_MALE_A_NR1', value: 150000 },
          
          { source: 'LVMDP_NR2', target: 'SDP1_NR2', value: 150000 },
          { source: 'LVMDP_NR2', target: 'SDP2_NR2', value: 150000 },
          { source: 'SDP3_NR2', target: 'TURBO_ATLAS1', value: 200000 },

          { source: 'LVMDP_UTILITY', target: 'MAIN_PP_COMPRESSOR', value: 160000 },
          { source: 'LVMDP_UTILITY', target: 'UTILITY_CHAMBER', value: 40000 }
        ]
      }
    ]
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Card bodyStyle={{ padding: '10px 24px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <Space wrap>
          <span>Area level</span>
          <Select defaultValue="3" style={{ width: 80 }}><Option value="3">3</Option></Select>
          
          <span>Energy item</span>
          <Select defaultValue="Electricity" style={{ width: 120 }}><Option value="Electricity">Electricity</Option></Select>

          <span>Time</span>
          <RangePicker />
          <Button type="primary">Search</Button>
        </Space>
      </Card>

      <Card bordered={false} bodyStyle={{ padding: '24px' }}>
        <ReactECharts 
          option={sankeyOption} 
          theme={isDarkMode ? 'dark' : 'light'} 
          style={{ height: '600px', width: '100%' }} 
        />
      </Card>
    </div>
  );
}