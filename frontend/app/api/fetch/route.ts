import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST() {
    try {
        // Resolve backend path relative to frontend
        // frontend is at /bet-ai-master/frontend
        // backend is at /bet-ai-master/backend
        const backendDir = path.resolve(process.cwd(), '../backend');
        const scriptPath = path.join(backendDir, 'src', 'services', 'fetch_odds.py');

        console.log(`[API] Executing fetch_odds.py from ${backendDir}`);

        // Execute python script
        // Note: Assuming 'python' is in PATH. If using venv, might need specific path.
        // We use a promise wrapper for exec
        await new Promise((resolve, reject) => {
            exec(`python "${scriptPath}"`, { cwd: backendDir }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`[API] exec error: ${error}`);
                    // We don't necessarily reject if it's just a non-zero exit but script ran?
                    // But Python usually exits non-zero on error.
                    reject(error);
                    return;
                }
                console.log(`[API] stdout: ${stdout}`);
                if (stderr) console.error(`[API] stderr: ${stderr}`);
                resolve(stdout);
            });
        });

        return NextResponse.json({ message: 'Fetch completed successfully' });

    } catch (error) {
        console.error('[API] Error triggering fetch:', error);
        return NextResponse.json(
            { error: 'Failed to execute fetch script', details: String(error) },
            { status: 500 }
        );
    }
}
