import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const bgDir = path.join(process.cwd(), 'public', 'backgrounds');

        if (!fs.existsSync(bgDir)) {
            return NextResponse.json({ error: 'Backgrounds directory not found' }, { status: 404 });
        }

        const files = fs.readdirSync(bgDir).filter(file => {
            return /\.(png|jpg|jpeg|webp)$/i.test(file);
        });

        return NextResponse.json({ files });
    } catch (error) {
        console.error('Error reading backgrounds:', error);
        return NextResponse.json({ error: 'Failed to read backgrounds' }, { status: 500 });
    }
}
