import React, { useState, useEffect } from 'react';
import { Card, DatePicker, Button, Space, Table, Typography, Dropdown, message } from 'antd';
import { DownloadOutlined, FileExcelOutlined, FilePdfOutlined, FileTextOutlined } from '@ant-design/icons';
import { useOutletContext } from "react-router-dom";
import axios from 'axios';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const { Text } = Typography;

export default function AnnualReport() {
  const { isDarkMode, checkedAreaNames } = useOutletContext();

  const [selectedYear, setSelectedYear] = useState(dayjs().year());
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(false);

  const columns = [
    { title: 'Month', dataIndex: 'month', key: 'month', align: 'center', width: 80 },
    {
      title: 'Electricity',
      children: [
        { title: 'Actual usage(kWh)', dataIndex: 'actualStr', key: 'actualStr', align: 'right' },
        { title: 'Equivalent value(tce)', dataIndex: 'equivalentStr', key: 'equivalentStr', align: 'right' },
      ],
    },
    { title: 'Comprehensive usage(tce)', dataIndex: 'compUsageStr', key: 'compUsageStr', align: 'right' },
    { title: 'Total output value(K IDR)', dataIndex: 'totalOutputValue', key: 'totalOutputValue', align: 'right' },
    { title: 'Total output(pcs)', dataIndex: 'totalOutput', key: 'totalOutput', align: 'right' },
    { title: 'Total area(m2)', dataIndex: 'totalArea', key: 'totalArea', align: 'right' },
  ];

  const fetchAnnualData = () => {
    setLoading(true);
    
    let url = `http://localhost:5000/energy?interval=Month&start=${selectedYear}-01-01&end=${selectedYear}-12-31`;

    if (checkedAreaNames && checkedAreaNames.length > 0) {
      url += `&areas=${checkedAreaNames.join(",")}`;
    }

    axios.get(url)
      .then(res => {
        const rawData = Array.isArray(res.data) ? res.data : (res.data.data || []);
        
        const monthlyAggregates = Array.from({ length: 12 }, (_, i) => ({
          key: (i + 1).toString(),
          month: (i + 1).toString(),
          actual: 0,
        }));

        rawData.forEach(item => {
          if (item.timestamp) {
            const monthIndex = parseInt(item.timestamp.split('-')[1], 10) - 1; 
            if (monthIndex >= 0 && monthIndex < 12) {
              monthlyAggregates[monthIndex].actual += item.value_kwh;
            }
          }
        });

        const formattedData = monthlyAggregates.map(row => {
          const equivalent = row.actual * 0.0001229;
          return {
            ...row,
            equivalent: equivalent,
            compUsage: equivalent, 
            actualStr: row.actual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            equivalentStr: equivalent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            compUsageStr: equivalent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            totalOutputValue: '0.00',
            totalOutput: '0.00',
            totalArea: '0.00'
          };
        });

        setTableData(formattedData);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error mengambil data laporan:", err);
        message.error("Gagal terhubung ke database server");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAnnualData();
  }, [selectedYear, checkedAreaNames]);

  const totalActual = tableData.reduce((sum, row) => sum + row.actual, 0);
  const totalEquivalent = tableData.reduce((sum, row) => sum + row.equivalent, 0);
  
  const totalRow = { 
    key: 'total', 
    month: 'Total', 
    actualStr: totalActual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 
    equivalentStr: totalEquivalent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 
    compUsageStr: totalEquivalent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 
    totalOutputValue: '0.00', 
    totalOutput: '0.00', 
    totalArea: '0.00' 
  };

  const displayData = tableData.length > 0 ? [...tableData, {
      key: 'total', 
      month: <Text strong>Total</Text>, 
      actualStr: <Text strong>{totalRow.actualStr}</Text>, 
      equivalentStr: <Text strong>{totalRow.equivalentStr}</Text>, 
      compUsageStr: <Text strong>{totalRow.compUsageStr}</Text>, 
      totalOutputValue: <Text strong>{totalRow.totalOutputValue}</Text>, 
      totalOutput: <Text strong>{totalRow.totalOutput}</Text>, 
      totalArea: <Text strong>{totalRow.totalArea}</Text> 
  }] : [];

  const rawExportData = [...tableData, totalRow];
  const formattedDataForExport = rawExportData.map(row => ({
    "Month": row.month,
    "Actual usage(kWh)": row.actualStr,
    "Equivalent value(tce)": row.equivalentStr,
    "Comprehensive usage(tce)": row.compUsageStr,
    "Total output value(K IDR)": row.totalOutputValue,
    "Total output(pcs)": row.totalOutput,
    "Total area(m2)": row.totalArea
  }));

  const handleDownloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(formattedDataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Report_${selectedYear}`);
    worksheet['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 22 }, { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 18 }];
    XLSX.writeFile(workbook, `Annual_Energy_Report_${selectedYear}.xlsx`);
  };

  const handleDownloadCSV = () => {
    const worksheet = XLSX.utils.json_to_sheet(formattedDataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Report`);
    XLSX.writeFile(workbook, `Annual_Energy_Report_${selectedYear}.csv`, { bookType: "csv" });
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF('landscape'); 
    doc.setFontSize(16);
    doc.text(`Annual Energy Report - ${selectedYear}`, 14, 20);
    
    const tableColumn = ["Month", "Actual usage\n(kWh)", "Equivalent value\n(tce)", "Comprehensive usage\n(tce)", "Total output value\n(K IDR)", "Total output\n(pcs)", "Total area\n(m2)"];
    const tableRows = rawExportData.map(row => [
      row.month, row.actualStr, row.equivalentStr, row.compUsageStr, row.totalOutputValue, row.totalOutput, row.totalArea
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      theme: 'striped',
      headStyles: { fillColor: [22, 119, 255], halign: 'center' },
      columnStyles: { 0: { halign: 'center' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
      styles: { fontSize: 9 }
    });
    doc.save(`Annual_Energy_Report_${selectedYear}.pdf`);
  };

  const downloadMenu = {
    items: [
      { key: 'excel', label: 'Download Excel (.xlsx)', icon: <FileExcelOutlined style={{ color: '#52c41a' }} />, onClick: handleDownloadExcel },
      { key: 'csv', label: 'Download CSV (.csv)', icon: <FileTextOutlined style={{ color: '#1677ff' }} />, onClick: handleDownloadCSV },
      { key: 'pdf', label: 'Download PDF (.pdf)', icon: <FilePdfOutlined style={{ color: '#ff4d4f' }} />, onClick: handleDownloadPDF },
    ]
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '100%' }}>
      
      <Card styles={{ body: { padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '10px' } }}>
        <Space>
          <span style={{ color: isDarkMode ? '#d9d9d9' : '#595959' }}>Year</span>
          <DatePicker 
            picker="year" 
            defaultValue={dayjs()} 
            onChange={(date) => {
              if (date) setSelectedYear(date.year());
            }} 
            allowClear={false}
          />
        </Space>
      </Card>

      <Card 
        title={`Annual Report (${selectedYear})`} 
        bordered={false}
        extra={
          <Dropdown menu={downloadMenu} placement="bottomRight" trigger={['click']}>
            <Button type="text" icon={<DownloadOutlined />} title="Download Report" />
          </Dropdown>
        }
        styles={{ body: { padding: 0 } }}
      >
        <Table 
          columns={columns} 
          dataSource={displayData} 
          bordered 
          size="middle" 
          loading={loading} 
          scroll={{ x: 'max-content' }}
          pagination={false} 
        />
      </Card>
      
      <div style={{ flex: 1 }}></div>
    </div>
  );
}
