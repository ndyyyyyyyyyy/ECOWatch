import React from 'react';
import { Card, DatePicker, Button, Space, Table, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

const { Text } = Typography;

export default function AnnualReport() {
  const columns = [
    { title: 'Month', dataIndex: 'month', key: 'month', align: 'center', width: 80 },
    {
      title: 'Electricity',
      children: [
        { title: 'Actual usage(kWh)', dataIndex: 'actual', key: 'actual', align: 'right' },
        { title: 'Equivalent value(tce)', dataIndex: 'equivalent', key: 'equivalent', align: 'right' },
      ],
    },
    { title: 'Comprehensive usage(tce)', dataIndex: 'compUsage', key: 'compUsage', align: 'right' },
    { title: 'Total output value(K IDR)', dataIndex: 'totalOutputValue', key: 'totalOutputValue', align: 'right' },
    { title: 'Total output(pcs)', dataIndex: 'totalOutput', key: 'totalOutput', align: 'right' },
    { title: 'Total area(m2)', dataIndex: 'totalArea', key: 'totalArea', align: 'right' },
  ];

  const tableData = [
    { key: '1', month: '1', actual: '1,456,489.80', equivalent: '582.60', compUsage: '582.60', totalOutputValue: '0.00', totalOutput: '0.00', totalArea: '0.00' },
    { key: '2', month: '2', actual: '1,958,030.50', equivalent: '783.21', compUsage: '783.21', totalOutputValue: '0.00', totalOutput: '0.00', totalArea: '0.00' },
    { key: '3', month: '3', actual: '0.00', equivalent: '0.00', compUsage: '0.00', totalOutputValue: '0.00', totalOutput: '0.00', totalArea: '0.00' },
    { key: '4', month: '4', actual: '0.00', equivalent: '0.00', compUsage: '0.00', totalOutputValue: '0.00', totalOutput: '0.00', totalArea: '0.00' },
    { key: '5', month: '5', actual: '0.00', equivalent: '0.00', compUsage: '0.00', totalOutputValue: '0.00', totalOutput: '0.00', totalArea: '0.00' },
    { key: '6', month: '6', actual: '0.00', equivalent: '0.00', compUsage: '0.00', totalOutputValue: '0.00', totalOutput: '0.00', totalArea: '0.00' },
    { key: '7', month: '7', actual: '0.00', equivalent: '0.00', compUsage: '0.00', totalOutputValue: '0.00', totalOutput: '0.00', totalArea: '0.00' },
    { key: '8', month: '8', actual: '0.00', equivalent: '0.00', compUsage: '0.00', totalOutputValue: '0.00', totalOutput: '0.00', totalArea: '0.00' },
    { key: '9', month: '9', actual: '0.00', equivalent: '0.00', compUsage: '0.00', totalOutputValue: '0.00', totalOutput: '0.00', totalArea: '0.00' },
    { key: '10', month: '10', actual: '0.00', equivalent: '0.00', compUsage: '0.00', totalOutputValue: '0.00', totalOutput: '0.00', totalArea: '0.00' },
    { key: '11', month: '11', actual: '0.00', equivalent: '0.00', compUsage: '0.00', totalOutputValue: '0.00', totalOutput: '0.00', totalArea: '0.00' },
    { key: '12', month: '12', actual: '0.00', equivalent: '0.00', compUsage: '0.00', totalOutputValue: '0.00', totalOutput: '0.00', totalArea: '0.00' },
    { 
      key: 'total', 
      month: <Text strong>Total</Text>, 
      actual: <Text strong>3,414,520.30</Text>, 
      equivalent: <Text strong>1,365.81</Text>, 
      compUsage: <Text strong>1,365.81</Text>, 
      totalOutputValue: <Text strong>0.00</Text>, 
      totalOutput: <Text strong>0.00</Text>, 
      totalArea: <Text strong>0.00</Text> 
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Card bodyStyle={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Space>
          <span>Time</span>
          <DatePicker picker="year" />
        </Space>
      </Card>

      <Card 
        title="Annual Report" 
        bordered={false}
        extra={<Button type="text" icon={<DownloadOutlined />} />}
        bodyStyle={{ padding: 0 }}
      >
        <Table 
          columns={columns} 
          dataSource={tableData} 
          bordered 
          size="middle"
          scroll={{ x: 'max-content', y: 600 }}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `Total ${total}`,
            defaultPageSize: 10,
            pageSizeOptions: ['10', '20', '50', '100']
          }}
        />
      </Card>
    </div>
  );
}