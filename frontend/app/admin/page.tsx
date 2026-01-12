import React from 'react';
import AdminGuard from './AdminGuard';
import DailyPredictions from '@/components/DailyPredictions';
import { getRecommendations } from '@/lib/server-utils';

export const revalidate = 60;

export default async function AdminPage() {
    const data = await getRecommendations();

    // Data format
    const predictions = data?.bets;
    const date = data?.date || "Fecha desconocida";

    // Format Date
    let formattedDate = date;
    if (date && date.includes('-')) {
        const [y, m, d] = date.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        formattedDate = dateObj.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
    }

    return (
        <AdminGuard predictions={predictions} formattedDate={formattedDate}>
            <DailyPredictions predictions={predictions} isAdmin={true} />
        </AdminGuard>
    );
}
