import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-brand">
          <span className="header-mark">SG</span>
          <div>
            <p className="header-title">Silent Gallery</p>
            <p className="header-subtitle">Encrypted metadata vault</p>
          </div>
        </div>
        <ConnectButton showBalance={false} />
      </div>
    </header>
  );
}
