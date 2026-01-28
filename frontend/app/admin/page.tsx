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

    // STAKAZO FETCH
    const stakazoData = await getRecommendations("daily_bets_stakazo");
    const stakazoPredictions = stakazoData?.bets;

    return (
        <AdminGuard predictions={predictions} formattedDate={formattedDate} rawDate={date}>
            <div className="space-y-8">
                {/* STAKAZO SECTION */}
                {stakazoPredictions && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-700">
                        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg w-fit mx-auto">
                            <span className="text-amber-500 font-black tracking-widest uppercase text-xs md:text-sm flex items-center gap-2">
                                💎 Selección Stakazo
                            </span>
                        </div>
                        <DailyPredictions predictions={stakazoPredictions} isAdmin={true} />
                        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    </div>
                )}

                {/* STANDARD PREDICTIONS */}
                <DailyPredictions predictions={predictions} isAdmin={true} />
            </div>
        </AdminGuard>
    );
}
