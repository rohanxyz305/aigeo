import { ApplicationInsights, DistributedTracingModes } from '@microsoft/applicationinsights-web';

const cs = import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING;

export const appInsights = cs
  ? new ApplicationInsights({
      config: {
        connectionString: cs,
        enableAutoRouteTracking: true, // record every page change
        // Send trace headers on cross-origin calls to the API so the
        // browser request and the backend request share one trace.
        enableCorsCorrelation: true,
        correlationHeaderDomains: ['aigeo-api-rk-hvhvffe3e4c9b8fs.centralindia-01.azurewebsites.net'],
        distributedTracingMode: DistributedTracingModes.AI_AND_W3C,
      },
    })
  : null;

if (appInsights) {
  appInsights.loadAppInsights();
  appInsights.addTelemetryInitializer((item) => {
    item.tags['ai.cloud.role'] = 'aigeo-web';
  });
  appInsights.trackPageView();
}
