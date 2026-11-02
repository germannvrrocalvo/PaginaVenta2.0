
import { Bell, Search, ChevronDown } from "lucide-react";

function Header({ title, subtitle }) {
  return (
    <header className="header">
      <div className="header-title">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="header-actions">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar..."
          />
        </div>

        <button className="notification-button">
          <Bell size={20} />
          <span className="notification-dot"></span>
        </button>

        <div className="header-profile">
          <div className="profile-avatar">AD</div>

          <div className="profile-details">
            <strong>Administrador</strong>
            <span>Admin</span>
          </div>

          <ChevronDown size={16} />
        </div>
      </div>
    </header>
  );
}

export default Header;
