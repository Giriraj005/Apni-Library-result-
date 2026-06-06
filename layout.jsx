import "./globals.css";

export const metadata = {
  title: "Apni Library Result Alert",
  description: "PDUSU result alert and Telegram preview system"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
