import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "MicroApps | Barberías", description: "Gestión de barberías: citas, caja e inventario", applicationName: "MicroApps", manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#103e32" };
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="es"><body>{children}</body></html>}
