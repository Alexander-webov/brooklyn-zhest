import './globals.css';

export const metadata = {
  title: 'Brooklyn Watch',
  description: 'Панель управления Brooklyn жесть',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y=".9em" font-size="22">🚨</text></svg>'
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
