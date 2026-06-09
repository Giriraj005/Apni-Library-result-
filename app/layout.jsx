import "./globals.css";

export const metadata = {
  title: "Apni Library Result Alert",
  description: "PDUSU Result Alert System by Apni Library"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
