import { NextResponse } from 'next/server';
import { del, list, put } from '@vercel/blob';

export const runtime = 'edge';

export async function DELETE(request: Request) {
    try {
        const { url } = await request.json();
        if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });

        console.log(`[Admin] Deleting image: ${url}`);
        await del(url);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[Admin] Delete Error:", error);
        return NextResponse.json({ error: error.message || "Failed to delete" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    // MOVE ACTION (Copy + Delete)
    try {
        const { url, type, tag } = await request.json();

        if (!url || !type) {
            return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
        }

        console.log(`[Admin] Moving image ${url} to type: ${type}, tag: ${tag}`);

        // 1. Download current image
        const response = await fetch(url);
        if (!response.ok) throw new Error("Could not fetch source image");
        const blob = await response.blob();

        // 2. Generate new filename
        // Logic: bg-{type}-{tag}-{num}.ext
        const cleanTag = (tag || "").trim().replace(/[^a-zA-Z0-9]/g, "");

        // Determine prefix based on type
        // Standardizing naming convention:
        // bg-futbol-RealMadrid-1.png
        // bg-comodin-1.png (if no tag)
        // bg-portada-1.png

        // Construct prefix to search for existing files to increment number
        let searchPrefix = `bg-${type}-`;
        if (cleanTag) searchPrefix += `${cleanTag}-`;

        // If type is comodin/portada and no tag is provided, prefix is just bg-comodin-
        // If type is futbol/basket, tag is expected usually.

        // List existing to find next number
        const { blobs } = await list({ prefix: searchPrefix });

        // Extract numbers
        // Format e.g.: .../bg-futbol-RealMadrid-12.jpg
        const numbers = blobs.map(b => {
            const filename = b.pathname.split('/').pop() || "";
            // Remove prefix
            // We can't strictly replace prefix because of potential partial matches if we aren't careful, 
            // but simplified:
            // filename: bg-futbol-RealMadrid-1.png
            // prefix: bg-futbol-RealMadrid-
            // remaining: 1.png
            const rest = filename.replace(searchPrefix, "").split('.')[0];
            return parseInt(rest) || 0;
        });

        const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;

        // Keep original extension or default to jpg?
        // Let's assume input text/image response allows us to detect, or defaults.
        // vercel/blob contentType auto-detection is good, but filename needs extension.
        // We'll peek at original url extension
        const originalExt = url.split('.').pop() || 'jpg';
        const newFilename = `${searchPrefix}${nextNum}.${originalExt}`;

        // 3. Upload new blob
        const newBlob = await put(newFilename, blob, {
            access: 'public',
            contentType: response.headers.get('content-type') || 'image/jpeg'
        });

        // 4. Delete old blob
        await del(url);

        return NextResponse.json({ success: true, url: newBlob.url });

    } catch (error: any) {
        console.error("[Admin] Move Error:", error);
        return NextResponse.json({ error: error.message || "Failed to move" }, { status: 500 });
    }
}
