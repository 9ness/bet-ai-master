import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // List all blobs (we might want to filter by prefix if needed, but 'list()' gets everything in the store)
        // Since we only use this store for backgrounds, it's fine.
        const { blobs } = await list();

        // Return the full URLs
        return NextResponse.json({
            files: blobs.map(blob => blob.url)
        });
    } catch (error) {
        console.error('Error reading backgrounds from Blob:', error);
        return NextResponse.json({ error: 'Failed to read backgrounds' }, { status: 500 });
    }
}
