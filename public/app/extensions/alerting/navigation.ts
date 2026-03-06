export const enrichmentNav = {
  list: '/alerting/admin/enrichment',
  edit: (name: string) => `/alerting/admin/enrichment/${name}` as const,
  new: '/alerting/admin/enrichment/new',
} as const;
