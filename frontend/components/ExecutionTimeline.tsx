import React, { useMemo } from 'react';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface TimelineProps {
    scriptsStatus: Record<string, any>;
    history?: any[];
}

export default function ExecutionTimeline({ scriptsStatus, history = [] }: TimelineProps) {
    // Define flow steps (Identity Colors Preserved)
    const steps = [
        { id: 'Daily Fetch', label: 'Recolector', iconText: '1º', color: 'text-blue-400', bg: 'bg-blue-500', border: 'border-blue-500', shadow: 'shadow-blue-500/50' },
        { id: 'Daily Analysis', label: 'Analizador', iconText: '2º', color: 'text-purple-400', bg: 'bg-purple-500', border: 'border-purple-500', shadow: 'shadow-purple-500/50' },
        { id: 'Stakazo Analysis', label: 'Stakazo', iconText: '2ºB', color: 'text-amber-400', bg: 'bg-amber-500', border: 'border-amber-500', shadow: 'shadow-amber-500/50' },
        { id: 'Social Generator', label: 'Social', iconText: '3º', color: 'text-rose-400', bg: 'bg-rose-500', border: 'border-rose-500', shadow: 'shadow-rose-500/50' },
        { id: 'Check Results', label: 'Comprobador', iconText: '4º', color: 'text-emerald-400', bg: 'bg-emerald-500', border: 'border-emerald-500', shadow: 'shadow-emerald-500/50' },
        { id: 'TikTok Viral Automation', label: 'Viral', iconText: '5º', color: 'text-pink-400', bg: 'bg-pink-500', border: 'border-pink-500', shadow: 'shadow-pink-500/50' }
    ];

    // Helper for Summary Status
    const getStepInfo = (scriptId: string) => {
        const data = scriptsStatus[scriptId];
        if (!data) return { status: 'pending', time: null };

        if (!data.date) return { status: 'pending', time: null };

        let status = 'pending';
        let displayTime = '';

        try {
            const [datePart, timePart] = data.date.split(' ');
            if (datePart && timePart) {
                const [year, month, day] = datePart.split('-').map(Number);
                const [hours, minutes, seconds] = timePart.split(':').map(Number);
                const runDate = new Date(year, month - 1, day, hours, minutes, seconds);
                const today = new Date();

                if (runDate.toDateString() === today.toDateString()) {
                    if (data.status === 'SUCCESS') status = 'completed';
                    else if (data.status === 'FAILURE' || data.status === 'ERROR') status = 'error';
                    else if (data.status === 'RUNNING') status = 'running';

                    runDate.setHours(runDate.getHours() + 1); // Spain display adjustment
                    displayTime = runDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                }
            }
        } catch (e) {
            status = 'pending';
        }
        return { status, time: displayTime };
    };

    // Calculate position (0-100%)
    const getPosition = (timeStr: string) => {
        try {
            const [h, m, s] = timeStr.split(':').map(Number);
            const totalMinutes = h * 60 + m;
            const percentage = (totalMinutes / 1440) * 100;
            return Math.min(Math.max(percentage, 0), 100);
        } catch { return 0; }
    };

    // Identify script type for coloring dots (Updated with Stakazo)
    const getScriptColor = (scriptName: string) => {
        if (!scriptName) return 'bg-gray-500';
        const name = scriptName.toLowerCase();

        if (name.includes('daily') || name.includes('fetch')) return 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]';
        if (name.includes('stakazo')) return 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]';
        if (name.includes('analysis')) return 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]';
        if (name.includes('social')) return 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]';

        // Expanded logic for Checker
        if (name.includes('check') || name.includes('result')) return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]';

        if (name.includes('tiktok') || name.includes('viral')) return 'bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]';
        return 'bg-gray-500';
    };

    const getScriptLabel = (scriptName: string) => {
        if (!scriptName) return 'Script';
        const name = scriptName.toLowerCase();

        if (name.includes('daily') || name.includes('fetch')) return 'Recolector';
        if (name.includes('stakazo')) return 'Stakazo';
        if (name.includes('analysis')) return 'Analizador';
        if (name.includes('social')) return 'Social';

        // Expanded logic for Checker
        if (name.includes('check') || name.includes('result')) return 'Comprobador';

        if (name.includes('tiktok') || name.includes('viral')) return 'Viral';
        return 'Script';
    };

    const [selectedEventIndex, setSelectedEventIndex] = React.useState<number | null>(null);

    // MERGE History + Current Status to ensure dots exist for current cards
    const timelineEvents = useMemo(() => {
        // 1. Process History specific logic (Adjust Time +1h)
        const adjustedHistory = history ? history.map(h => {
            if (!h || !h.time) return h;
            try {
                // Parse HH:MM:SS
                const [hh, mm, ss] = h.time.split(':').map(Number);
                const date = new Date();
                date.setHours(hh, mm, ss || 0);
                // Apply SAME +1 hour logic as AdminGuard/getStepInfo
                date.setHours(date.getHours() + 1);
                const newTime = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                return { ...h, time: newTime };
            } catch { return h; }
        }) : [];

        const events = [...adjustedHistory];

        // Check against scriptsStatus to ensure current states are represented as dots
        // This fixes the issue where cards show a time but timeline is empty
        Object.keys(scriptsStatus).forEach(key => {
            const statusData = scriptsStatus[key];
            if (statusData && statusData.date && statusData.status === 'SUCCESS') {
                try {
                    const [datePart, timePart] = statusData.date.split(' ');
                    const [year, month, day] = datePart.split('-').map(Number);
                    const [hours, minutes, seconds] = timePart.split(':').map(Number);
                    const runDate = new Date(year, month - 1, day, hours, minutes, seconds);

                    // Apply SAME +1 hour logic as AdminGuard/getStepInfo
                    runDate.setHours(runDate.getHours() + 1);

                    const timeStr = runDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                    // Check if already in history (fuzzy match by script and hour/minute)
                    // History items usually have "time": "HH:MM:SS" or similar.
                    const exists = events.find(e => e.script === key && e.time.startsWith(timeStr));

                    if (!exists) {
                        // Only add if it's from TODAY (timeline is 24h for today)
                        const today = new Date();
                        if (runDate.toDateString() === today.toDateString()) {
                            events.push({
                                script: key,
                                status: statusData.status,
                                time: timeStr,
                                timestamp: runDate.getTime() / 1000,
                                message: 'Auto-synced from Status'
                            });
                        }
                    }
                } catch (e) {
                    // ignore parse error
                }
            }
        });

        // 1. Map to basic objects with position
        const mappedEvents = events.filter(h => h && h.time).map(h => ({
            ...h,
            pos: getPosition(h.time),
            color: getScriptColor(h.script),
            label: getScriptLabel(h.script)
        }));

        // 2. Sort by position
        mappedEvents.sort((a, b) => a.pos - b.pos);

        // 3. Assign staggering levels to prevent overlap
        return mappedEvents.reduce((acc: any[], curr, idx) => {
            if (idx === 0) {
                return [{ ...curr, level: 0 }];
            }
            const prev = acc[idx - 1];
            // Threshold for overlap (approx 4% of width is enough for text overlap)
            if (curr.pos - prev.pos < 3.5) {
                // If close, increment level. Cycle max 3 levels (0, 1, 2)
                const newLevel = (prev.level + 1) % 3;
                return [...acc, { ...curr, level: newLevel }];
            }
            return [...acc, { ...curr, level: 0 }];
        }, []);
    }, [history, scriptsStatus]);

    return (
        <div className="w-full mb-8 px-2 flex flex-col gap-8">
            {/* 1. STEPS VIEW (Summary) */}
            <div className="relative flex items-center justify-between">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-white/5 rounded-full -z-10" />
                {steps.map((step) => {
                    const { status, time } = getStepInfo(step.id);

                    let nodeClasses = "bg-[#0f0f11] border-white/10 text-white/30"; // Pending default
                    let glowClass = "";
                    let timeColor = "text-white/20";
                    let labelColor = "text-white/30";

                    // Active/Completed Logic: Show IDENTITY COLOR always if not pending
                    if (status !== 'pending') {
                        nodeClasses = `${step.bg} ${step.border} text-white border-none`; // Full color
                        glowClass = `shadow-[0_0_15px_-3px_rgba(0,0,0,0.5)]`; // generic shadow or color shadow?
                        // Add specific shadow based on identity
                        if (step.id.includes('daily')) glowClass = "shadow-[0_0_15px_-3px_rgba(59,130,246,0.6)]";
                        if (step.id.includes('stakazo')) glowClass = "shadow-[0_0_15px_-3px_rgba(245,158,11,0.6)]";
                        else if (step.id.includes('analysis')) glowClass = "shadow-[0_0_15px_-3px_rgba(168,85,247,0.6)]";
                        if (step.id.includes('social')) glowClass = "shadow-[0_0_15px_-3px_rgba(244,63,94,0.6)]";
                        if (step.id.includes('check')) glowClass = "shadow-[0_0_15px_-3px_rgba(16,185,129,0.6)]";
                        if (step.id.includes('tiktok')) glowClass = "shadow-[0_0_15px_-3px_rgba(236,72,153,0.6)]";

                        timeColor = step.color;
                        labelColor = "text-white";
                    }

                    return (
                        <div key={step.id} className="flex flex-col items-center gap-2 relative group cursor-help">
                            {/* Time Label - ALWAYS VISIBLE NOW */}
                            <div className={`absolute -top-5 text-[10px] font-mono font-bold ${timeColor} opacity-100 transition-opacity whitespace-nowrap`}>
                                {time || "--:--"}
                            </div>

                            {/* Node Circle */}
                            <div className={`w-9 h-9 md:w-10 md:h-10 rounded-full border-2 flex items-center justify-center transition-all duration-500 z-10 ${nodeClasses} ${glowClass} ${status === 'running' ? 'animate-pulse' : ''}`}>
                                <span className={`font-black tracking-tighter ${step.iconText.length > 2 ? 'text-[9px] md:text-[10px]' : 'text-xs md:text-sm'}`}>
                                    {step.iconText}
                                </span>
                            </div>

                            {/* Label */}
                            <span className={`hidden md:block text-[10px] font-bold uppercase tracking-wider transition-colors mt-1 ${labelColor}`}>
                                {step.label}
                            </span>
                            <span className={`md:hidden text-[9px] font-bold uppercase tracking-wider transition-colors mt-1 ${labelColor}`}>
                                {step.label.slice(0, 3)}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* 2. REAL TIMELINE (00:00 - 24:00) */}
            <div className="w-full bg-[#0f0f11] border border-white/5 rounded-xl p-4 relative overflow-hidden">
                <div className="flex justify-between items-center mb-6 px-1">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Actividad en Tiempo Real (24h)</span>
                    <span className="text-[10px] font-mono text-white/20">{new Date().toLocaleDateString()}</span>
                </div>

                {/* The Line Container */}
                <div className="relative w-full h-16 flex items-center">
                    {/* Base Line */}
                    <div className="absolute w-full h-0.5 bg-white/10 rounded-full"></div>

                    {/* Tick Marks */}
                    {[0, 6, 12, 18, 24].map(h => (
                        <div key={h} className="absolute h-full flex flex-col justify-center items-center gap-2" style={{ left: `${(h / 24) * 100}%`, transform: 'translateX(-50%)' }}>
                            <div className="w-px h-full bg-white/5 absolute top-0"></div>
                            <div className="w-px h-3 bg-white/10 relative z-10"></div>
                            <span className="text-[9px] text-white/20 font-mono absolute bottom-0">{h.toString().padStart(2, '0')}:00</span>
                        </div>
                    ))}

                    {/* Events LINES (instead of dots) with Staggered Heights */}
                    {timelineEvents.map((evt, idx) => {
                        // Dynamic Height based on Level to stagger labels
                        const heightClass = evt.level === 1 ? 'h-10' : evt.level === 2 ? 'h-14' : 'h-6';
                        const isSelected = selectedEventIndex === idx;

                        return (
                            <div
                                key={idx}
                                onClick={() => setSelectedEventIndex(isSelected ? null : idx)}
                                // Vertical Line Marker - No Shadow
                                className={`absolute w-0.5 ${heightClass} top-1/2 -translate-y-1/2 cursor-pointer transition-all hover:w-1 z-20 ${evt.color} ${evt.status === 'START' ? 'opacity-50' : 'opacity-100'}`}
                                style={{ left: `${evt.pos}%` }}
                            >
                                {/* Time Label (Visible ONLY ON CLICK) - Positioned relative to the TOP of the line */}
                                <div className={`absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-white/90 whitespace-nowrap pointer-events-none transition-opacity duration-200 ${isSelected ? 'opacity-100' : 'opacity-0'}`}>
                                    {evt.time.slice(0, 5)}
                                </div>

                                {/* Tooltip (Also show on Hover, but simpler) */}
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block w-max bg-black/90 border border-white/10 px-2 py-1 rounded text-[10px] text-white z-50 pointer-events-none whitespace-nowrap uppercase tracking-wider">
                                    <div className="font-bold">{evt.label}</div>
                                    <div className="font-mono text-white/70">{evt.time} - {evt.status}</div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Current Time */}
                    <div
                        className="absolute w-0.5 h-full bg-amber-500/50 z-10"
                        style={{ left: `${((new Date().getHours() * 60 + new Date().getMinutes()) / 1440) * 100}%` }}
                    >
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] text-amber-500 font-mono bg-black/50 px-1 rounded">AHORA</div>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex justify-between px-1 border-t border-white/5 pt-3">
                <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]"></div> Recolector
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                        <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_5px_rgba(168,85,247,0.5)]"></div> Analizador
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                        <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]"></div> Stakazo
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                        <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div> Social
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div> Comprobador
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                        <div className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]"></div> Viral
                    </div>
                </div>
            </div>
        </div>
    );
}
