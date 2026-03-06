import { useState } from 'react';
import { FieldErrors } from 'react-hook-form';

import { ReportFormV2 } from 'app/extensions/types/reports';

import Attachments from './Attachments';
import EmailConfiguration from './EmailConfiguration';
import Recipients from './Recipients';
import Schedule from './Schedule/Schedule';
import SelectDashboards from './SelectDashboards/SelectDashboards';
import { SectionProps, SectionId } from './types';

export const REPORT_FORM_SECTIONS: Array<{
  id: SectionId;
  inputs: Array<keyof ReportFormV2>;
  component: React.ComponentType<SectionProps>;
}> = [
  { id: SectionId.SelectDashboards, inputs: ['dashboards'], component: SelectDashboards },
  { id: SectionId.Schedule, inputs: ['schedule'], component: Schedule },
  {
    id: SectionId.EmailConfiguration,
    inputs: ['subject', 'message', 'replyTo', 'addDashboardUrl', 'addDashboardImage'],
    component: EmailConfiguration,
  },
  { id: SectionId.Recipients, inputs: ['recipients'], component: Recipients },
  { id: SectionId.Attachments, inputs: ['attachments'], component: Attachments },
];

export const useReportSections = (defaultOpenSections?: Partial<Record<SectionId, boolean>>) => {
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    [SectionId.SelectDashboards]: defaultOpenSections?.[SectionId.SelectDashboards] ?? true,
    [SectionId.Schedule]: defaultOpenSections?.[SectionId.Schedule] ?? true,
    [SectionId.EmailConfiguration]: defaultOpenSections?.[SectionId.EmailConfiguration] ?? true,
    [SectionId.Recipients]: defaultOpenSections?.[SectionId.Recipients] ?? true,
    [SectionId.Attachments]: defaultOpenSections?.[SectionId.Attachments] ?? true,
  });

  const updateOpenSectionsByErrors = (errors: FieldErrors<ReportFormV2>) => {
    const errorFields = Object.keys(errors);

    const sectionsWithErrors = REPORT_FORM_SECTIONS.filter((section) =>
      section.inputs.some((input) => errorFields.includes(input))
    ).map((section) => section.id);

    setOpenSections((prevState) => {
      const newState = { ...prevState };
      REPORT_FORM_SECTIONS.forEach((section) => {
        const isClosed = !newState[section.id];
        if (isClosed) {
          newState[section.id] = sectionsWithErrors.includes(section.id);
        }
      });
      return newState;
    });
  };

  return {
    openSections,
    updateOpenSectionsByErrors,
    setOpenSections,
  };
};
