import { E2ESelectors } from '@grafana/e2e-selectors';

export const ReportingComponents = {
  reportForm: {
    nextStep: (step: string) => `data-testid report form next ${step}`,
    previousStep: (step: string) => `data-testid report form previous ${step}`,
    selectDashboard: (index: string) => `data-testid report select dashboard ${index}`,
    formatCheckbox: (format: string) => `data-testid report form checkbox format ${format}`,
    nameInput: 'data-testid report name input',
    subjectInput: 'data-testid report subject input',
    sendTestEmailButton: 'data-testid report send test email button',
    useRecipientsCheckbox: 'data-testid report send test email use recipients checkbox',
    sendTestEmailConfirmButton: 'data-testid report send test email confirm button',
    submitButton: 'data-testid report form submit button',
  },
  ReportFormDrawer: {
    SelectDashboards: {
      header: 'data-testid report form select dashboards header',
      content: 'data-testid report form select dashboards content',
    },
    Schedule: {
      header: 'data-testid report form schedule header',
      content: 'data-testid report form schedule content',
    },
    Recipients: {
      header: 'data-testid report form recipients header',
      content: 'data-testid report form recipients content',
    },
    EmailConfiguration: {
      header: 'data-testid report form email configuration header',
      content: 'data-testid report form email configuration content',
      messageInput: 'data-testid report form email configuration message input',
      replyToInput: 'data-testid report form email configuration reply to input',
      subjectInput: 'data-testid report form email configuration subject input',
      addDashboardUrlCheckbox: 'data-testid report form email configuration add dashboard url checkbox',
      addDashboardImageCheckbox: 'data-testid report form email configuration add dashboard image checkbox',
    },
    Attachments: {
      header: 'data-testid report form attachments header',
      content: 'data-testid report form attachments content',
      pdfReportCheckbox: 'data-testid report form attachments pdf report checkbox',
      pdfTablesCheckbox: 'data-testid report form attachments pdf tables checkbox',
      csvTablesCheckbox: 'data-testid report form attachments csv tables checkbox',
      combineDashboardsCheckbox: 'data-testid report form attachments combine dashboards checkbox',
      showTemplateVariablesCheckbox: 'data-testid report form attachments show template variables checkbox',
      pdfTablesAppendixCheckbox: 'data-testid report form attachments pdf tables appendix checkbox',
    },
    container: 'data-testid report form drawer container',
    actionsMenuButton: 'data-testid report form actions menu button',
    ActionsMenu: {
      previewPdf: 'data-testid report form actions menu preview pdf button',
      downloadCsv: 'data-testid report form actions menu download csv button',
      reportSettings: 'data-testid report form actions menu report settings button',
    },
    submitButton: 'data-testid report form submit button',
  },
  ReportsList: {
    container: 'data-testid reports list container',
  },
  scheduleReport: {
    shareMenuItem: 'data-testid new share button schedule report',
  },
  NewShareButton: {
    Menu: {
      scheduleReport: 'data-testid new share button schedule report',
    },
  },
  NewExportButton: {
    Menu: {
      exportAsPdf: 'data-testid new export button export as pdf',
    },
  },
  ExportAsPdf: {
    unavailableFeatureInfoBox: 'data-testid unavailable feature info box',
    noRendererInfoBox: 'data-testid no renderer info box',
    container: 'data-testid export as pdf drawer container',
    orientationButton: 'data-testid export as pdf orientation button',
    layoutButton: 'data-testid export as pdf layout button',
    zoomCombobox: 'data-testid export as zoom combobox',
    previewImage: 'data-testid export as pdf preview image',
    generatePdfButton: 'data-testid export as pdf generate pdf button',
    cancelButton: 'data-testid export as pdf cancel button',
    modalCancelButton: 'data-testid old modal cancel button',
    saveAsPdfButton: 'data-testid save as pdf button',
  },
  ReportingListPage: {
    createButton: 'data-testid create new report button',
  },
};

export const ReportingPages = {
  Report: {
    url: '/reports',
  },
};

export const selectors: {
  pages: E2ESelectors<typeof ReportingPages>;
  components: E2ESelectors<typeof ReportingComponents>;
} = {
  pages: ReportingPages,
  components: ReportingComponents,
};
