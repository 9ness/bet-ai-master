import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'BET AI Master',
    description: 'Predicciones de fútbol impulsadas por Inteligencia Artificial',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="es" className="dark">
            {/* className="dark" establece el tema por defecto */}
            <body className="antialiased min-h-screen bg-background" suppressHydrationWarning>
                {children}
            </body>
        </html>
    );
}
