import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { exec } from 'child_process';
import path from 'path';
import { promisify } from 'util';

const execPromise = promisify(exec);

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

        const key = `betai:morning_messages:${date}`;
        const data = await redis.get(key);

        return NextResponse.json({ success: true, versions: data || [] });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        // Trigger the python script
        const pythonPath = "python"; // Assume in PATH
        const scriptPath = path.join(process.cwd(), '..', 'backend', 'src', 'services', 'morning_generator.py');

        console.log(`[API] Executing: ${pythonPath} ${scriptPath}`);

        const { stdout, stderr } = await execPromise(`${pythonPath} "${scriptPath}"`);

        if (stderr && !stdout.includes('SUCCESS')) {
            console.error(`[API] Python Error: ${stderr}`);
            return NextResponse.json({ success: false, error: stderr }, { status: 500 });
        }

        // After execution, the script should have updated Redis.
        // Fetch the new data
        const today = new Date().toISOString().split('T')[0];
        const key = `betai:morning_messages:${today}`;
        const data = await redis.get(key);

        return NextResponse.json({ success: true, versions: data || [], log: stdout });
    } catch (error: any) {
        console.error(`[API] Execution Failed: ${error.message}`);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
