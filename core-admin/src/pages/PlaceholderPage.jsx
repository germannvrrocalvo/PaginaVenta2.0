
function PlaceholderPage({ title, description }) {
  return (
    <section className="placeholder-page">
      <div className="placeholder-card">
        <h2>{title}</h2>
        <p>{description}</p>

        <div className="placeholder-message">
          Esta sección está preparada para su desarrollo.
        </div>
      </div>
    </section>
  );
}

export default PlaceholderPage;
