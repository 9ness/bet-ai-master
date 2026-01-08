import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const ghToken = process.env.GH_TOKEN;
    const owner = "9ness";
    const repo = "bet-ai-master";
    const workflowId = "daily_bet_update.yml";
    const ref = "main";

    if (!ghToken) {
        return NextResponse.json({ error: "Server Configuration Error: GH_TOKEN missing" }, { status: 500 });
    }

    try {
        const body = await request.json();
        const mode = body.mode || 'all'; // 'fetch', 'analyze', or 'all'

        console.log(`[GitHub API] Triggering workflow ${workflowId} (Mode: ${mode}) for ${owner}/${repo}...`);

        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ghToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ref: ref,
                inputs: {
                    mode: mode
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[GitHub API] Error ${response.status}: ${errorText}`);
            return NextResponse.json({ error: "GitHub API Refused Trigger", details: errorText }, { status: response.status });
        }

        console.log("[GitHub API] Workflow triggered successfully.");
        return NextResponse.json({ message: "Workflow Triggered Successfully", mode: mode });

    } catch (error) {
        console.error('[GitHub API] Network/Execution Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: String(error) },
            { status: 500 }
        );
    }
}
