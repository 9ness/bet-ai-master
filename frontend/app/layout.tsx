import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'BET AI Master',
    description: 'Predicciones de fútbol impulsadas por Inteligencia Artificial',
};

import localFont from 'next/font/local';

const gazpacho = localFont({
    src: './fonts/gazpacho-italic-heavy.ttf',
    variable: '--font-retro',
    weight: '900', // Heavy/Black
    style: 'italic',
});

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="es" className="dark">
            {/* className="dark" establece el tema por defecto */}
            <body className={`antialiased min-h-screen bg-background ${gazpacho.variable}`} suppressHydrationWarning>
                {children}
            </body>
        </html>
    );
}
