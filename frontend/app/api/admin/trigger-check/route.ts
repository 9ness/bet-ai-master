import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { date } = await request.json();

        // Repo details
        const OWNER = '9ness';
        const REPO = 'bet-ai-master';
        const WORKFLOW_ID = 'update_results_bet.yml';

        // Log for debugging
        console.log(`[Admin] Triggering workflow ${WORKFLOW_ID} for ${OWNER}/${REPO}`);

        const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${process.env.GH_TOKEN || process.env.GITHUB_TOKEN}`,
            },
            body: JSON.stringify({
                ref: 'main',
                // Inputs only if the workflow accepts them. Check results script uses --date, 
                // but workflow file needs 'workflow_dispatch: inputs: ...' to pass them to env or args.
                // Assuming script defaults to "yesterday" if no date? 
                // BUT user wants to force check. 
                // Let's pass 'date' if we can, but if workflow doesn't have it defined, it might warn.
                // For now, simple dispatch.
                inputs: {
                    // If workflow updates later to accept date:
                    // date: date 
                }
            })
        });

        if (response.ok) {
            console.log("[Admin] Workflow triggered successfully.");
            return NextResponse.json({ success: true, message: "Workflow triggered" });
        } else {
            const err = await response.text();
            console.error(`[Admin] GitHub API Error: ${response.status} - ${err}`);
            return NextResponse.json({ success: false, error: err }, { status: response.status });
        }
    } catch (error) {
        console.error("[Admin] Exception triggering workflow:", error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
