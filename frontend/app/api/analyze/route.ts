import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST() {
    try {
        const backendDir = path.resolve(process.cwd(), '../backend');
        const scriptPath = path.join(backendDir, 'main.py');

        console.log(`[API] Triggering analysis: python "${scriptPath}" at ${backendDir}`);

        // Non-blocking execution?
        // User requested "Show Proceesing in background".
        // But for "Analyze", it needs to finish to show results. 
        // Gemini might take 10s. Vercel timeout is usually 10s or 60s (Pro).
        // Best approach: Await it, but if it's too long, user will get timeout. 
        // Given local environment, 60s timeout is fine. Let's await it to give feedback.
        // If it hangs, we can switch to spawn/detach.

        await new Promise((resolve, reject) => {
            exec(`python "${scriptPath}"`, { cwd: backendDir }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`[API] Analysis Error: ${error}`);
                    reject(error);
                    return;
                }
                console.log(`[API] Analysis Output: ${stdout}`);
                resolve(stdout);
            });
        });

        return NextResponse.json({ message: 'Analysis completed successfully' });

    } catch (error) {
        console.error('[API] Error triggering analysis:', error);
        return NextResponse.json(
            { error: 'Failed to execute analysis script', details: String(error) },
            { status: 500 }
        );
    }
}
