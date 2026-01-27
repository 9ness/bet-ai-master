import { NextResponse } from 'next/server';
import { put, list } from '@vercel/blob';
import sharp from 'sharp';

export async function POST(request: Request) {
    try {
        const { imageUrl, type, tag } = await request.json();

        if (!imageUrl || !type) {
            return NextResponse.json({ error: "Image URL and Type are required" }, { status: 400 });
        }

        console.log(`Downloading ${imageUrl}...`);

        // 1. Fetch Image with headers
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Referer': 'https://www.google.com/'
            }
        });

        if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 2. Resize Image (1080x1350 - TikTok Portrait Optimized)
        const resizedBuffer = await sharp(buffer)
            .resize(1080, 1350, {
                fit: 'cover',
                position: 'center'
            })
            .jpeg({ quality: 80 }) // Compress slightly to save space
            .toBuffer();

        // 3. Determine Filename (Incremental)
        const cleanTag = (tag || "Generic").replace(/[^a-zA-Z0-9]/g, "");
        let prefix = (type === 'portada' || type === 'comodin')
            ? (tag ? `bg-${type}-${cleanTag}-` : `bg-${type}-`)
            : `bg-${type}-${cleanTag}-`;

        // List existing blobs to find next number
        const { blobs } = await list({ prefix: prefix });

        const numbers = blobs.map(b => {
            const name = b.pathname.split('/').pop() || ''; // Handle potential folder structure if any
            const part = name.replace(prefix, '').replace('.jpg', '').replace('.png', '');
            return parseInt(part) || 0;
        });

        const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
        const filename = `${prefix}${nextNum}.jpg`;

        // 4. Upload to Vercel Blob
        const blob = await put(filename, resizedBuffer, {
            access: 'public',
            contentType: 'image/jpeg'
        });

        return NextResponse.json({ success: true, path: blob.url });

    } catch (error) {
        console.error("Save Error:", error);
        return NextResponse.json({ error: "Failed to save image" }, { status: 500 });
    }
}
