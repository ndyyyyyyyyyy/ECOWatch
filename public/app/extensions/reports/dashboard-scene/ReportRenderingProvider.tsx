import { createContext, useContext, ReactNode } from 'react';

export enum RenderingContextEnum {
  DashboardPage = 'dashboard-page',
  ReportPage = 'report-page',
}

export type RenderingFormContextType = {
  renderingContext: RenderingContextEnum;
};

const ReportFormContext = createContext<RenderingFormContextType>({
  renderingContext: RenderingContextEnum.ReportPage,
});

export const ReportRenderingProvider = ({
  children,
  renderingFormContext,
}: {
  children: ReactNode;
  renderingFormContext: RenderingFormContextType;
}) => {
  return <ReportFormContext.Provider value={renderingFormContext}>{children}</ReportFormContext.Provider>;
};

export const useReportFormContext = () => {
  const reportFormContext = useContext(ReportFormContext);
  if (!reportFormContext) {
    throw new Error('useReportFormContext must be used within a ReportRenderingProvider');
  }
  return reportFormContext;
};
