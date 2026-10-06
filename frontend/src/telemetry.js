import { ApplicationInsights } from '@microsoft/applicationinsights-web';

const cs = import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING;

export const appInsights = cs
  ? new ApplicationInsights({
      config: {
        connectionString: cs,
        enableAutoRouteTracking: true, // record every page change
        // Keep false: the backend CORS config only allows Authorization and
        // Content-Type, so traceparent / Request-Id headers would be blocked.
        enableCorsCorrelation: false,
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
