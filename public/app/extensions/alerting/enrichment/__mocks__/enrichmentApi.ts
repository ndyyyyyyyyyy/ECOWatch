import { HttpResponse, http } from 'msw';

import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import {
  AlertEnrichment,
  AlertEnrichmentList,
  Status,
} from '../../../api/clients/alertenrichment/v1beta1/endpoints.gen';

// Mock data for alert enrichments
export const mockAlertEnrichment = (overrides: Partial<AlertEnrichment> = {}): AlertEnrichment => ({
  apiVersion: 'alerting.grafana.app/v1beta1',
  kind: 'AlertEnrichment',
  metadata: {
    name: 'test-enrichment-1',
    namespace: 'default',
    resourceVersion: '1',
    uid: 'test-uid-1',
    creationTimestamp: '2023-01-01T00:00:00Z',
    ...overrides.metadata,
  },
  spec: {
    title: 'Test Enrichment',
    description: 'A test enrichment for testing purposes',
    steps: [
      {
        timeout: '30s',
        type: 'enricher',
        enricher: { type: 'assign', assign: { annotations: [{ name: 'test-annotation', value: 'test-value' }] } },
      },
    ],
    labelMatchers: [{ name: 'severity', type: '=', value: 'critical' }],
    annotationMatchers: [],
    ...overrides.spec,
  },
  ...overrides,
});

export const mockAlertEnrichmentList = (
  enrichments: AlertEnrichment[] = [mockAlertEnrichment()],
  overrides: Partial<AlertEnrichmentList> = {}
): AlertEnrichmentList => ({
  apiVersion: 'alerting.grafana.app/v1beta1',
  kind: 'AlertEnrichmentList',
  items: enrichments,
  metadata: { resourceVersion: '1', ...overrides.metadata },
  ...overrides,
});

// MSW handlers for alert enrichment APIs
const enrichmentHandlers = [
  // GET /alert-enrichments - List enrichments
  http.get('/apis/alertenrichment.grafana.app/v1beta1/namespaces/default/alert-enrichments', ({ request }) => {
    const url = new URL(request.url);
    const limit = url.searchParams.get('limit');
    const continueToken = url.searchParams.get('continue');

    // Create mock enrichments
    const enrichments: AlertEnrichment[] = [
      mockAlertEnrichment({
        metadata: { name: 'enrichment-1', uid: 'uid-1' },
        spec: {
          title: 'CPU Alert Enrichment',
          description: 'Enriches CPU alerts with additional context',
          steps: [
            {
              timeout: '30s',
              type: 'enricher',
              enricher: {
                type: 'assign',
                assign: { annotations: [{ name: 'runbook', value: 'https://runbook.example.com/cpu' }] },
              },
            },
          ],
          labelMatchers: [{ name: 'alertname', type: '=', value: 'HighCPU' }],
          annotationMatchers: [],
        },
      }),
      mockAlertEnrichment({
        metadata: { name: 'enrichment-2', uid: 'uid-2' },
        spec: {
          title: 'Memory Alert Enrichment',
          description: 'Enriches memory alerts with troubleshooting steps',
          steps: [
            {
              timeout: '60s',
              type: 'enricher',
              enricher: { type: 'external', external: { url: 'https://api.example.com/memory-analysis' } },
            },
          ],
          labelMatchers: [{ name: 'alertname', type: '=', value: 'HighMemory' }],
          annotationMatchers: [],
        },
      }),
    ];

    // Simple pagination simulation
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const startIndex = continueToken ? parseInt(continueToken, 10) : 0;
    const endIndex = Math.min(startIndex + limitNum, enrichments.length);
    const paginatedEnrichments = enrichments.slice(startIndex, endIndex);

    const hasMore = endIndex < enrichments.length;
    const nextContinueToken = hasMore ? endIndex.toString() : undefined;

    const response = mockAlertEnrichmentList(paginatedEnrichments, { metadata: { continue: nextContinueToken } });

    return HttpResponse.json(response);
  }),

  // GET /alert-enrichments/:name - Get specific enrichment
  http.get<{ name: string }>(
    '/apis/alertenrichment.grafana.app/v1beta1/namespaces/default/alert-enrichments/:name',
    ({ params }) => {
      const { name } = params;

      if (name === 'nonexistent') {
        return HttpResponse.json({ message: 'AlertEnrichment not found' }, { status: 404 });
      }

      const enrichment = mockAlertEnrichment({
        metadata: { name: name },
        spec: {
          title: `Enrichment ${name}`,
          description: `Description for ${name}`,
          steps: [
            {
              timeout: '30s',
              type: 'enricher',
              enricher: { type: 'assign', assign: { annotations: [{ name: 'example', value: 'value' }] } },
            },
          ],
        },
      });

      return HttpResponse.json(enrichment);
    }
  ),

  // POST /alert-enrichments - Create enrichment
  http.post('/apis/alertenrichment.grafana.app/v1beta1/namespaces/default/alert-enrichments', async ({ request }) => {
    const body = (await request.json()) as AlertEnrichment;

    const createdEnrichment: AlertEnrichment = {
      ...body,
      metadata: {
        ...body.metadata,
        name: body.metadata?.generateName
          ? `${body.metadata.generateName}${Date.now()}`
          : body.metadata?.name || 'generated-name',
        uid: `uid-${Date.now()}`,
        resourceVersion: '1',
        creationTimestamp: new Date().toISOString(),
      },
    };

    return HttpResponse.json(createdEnrichment, { status: 201 });
  }),

  // PUT /alert-enrichments/:name - Update enrichment
  http.put<{ name: string }, AlertEnrichment>(
    '/apis/alertenrichment.grafana.app/v1beta1/namespaces/default/alert-enrichments/:name',
    async ({ params, request }) => {
      const { name } = params;
      const body = await request.json();

      const updatedEnrichment: AlertEnrichment = {
        ...body,
        metadata: { ...body.metadata, name: name as string, resourceVersion: '2' },
      };

      return HttpResponse.json(updatedEnrichment);
    }
  ),

  // DELETE /alert-enrichments/:name - Delete enrichment
  http.delete<{ name: string }>(
    '/apis/alertenrichment.grafana.app/v1beta1/namespaces/default/alert-enrichments/:name',
    () => {
      const status: Status = { apiVersion: 'v1', kind: 'Status', status: 'Success', code: 200, metadata: {} };

      return HttpResponse.json(status);
    }
  ),
];

/**
 * Helper to override POST enrichment response for testing error scenarios
 */
function mockCreateEnrichmentError(status = 500, message = 'Server error') {
  return http.post('/apis/alertenrichment.grafana.app/v1beta1/namespaces/default/alert-enrichments', () => {
    return HttpResponse.json({ message }, { status });
  });
}

/**
 * Sets up MSW server with alert enrichment API handlers for testing
 */
export function setupEnrichmentMockServer() {
  setupMockServer(enrichmentHandlers);

  beforeAll(() => {
    setBackendSrv(backendSrv);
  });

  afterEach(() => {
    // Reset any necessary state between tests
  });

  const apiConfig = {
    mockCreateError: (status = 500, message = 'Server error') => {
      server.use(mockCreateEnrichmentError(status, message));
    },
    mockGetEnrichment: (enrichmentData: any) => {
      server.use(
        http.get('/apis/alertenrichment.grafana.app/v1beta1/namespaces/default/alert-enrichments/:name', () => {
          return HttpResponse.json(enrichmentData);
        })
      );
    },
  };

  return { server, apiConfig };
}

export { enrichmentHandlers };
