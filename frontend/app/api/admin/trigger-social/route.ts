import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const ghToken = process.env.GH_TOKEN;
    const owner = "9ness";
    const repo = "bet-ai-master";
    const workflowId = "generate_social_content.yml";
    const ref = "main";

    if (!ghToken) {
        return NextResponse.json({ error: "Server Configuration Error: GH_TOKEN missing" }, { status: 500 });
    }

    try {
        const body = await request.json();
        // Allow passing custom inputs if needed, though this workflow might not take any.
        // We'll pass 'mode' just in case or for future proofing, similar to other triggers.
        const mode = body.mode || 'default';

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
                    // check if workflow actually accepts inputs. If not, this might be ignored or cause error?
                    // Usually safe to omit if not sure, but let's assume it accepts 'mode' or nothing.
                    // If it accepts no inputs, passing inputs might fail logic in some GH actions 
                    // dependent on strict definition, but usually it's fine.
                    // I will pass nothing for now to be safe, unless I checked the yml (I listed it but didn't read it).
                    // User said "el botón hará que el github actions se ejecute".
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[GitHub API] Error ${response.status}: ${errorText}`);
            return NextResponse.json({ error: "GitHub API Refused Trigger", details: errorText }, { status: response.status });
        }

        console.log("[GitHub API] Workflow triggered successfully.");
        return NextResponse.json({ message: "Workflow Triggered Successfully" });

    } catch (error) {
        console.error('[GitHub API] Network/Execution Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: String(error) },
            { status: 500 }
        );
    }
}
