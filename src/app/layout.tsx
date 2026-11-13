import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./dark.css";
export const metadata: Metadata = { title: "MACAPP | Barberías", description: "Gestión de barberías: citas, caja e inventario", applicationName: "MACAPP", manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0d0d0f" };
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="es"><body>{children}</body></html>}
