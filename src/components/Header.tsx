import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, availableThemes } from '../contexts/ThemeContext';
import { Menu, LogOut, Palette, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { theme, setTheme, isDark } = useTheme();
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const handleLogout = () => {
    logout();
  };

  const themeNames = {
    light: 'Light',
    dark: 'Dark',
    oceanic: 'Oceanic',
    forest: 'Forest',
    sunset: 'Sunset',
    royal: 'Royal'
  };

  return (
    <header className="flex items-center justify-between px-2 py-2 border-b" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
      <div className="flex items-center">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-md lg:hidden hover:bg-opacity-10"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-background)' }}
        >
          <Menu size={20} />
        </button>
        <h2 className="ml-4 lg:ml-0 text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
          Task Management System
        </h2>
      </div>

      <div className="flex items-center space-x-4">
        {/* Theme Selector */}
        <div className="relative">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="p-2 rounded-lg hover:bg-opacity-10 transition-colors"
            style={{ backgroundColor: showThemeMenu ? 'var(--color-primary)' : 'transparent', color: showThemeMenu ? 'white' : 'var(--color-text)' }}
            title="Change Theme"
          >
            {isDark ? <Moon size={20} /> : <Palette size={20} />}
          </button>

          {showThemeMenu && (
            <div className="absolute right-0 mt-2 w-36 rounded-lg shadow-lg border z-50" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="py-1">
                {availableThemes.map((themeName) => (
                  <button
                    key={themeName}
                    onClick={() => {
                      setTheme(themeName);
                      setShowThemeMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-opacity-10 transition-colors ${
                      theme === themeName ? 'font-medium' : ''
                    }`}
                    style={{
                      backgroundColor: theme === themeName ? 'var(--color-primary)' : 'transparent',
                      color: theme === themeName ? 'white' : 'var(--color-text)'
                    }}
                  >
                    {themeNames[themeName as keyof typeof themeNames]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              {user?.username}
            </p>
            <p className="text-xs capitalize" style={{ color: 'var(--color-textSecondary)' }}>
              {user?.role}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-opacity-10 transition-colors"
            style={{ color: 'var(--color-error)' }}
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;