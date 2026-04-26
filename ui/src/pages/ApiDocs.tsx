const specUrl = import.meta.env.DEV
  ? "http://localhost:5320/swagger.json"
  : "/swagger.json";

const html = `<!DOCTYPE html>
<html>
<head>
  <title>F1 Data Server — API Docs</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css"/>
  <style>
    *, body { background: #0e0e0e !important; color: #e0e0e0 !important; }
    .swagger-ui .info .title, .swagger-ui .info p, .swagger-ui .info a { color: #e0e0e0 !important; }
    .swagger-ui .scheme-container { background: #1a1a1a !important; box-shadow: none !important; }
    .swagger-ui .opblock-tag { border-bottom: 1px solid #2a2a2a !important; color: #e0e0e0 !important; }
    .swagger-ui .opblock { background: #1a1a1a !important; border-color: #2a2a2a !important; }
    .swagger-ui .opblock .opblock-summary { background: #1a1a1a !important; }
    .swagger-ui .opblock .opblock-summary-description { color: #aaa !important; }
    .swagger-ui .opblock-body, .swagger-ui .opblock-description-wrapper { background: #111 !important; }
    .swagger-ui table thead tr th, .swagger-ui table thead tr td { border-color: #2a2a2a !important; color: #aaa !important; }
    .swagger-ui .parameter__name, .swagger-ui .parameter__type { color: #ccc !important; }
    .swagger-ui input, .swagger-ui select, .swagger-ui textarea { background: #1a1a1a !important; color: #e0e0e0 !important; border-color: #333 !important; }
    .swagger-ui .btn { background: #1a1a1a !important; color: #e0e0e0 !important; border-color: #444 !important; }
    .swagger-ui .btn.execute { background: #e10600 !important; color: #fff !important; border-color: #e10600 !important; }
    .swagger-ui .responses-inner { background: #111 !important; }
    .swagger-ui .response-col_status { color: #ccc !important; }
    .swagger-ui section.models { background: #1a1a1a !important; border-color: #2a2a2a !important; }
    .swagger-ui .model-title, .swagger-ui .model { color: #ccc !important; }
    .swagger-ui .topbar { display: none !important; }
    .swagger-ui select { background-image: none !important; }
    .swagger-ui .servers > label { color: #aaa !important; }
  </style>
</head>
<body style="margin:0">
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "${specUrl}",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout",
    });
  </script>
</body>
</html>`;

export default function ApiDocs() {
  return (
    <div className="iframe-page">
      <iframe
        title="API Docs"
        srcDoc={html}
        style={{ width: "100%", height: "100%", border: "none" }}
      />
    </div>
  );
}
