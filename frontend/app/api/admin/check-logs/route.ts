import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date'); // YYYY-MM-DD

        // Default to today
        const now = new Date();
        // Adjust for Spain (UTC+1/+2). Simpler: just take UTC date string if running on server?
        // User requested "dia actual y dia anterior".
        // We will return data for the requested date.

        let targetDate = dateParam;
        if (!targetDate) {
            targetDate = now.toISOString().split('T')[0];
        }

        const key = `betai:check_logs:${targetDate}`;

        // Fetch logs (List)
        // lrange 0 -1 gets all
        const rawLogs = await redis.lrange(key, 0, -1);

        const logs = rawLogs.map((logStr) => {
            try {
                return typeof logStr === 'string' ? JSON.parse(logStr) : logStr;
            } catch (e) {
                return { message: "Invalid Log Format", raw: logStr };
            }
        });

        return NextResponse.json({ logs, date: targetDate });

    } catch (error) {
        console.error('Error fetching logs:', error);
        return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date');

        if (!dateParam) {
            return NextResponse.json({ error: 'Date parameter required' }, { status: 400 });
        }

        const key = `betai:check_logs:${dateParam}`;
        await redis.del(key);

        return NextResponse.json({ message: 'Logs deleted successfully', date: dateParam });

    } catch (error) {
        console.error('Error deleting logs:', error);
        return NextResponse.json({ error: 'Failed to delete logs' }, { status: 500 });
    }
}
