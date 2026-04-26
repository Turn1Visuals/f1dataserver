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
