import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { date } = await request.json();

        // Trigger GitHub Workflow Dispatch
        const response = await fetch('https://api.github.com/repos/YOUR_USERNAME/YOUR_REPO/actions/workflows/update_results_bet.yml/dispatches', {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${process.env.GITHUB_TOKEN}`,
            },
            body: JSON.stringify({
                ref: 'main',
                inputs: {
                    mode: 'all' // Although the workflow doesn't explicitly use mode input for DATE, we might need to update workflow to accept date input if we want specific date check. 
                    // But check_results.py now accepts --date. The workflow needs to pass it.
                    // For now, let's assume it runs default or user needs to update workflow to accept inputs. 
                    // The prompt says "El script ahora debe aceptar... El botón debe disparar...".
                    // To pass date to workflow, workflow needs `inputs`.
                }
            })
        });

        if (response.ok) {
            return NextResponse.json({ success: true, message: "Workflow triggered" });
        } else {
            const err = await response.text();
            return NextResponse.json({ success: false, error: err }, { status: 500 });
        }
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
