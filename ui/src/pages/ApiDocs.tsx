export default function ApiDocs() {
  const src = import.meta.env.DEV
    ? "http://localhost:5320/swagger"
    : "/swagger";

  return (
    <div className="iframe-page">
      <iframe src={src} title="API Docs" />
    </div>
  );
}
