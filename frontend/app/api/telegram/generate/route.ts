import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';

const execPromise = util.promisify(exec);

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date } = body;

        // Default to today if no date provided
        const targetDate = date || new Date().toISOString().split('T')[0];

        console.log(`[API] Triggering Telegram Generator for ${targetDate}...`);

        // Construct command
        // Assuming project structure: backend/src/services/telegram_generator.py
        // We need an absolute path or relative from cwd
        // CWD in Next.js usually project root (frontend or main repo?)
        // The user CWD `bet-ai-master/frontend` implies we need to go up.

        // Let's rely on relative path from process.cwd()
        // If running next dev in `bet-ai-master/frontend`, then `../backend/...`
        const scriptPath = path.resolve(process.cwd(), '../backend/src/services/telegram_generator.py');

        // Python command (assume python in path or use full path if needed)
        const command = `python "${scriptPath}" --date ${targetDate}`;

        const { stdout, stderr } = await execPromise(command);

        if (stderr) {
            console.warn(`[API] Generator Stderr: ${stderr}`);
        }

        console.log(`[API] Generator Stdout: ${stdout}`);

        // Check success in output
        if (stdout.includes('[SUCCESS]')) {
            return NextResponse.json({ success: true, message: 'Messages generated successfully' });
        } else {
            return NextResponse.json({ error: 'Generator failed', details: stdout || stderr }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Internal API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
