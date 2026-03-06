import { parseReportTimeRange } from './time';

describe('parseReportTimeRange', () => {
  it('should handle relative time ranges', () => {
    const timeRange = {
      from: 'now-6h',
      to: 'now',
    };

    const result = parseReportTimeRange(timeRange);

    expect(result).toEqual({
      from: 'now-6h',
      to: 'now',
      raw: {
        from: 'now-6h',
        to: 'now',
      },
    });
  });

  it('should handle absolute time ranges with epoch time format', () => {
    const timeRange = {
      from: '1715846400000', // 2024-05-16T08:00:00.000Z
      to: '1715932800000', // 2024-05-17T08:00:00.000Z
    };

    const result = parseReportTimeRange(timeRange);

    expect(result).toEqual({
      from: '2024-05-16T08:00:00.000Z',
      to: '2024-05-17T08:00:00.000Z',
      raw: {
        from: '1715846400000',
        to: '1715932800000',
      },
    });
  });

  it('should handle absolute time ranges with ISO format', () => {
    const timeRange = {
      from: '2025-05-16T02:59:59.000Z',
      to: '2025-05-17T02:59:59.000Z',
    };

    const result = parseReportTimeRange(timeRange);

    expect(result).toEqual({
      from: '2025-05-16T02:59:59.000Z',
      to: '2025-05-17T02:59:59.000Z',
      raw: {
        from: '2025-05-16T02:59:59.000Z',
        to: '2025-05-17T02:59:59.000Z',
      },
    });
  });

  it('should handle empty string time ranges', () => {
    const timeRange = {
      from: '',
      to: '',
    };

    const result = parseReportTimeRange(timeRange);

    expect(result).toEqual({
      from: '',
      to: '',
      raw: {
        from: '',
        to: '',
      },
    });
  });
});
