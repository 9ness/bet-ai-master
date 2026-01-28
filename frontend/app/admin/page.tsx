import React from 'react';
import AdminGuard from './AdminGuard';
import { getRecommendations } from '@/lib/server-utils';
import AdminPredictionsView from '@/components/AdminPredictionsView';

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

    // STAKAZO FETCH
    const stakazoData = await getRecommendations("daily_bets_stakazo");
    const stakazoPredictions = stakazoData?.bets;

    return (
        <AdminGuard predictions={predictions} formattedDate={formattedDate} rawDate={date}>
            <AdminPredictionsView predictions={predictions} stakazoPredictions={stakazoPredictions} />
        </AdminGuard>
    );
}
