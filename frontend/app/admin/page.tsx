import React from 'react';
import AdminGuard from './AdminGuard';
import DailyPredictions from '@/components/DailyPredictions';
import { getRecommendations } from '@/lib/server-utils';

export const revalidate = 60;

export default async function AdminPage() {
    const data = await getRecommendations();

    // Data format: { date: string, is_real: boolean, bets: { safe: ..., value: ..., funbet: ... } }
    const predictions = data?.bets;

    return (
        <AdminGuard>
            <DailyPredictions predictions={predictions} />
        </AdminGuard>
    );
}
