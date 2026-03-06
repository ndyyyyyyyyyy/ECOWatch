import { toUtc, RawTimeRange, dateMath, rangeUtil } from '@grafana/data';

import { defaultTimeRange } from '../reports/state/reducers';
import { ReportTimeRange } from '../types';

const isValidTimeRange = (range: any) => {
  return dateMath.isValid(range.from) && dateMath.isValid(range.to);
};

/**
 * Get a string representation of range timestamp to be sent to backend
 * @param timeRange
 */
export const parseRange = (timeRange?: RawTimeRange): ReportTimeRange => {
  if (!timeRange || !isValidTimeRange(timeRange)) {
    return { from: '', to: '' };
  }

  return {
    to: timeRange.to.valueOf().toString(),
    from: timeRange.from.valueOf().toString(),
  };
};

/**
 * Return relative time e.g. 'now', 'now-6h' or a parsed timestamp
 * @param timeRange
 */
export const getRange = (timeRange: any): ReportTimeRange => {
  const from = parseValue(timeRange.from);
  const to = parseValue(timeRange.to);

  if (!isValidTimeRange({ from, to })) {
    return defaultTimeRange;
  }
  return { from, to, raw: { from, to } };
};

const parseValue = (value: any) => {
  const parsed = parseInt(value, 10);
  if (!isNaN(parsed)) {
    return toUtc(parsed);
  }

  return value;
};

// backend returns relative time range as string e.g. 'now-1h'
// and absolute time range as timestamp e.g. '1715145600000'
// when the report is created from the dashboard, an absolute time range was previously wrongly persisted in
// a raw format instead of epoc time e.g '2025-05-10T08:00:00.000Z'. This function also takes that into consideration.
// we need to convert absolute time range to a datetime
export const parseReportTimeRange = (timeRange: ReportTimeRange): ReportTimeRange => {
  const isRelative = rangeUtil.isRelativeTimeRange({
    from: timeRange.from,
    to: timeRange.to,
  });

  return {
    from: isRelative || timeRange.from === '' ? timeRange.from : getUTCFromReportTime(timeRange.from),
    to: isRelative || timeRange.to === '' ? timeRange.to : getUTCFromReportTime(timeRange.to),
    raw: {
      from: timeRange.from,
      to: timeRange.to,
    },
  };
};

const getUTCFromReportTime = (time: string) => {
  const parsedTime = isNaN(Number(time)) ? time : parseInt(time, 10);
  return toUtc(parsedTime).toISOString();
};
