
function StatCard({ title, value, description, icon: Icon, color }) {
  return (
    <div className="stat-card">
      <div className="stat-card-info">
        <span className="stat-title">{title}</span>
        <h2>{value}</h2>
        <span className="stat-description">{description}</span>
      </div>

      <div
        className="stat-icon"
        style={{
          backgroundColor: `${color}18`,
          color: color
        }}
      >
        <Icon size={22} />
      </div>
    </div>
  );
}

export default StatCard;
